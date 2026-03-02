import { auth } from "@/auth";
import { getFeatureSettings, saveFeatureSettings } from "@/lib/rbac";
import { NextResponse } from "next/server";

export async function GET() {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const settings = await getFeatureSettings();
    return NextResponse.json(settings);
}

export async function POST(req) {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    try {
        const settings = await req.json();
        await saveFeatureSettings(settings);
        return NextResponse.json({ success: true });
    } catch (e) {
        return new NextResponse(e.message, { status: 500 });
    }
}
