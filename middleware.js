import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextResponse } from "next/server";
export default auth(async (req) => {
    const { nextUrl } = req;
    const isLoggedIn = !!req.auth;
    const isApproved = req.auth?.user?.approved;

    const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
    const isPublicRoute = ["/login", "/waiting-approval", "/public"].includes(nextUrl.pathname);
    const isPublicAsset = nextUrl.pathname.startsWith("/_next") ||
        nextUrl.pathname === "/favicon.ico" ||
        nextUrl.pathname.startsWith("/images/");

    if (isApiAuthRoute || isPublicAsset) return null;

    if (isPublicRoute) {
        // Redir authenticated & approved away from login/waiting to home
        if (isLoggedIn && isApproved && (nextUrl.pathname === "/login" || nextUrl.pathname === "/waiting-approval")) {
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

    // Basic Access check for internal routes
    // For more granular feature-based control, we handle it inside the page components
    // to keep the middleware lightweight and Edge-compatible.
    return null;
});

// Matcher for all routes
export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
