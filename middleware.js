import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
    const { nextUrl } = req;
    const isLoggedIn = !!req.auth;
    const isApproved = req.auth?.user?.approved;

    const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
    const isPublicRoute = ["/login", "/waiting-approval", "/public"].includes(nextUrl.pathname);
    const isPublicAsset = nextUrl.pathname.startsWith("/_next") || nextUrl.pathname === "/favicon.ico";

    if (isApiAuthRoute || isPublicAsset) return null;

    if (isPublicRoute) {
        if (isLoggedIn && isApproved && nextUrl.pathname !== "/") {
            return NextResponse.redirect(new URL("/", nextUrl));
        }
        return null;
    }

    if (!isLoggedIn) {
        return NextResponse.redirect(new URL("/login", nextUrl));
    }

    if (!isApproved && nextUrl.pathname !== "/waiting-approval") {
        return NextResponse.redirect(new URL("/waiting-approval", nextUrl));
    }

    // Admin Route Protection
    if (nextUrl.pathname.startsWith("/admin") && req.auth?.user?.role !== 'admin') {
        return NextResponse.redirect(new URL("/", nextUrl));
    }

    // Feature-based Route Protection
    const routeFeatureMap = {
        '/macro-research': 'Macro Research',
        '/strategy-research': 'Strategy Research',
        '/company-research': 'Company Research',
    };

    const feature = routeFeatureMap[nextUrl.pathname];
    if (feature) {
        const userRole = req.auth?.user?.role;
        // For now, use hardcoded check. In production, you'd fetch from R2
        const restrictedToAdmin = feature === 'Macro Research';

        if (restrictedToAdmin && userRole !== 'admin') {
            return NextResponse.redirect(new URL("/", nextUrl));
        }
    }

    return null;
});

// Matcher for all routes
export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
