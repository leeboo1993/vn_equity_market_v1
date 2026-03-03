import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await auth();

    // Only allow admins to see the debug info
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requiredVars = [
        'R2_ENDPOINT',
        'R2_ACCESS_KEY_ID',
        'R2_SECRET_ACCESS_KEY',
        'R2_BUCKET',
        'AUTH_SECRET',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'FACEBOOK_CLIENT_ID',
        'FACEBOOK_CLIENT_SECRET',
        'AUTH_EMAIL_SERVER_HOST',
        'ADMIN_EMAILS',
        'NEXTAUTH_URL'
    ];

    const status = {};
    requiredVars.forEach(v => {
        status[v] = {
            present: !!process.env[v],
            length: process.env[v] ? process.env[v].length : 0,
            prefix: process.env[v] ? process.env[v].substring(0, 3) + "..." : null
        };
    });

    return NextResponse.json({
        env_status: status,
        node_env: process.env.NODE_ENV,
        session_user: session.user
    });
}
