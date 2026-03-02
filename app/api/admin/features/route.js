import { getFeatureSettings, saveFeatureSettings } from "@/lib/rbac";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await auth();
    // Allow any logged-in user to check what features they have access to.
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getFeatureSettings();
    return NextResponse.json(settings);
}


export async function POST(req) {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await req.json();
    await saveFeatureSettings(settings);
    return NextResponse.json({ success: true });
}
