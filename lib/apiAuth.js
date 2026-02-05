import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { NextResponse } from "next/server";

/**
 * Check if the request has a valid authenticated and approved session
 * Use this in API routes to protect against unauthorized access
 * 
 * @param {Request} request - Next.js request object
 * @returns {Promise<{authorized: boolean, response?: NextResponse, session?: any}>}
 */
export async function requireAuth(request) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.approved) {
        return {
            authorized: false,
            response: NextResponse.json(
                { error: 'Unauthorized - Authentication required' },
                { status: 401 }
            )
        };
    }

    return {
        authorized: true,
        session
    };
}
