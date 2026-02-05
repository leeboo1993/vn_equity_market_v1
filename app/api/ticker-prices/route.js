import { getTickerPrices } from '../../../lib/data.js';
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { tickers, callDates } = await request.json();

        if (!tickers || !Array.isArray(tickers)) {
            return NextResponse.json({ error: 'tickers array required' }, { status: 400 });
        }

        const prices = await getTickerPrices(tickers, callDates || []);
        return NextResponse.json(prices);
    } catch (error) {
        console.error('Error fetching ticker prices:', error);
        return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
    }
}
