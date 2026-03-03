import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { findUserByEmail, createUser, verifyUserPassword, updateUser } from "@/lib/users";
import bcrypt from "bcryptjs";
import Email from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        ...authConfig.providers,
        Credentials({
            authorize: async (credentials) => {
                const user = await verifyUserPassword(credentials.email, credentials.password);
                if (user) {
                    const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
                    const isAdmin = credentials.email && adminEmails.includes(credentials.email.toLowerCase());
                    if (isAdmin && (!user.approved || user.role !== 'admin')) {
                        return await updateUser(credentials.email, { role: 'admin', approved: true });
                    }
                    return user;
                }

                const existing = await findUserByEmail(credentials.email);
                const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
                const isAdmin = credentials.email && adminEmails.includes(credentials.email.toLowerCase());

                if (existing) {
                    if (isAdmin && !existing.password) {
                        const hashedPassword = await bcrypt.hash(credentials.password, 10);
                        return await updateUser(credentials.email, { password: hashedPassword, role: 'admin', approved: true });
                    }
                    return null;
                }

                const newUser = await createUser({
                    email: credentials.email,
                    password: credentials.password,
                    provider: "credentials",
                    role: isAdmin ? "admin" : "member",
                    approved: isAdmin ? true : false
                });
                return newUser;
            },
        })
    ],
    // WRAP THESE IN A CALLBACKS OBJECT!
    callbacks: {
        ...authConfig.callbacks, // Preserve the authorized callback from authConfig
        async signIn({ user, account, profile, credentials }) {
            const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
            const isAdmin = user.email && adminEmails.includes(user.email.toLowerCase());

            // Registration Restriction: Block non-admins if RESTRICT_REGISTRATION is true
            if (process.env.RESTRICT_REGISTRATION === 'true' && !isAdmin) {
                const existingUser = await findUserByEmail(user.email);
                if (!existingUser) return false;
            }

            if (account?.provider === "google" || account?.provider === "facebook" || account?.provider === "email") {
                let existingUser = await findUserByEmail(user.email);
                if (!existingUser) {
                    existingUser = await createUser({
                        email: user.email,
                        name: user.name || user.email.split('@')[0],
                        image: user.image,
                        provider: account.provider,
                        role: isAdmin ? "admin" : "member",
                        approved: isAdmin ? true : false
                    });
                }
                // Attach database fields to the user object so they flow into the jwt callback
                user.role = existingUser.role;
                user.approved = existingUser.approved;
            }
            return true;
        },
        async jwt({ token, user, account, trigger, session }) {
            // Initial sign in
            if (user) {
                token.email = user.email;
                if (account && account.provider !== "credentials") {
                    // Fetch latest database status for OAuth providers
                    const dbUser = await findUserByEmail(user.email);
                    if (dbUser) {
                        token.role = dbUser.role;
                        token.approved = dbUser.approved;
                    } else {
                        token.role = "member";
                        token.approved = false;
                    }
                } else {
                    // Credentials provider already returns dbUser
                    token.role = user.role;
                    token.approved = user.approved;
                }
                token.lastDbCheck = Date.now();
            }

            // Periodically re-check the database for approval/role changes (every 30s)
            // This ensures admin approval takes effect without requiring re-login
            const DB_CHECK_INTERVAL = 30 * 1000; // 30 seconds
            if (!token.lastDbCheck || (Date.now() - token.lastDbCheck > DB_CHECK_INTERVAL)) {
                try {
                    const dbUser = await findUserByEmail(token.email);
                    if (dbUser) {
                        token.role = dbUser.role;
                        token.approved = dbUser.approved;
                    }
                } catch (e) {
                    console.error("JWT db re-check failed:", e);
                }
                token.lastDbCheck = Date.now();
            }

            // Always enforce Admin elevation from ENV (allows instant promotion)
            const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
            if (token.email && adminEmails.includes(token.email.toLowerCase())) {
                token.role = 'admin';
                token.approved = true;
            }

            // Manual session updates
            if (trigger === "update" && session?.user) {
                token.role = session.user.role;
                token.approved = session.user.approved;
            }

            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.role = token.role;
                session.user.approved = token.approved;
            }
            return session;
        }
    }
});
