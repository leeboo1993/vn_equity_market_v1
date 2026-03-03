import { getFeatureSettings } from "@/lib/rbac";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getFeatureSettings();
    return NextResponse.json(settings);
}
