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

                const newUser = await createUser({
                    email: credentials.email,
                    password: credentials.password,
                    provider: "credentials",
                });
                return newUser;
            },
        }
    ],
    callbacks: {
        ...authConfig.callbacks,
        async signIn({ user, account, profile }) {
            if (account.provider === "google" || account.provider === "facebook") {
                let existingUser = await findUserByEmail(user.email);
                if (!existingUser) {
                    existingUser = await createUser({
                        email: user.email,
                        name: user.name,
                        image: user.image,
                        provider: account.provider,
                    });
                }
                // Attach database fields to the user object so they flow into the jwt callback
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

                // Admin override via environment variable
                const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
                if (user.email && adminEmails.includes(user.email.toLowerCase())) {
                    token.role = 'admin';
                    token.approved = true;
                }
            }

            // Allow manual updates (e.g. via the Admin Dashboard if we implemented session updating)
            if (trigger === "update" && session) {
                token.role = session.user.role;
                token.approved = session.user.approved;
            }

            // Fallback: If for some reason we have a token but no role/approved status, 
            // and we are NOT in the Edge runtime (middleware), we could fetch it here.
            // But for now, ensuring it happens on signIn is the most efficient.

            return token;
        }
    },
});
