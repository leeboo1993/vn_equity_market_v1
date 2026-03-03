import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { findUserByEmail, createUser, verifyUserPassword, updateUser } from "@/lib/users";
import bcrypt from "bcryptjs";
import Email from "next-auth/providers/nodemailer";

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        ...authConfig.providers,
        Email({
            server: {
                host: process.env.AUTH_EMAIL_SERVER_HOST,
                port: process.env.AUTH_EMAIL_SERVER_PORT || 587,
                auth: {
                    user: process.env.AUTH_EMAIL_SERVER_USER,
                    pass: process.env.AUTH_EMAIL_SERVER_PASSWORD,
                },
            },
            from: process.env.AUTH_EMAIL_FROM,
        }),
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
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, account, profile }) {
            const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
            const isAdmin = user.email && adminEmails.includes(user.email.toLowerCase());

            // Registration Restriction: Block non-admins if RESTRICT_REGISTRATION is true
            if (process.env.RESTRICT_REGISTRATION === 'true' && !isAdmin) {
                // Check if user already exists (allow existing members to sign in)
                const existingUser = await findUserByEmail(user.email);
                if (!existingUser) return false;
            }

            if (account.provider === "google" || account.provider === "facebook" || account.provider === "email") {
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
                // Attach database fields to the user object
                user.role = existingUser.role;
                user.approved = existingUser.approved;
            }
            return true;
        },
        async jwt({ token, user, trigger, session }) {
            // When user is provided (on sign in), enrich token with database fields
            if (user) {
                token.role = user.role;
                token.approved = user.approved;
                token.email = user.email;
            }

            // --- IMMEDIATE ADMIN ELEVATION OVERRIDE ---
            // Always verify Admin status from ENV to allow instant promotion without sign-out
            const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
            if (token.email && adminEmails.includes(token.email.toLowerCase())) {
                token.role = 'admin';
                token.approved = true;
            }

            // Allow manual updates
            if (trigger === "update" && session) {
                token.role = session.user.role;
                token.approved = session.user.approved;
            }

            return token;
        }
    },
});
