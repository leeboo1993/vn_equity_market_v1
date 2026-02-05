import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP } from "./rateLimit";

/**
 * Check if the request has a valid authenticated and approved session
 * Also enforces rate limiting to prevent automated scraping
 * 
 * @param {Request} request - Next.js request object
 * @returns {Promise<{authorized: boolean, response?: NextResponse, session?: any}>}
 */
export async function requireAuth(request) {
    const session = await auth();

    if (!session?.user?.approved) {
        return {
            authorized: false,
            response: NextResponse.json(
                { error: 'Unauthorized - Authentication required' },
                { status: 401 }
            )
        };
    }

    // Rate limiting - prevent automated scraping
    const identifier = session.user.email || getClientIP(request);
    const rateLimit = checkRateLimit(identifier, 150, 60000); // 150 req/min

    if (!rateLimit.allowed) {
        const resetInSeconds = Math.ceil((rateLimit.resetTime - Date.now()) / 1000);
        return {
            authorized: false,
            response: NextResponse.json(
                {
                    error: 'Rate limit exceeded',
                    message: 'Too many requests. Please wait before trying again.',
                    retryAfter: resetInSeconds
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': resetInSeconds.toString(),
                        'X-RateLimit-Limit': '150',
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': rateLimit.resetTime.toString()
                    }
                }
            )
        };
    }

    // Success - add rate limit headers to response
    return {
        authorized: true,
        session,
        rateLimitHeaders: {
            'X-RateLimit-Limit': '150',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': rateLimit.resetTime.toString()
        }
    };
}
