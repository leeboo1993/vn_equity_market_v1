import { getFinancialPrefs, saveFinancialPrefs } from "@/lib/financial_prefs";
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    const prefs = await getFinancialPrefs();
    return NextResponse.json(prefs);
}

export async function POST(req) {
    const session = await auth();
    // Only admins can update the row visibility
    if (!session || session.user.role !== 'admin') {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const prefs = await req.json();
        await saveFinancialPrefs(prefs);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to parse or save prefs:", error);
        return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
}
