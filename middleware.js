import NextAuth from "next-auth";
import authConfig from "./auth.config";
import { NextResponse } from "next/server";
import { getFeatureSettings, hasAccess } from "./lib/rbac";

const { auth } = NextAuth(authConfig);

// In-memory cache for feature settings (Node/Edge runtime)
let featureCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 60 seconds

async function getCachedFeatures() {
    const now = Date.now();
    if (featureCache && (now - cacheTimestamp < CACHE_TTL)) {
        return featureCache;
    }

    try {
        featureCache = await getFeatureSettings();
        cacheTimestamp = now;
        return featureCache;
    } catch (e) {
        console.error("Middleware Cache Error:", e);
        return {};
    }
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

    // Dynamic Feature-based Route Protection
    const userRole = req.auth?.user?.role;

    // Admin always has access to everything
    if (userRole === 'admin') return null;

    const routeFeatureMap = {
        '/broker-consensus': 'Research',
        '/macro-research': 'Broker Consensus - Macro',
        '/strategy-research': 'Broker Consensus - Strategy',
        '/broker-sentiment': 'Broker Sentiment',
        '/admin': 'admin', // Redundant but safe
    };

    const requiredFeature = routeFeatureMap[nextUrl.pathname];
    if (requiredFeature) {
        if (requiredFeature === 'admin' && userRole !== 'admin') {
            return NextResponse.redirect(new URL("/", nextUrl));
        }

        const features = await getCachedFeatures();
        if (!hasAccess(userRole, requiredFeature, features)) {
            // Redirect to home if they don't have access to this feature
            return NextResponse.redirect(new URL("/", nextUrl));
        }
    }

    return null;
});

// Matcher for all routes
export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
