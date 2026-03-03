import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextResponse } from "next/server";
import { getFeatureSettings, hasAccess } from "./lib/rbac";

const { auth } = NextAuth(authConfig);

// In-memory cache for feature settings (60 second TTL)
let featureCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds

async function getCachedFeatures() {
    const now = Date.now();
    if (featureCache && (now - cacheTimestamp < CACHE_TTL)) {
        return featureCache;
    }

    featureCache = await getFeatureSettings();
    cacheTimestamp = now;
    return featureCache;
}

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

    // Dynamic Feature-based Route Protection
    const routeFeatureMap = {
        '/broker-consensus': 'Research',
        '/priceboard': 'Price Board',
        '/daily-tracking': 'Market Dashboard',
    };

    const feature = routeFeatureMap[nextUrl.pathname];
    if (feature) {
        const userRole = req.auth?.user?.role;
        const features = await getCachedFeatures();

        if (!hasAccess(userRole, feature, features)) {
            return NextResponse.redirect(new URL("/", nextUrl));
        }
    }

    return null;
});

// Matcher for all routes
export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
