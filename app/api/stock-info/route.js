
import { NextResponse } from 'next/server';
import { getStockInfoMap } from '../../../lib/stockInfo';
import { requireAuth } from '@/lib/apiAuth';

// Cache for 1 hour
export const revalidate = 3600;

export async function GET(request) {
    // ANTI-CRAWLER: Require authentication
    const { authorized, response } = await requireAuth(request);
    if (!authorized) return response;
    try {
        const stockMap = await getStockInfoMap();

        // Convert Map to a clean object for JSON serialization
        // Format: { "ABC": { ticker: "ABC", organ_short: "Company Name", icb_name2: "Sector", ... } }
        const stockData = {};
        for (const [ticker, info] of stockMap.entries()) {
            stockData[ticker] = info;
        }

        return NextResponse.json(stockData);
    } catch (error) {
        console.error("Failed to fetch stock info:", error);
        return NextResponse.json({ error: "Failed to fetch stock info" }, { status: 500 });
    }
}
