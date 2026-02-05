/**
 * In-memory rate limiter for API endpoints
 * Prevents automated scraping while allowing normal usage
 * 
 * Limits: 150 requests per minute per user
 * Storage: In-memory Map (resets on server restart)
 */

const rateLimitStore = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now - data.resetTime > 60000) { // 1 minute old
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Check if a user has exceeded rate limit
 * @param {string} identifier - User email or IP address
 * @param {number} limit - Max requests per window (default: 150)
 * @param {number} windowMs - Time window in ms (default: 60000 = 1 minute)
 * @returns {{allowed: boolean, remaining: number, resetTime: number}}
 */
export function checkRateLimit(identifier, limit = 150, windowMs = 60000) {
    const now = Date.now();
    const userRateLimit = rateLimitStore.get(identifier);

    // First request or window expired
    if (!userRateLimit || now > userRateLimit.resetTime) {
        rateLimitStore.set(identifier, {
            count: 1,
            resetTime: now + windowMs
        });
        return {
            allowed: true,
            remaining: limit - 1,
            resetTime: now + windowMs
        };
    }

    // Increment request count
    userRateLimit.count++;

    // Check if over limit
    if (userRateLimit.count > limit) {
        return {
            allowed: false,
            remaining: 0,
            resetTime: userRateLimit.resetTime
        };
    }

    // Update store
    rateLimitStore.set(identifier, userRateLimit);

    return {
        allowed: true,
        remaining: limit - userRateLimit.count,
        resetTime: userRateLimit.resetTime
    };
}

/**
 * Get client IP address from request headers
 * @param {Request} request - Next.js request object
 * @returns {string} IP address
 */
export function getClientIP(request) {
    // Check Vercel headers first
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }

    // Fallback headers
    const realIP = request.headers.get('x-real-ip');
    if (realIP) return realIP;

    const cfConnectingIP = request.headers.get('cf-connecting-ip');
    if (cfConnectingIP) return cfConnectingIP;

    return 'unknown';
}
