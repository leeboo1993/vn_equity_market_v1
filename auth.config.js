import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";

export default {
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        Facebook({
            clientId: process.env.FACEBOOK_CLIENT_ID,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        }),
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isApproved = auth?.user?.approved;
            // Basic check for middleware
            return true;
        },
        async jwt({ token, user, trigger, session }) {
            if (user) {
                token.role = user.role;
                token.approved = user.approved;
            }
            if (trigger === "update" && session) {
                token.role = session.user.role;
                token.approved = session.user.approved;
            }
            return token;
        },
        async session({ session, token }) {
            if (token) {
                session.user.role = token.role;
                session.user.approved = token.approved;
            }
            return session;
        },
    },
};
