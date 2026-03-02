import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { findUserByEmail, createUser, verifyUserPassword } from "@/lib/users";

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        ...authConfig.providers.filter(p => p.id !== 'credentials'),
        {
            ...authConfig.providers.find(p => p.id === 'credentials'),
            async authorize(credentials) {
                const user = await verifyUserPassword(credentials.email, credentials.password);
                if (user) return user;

                const existing = await findUserByEmail(credentials.email);
                if (existing) return null;

                const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
                const isAdmin = credentials.email && adminEmails.includes(credentials.email.toLowerCase());

                const newUser = await createUser({
                    email: credentials.email,
                    password: credentials.password,
                    provider: "credentials",
                    role: isAdmin ? "admin" : "member",
                    approved: isAdmin ? true : false
                });
                return newUser;
            },
        }
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

            if (account.provider === "google" || account.provider === "facebook") {
                let existingUser = await findUserByEmail(user.email);
                if (!existingUser) {
                    existingUser = await createUser({
                        email: user.email,
                        name: user.name,
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
