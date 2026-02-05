import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');
    const resolution = searchParams.get('resolution') || 'D';
    const days = parseInt(searchParams.get('days') || '365');

    if (!ticker) {
        return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    // Calculate timestamps
    const now = new Date();
    const to = Math.floor(now.getTime() / 1000);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    const from = Math.floor(fromDate.getTime() / 1000);

    const url = `https://apipubaws.tcbs.com.vn/stock-insight/v1/stock/bars-long-term?ticker=${ticker}&type=stock&resolution=${resolution}&from=${from}&to=${to}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Upstream API error: ${response.status}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error proxying TCBS request:', error);
        return NextResponse.json({ error: 'Failed to fetch stock history' }, { status: 500 });
    }
}
