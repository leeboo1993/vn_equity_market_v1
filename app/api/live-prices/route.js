import { NextResponse } from 'next/server';

// Simple in-memory cache for the access token to avoid re-authenticating every request
let ssiAccessTokenStr = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
    if (ssiAccessTokenStr && Date.now() < tokenExpiresAt) {
        return ssiAccessTokenStr;
    }

    const consumerID = process.env.SSI_CONSUMER_ID;
    const consumerSecret = process.env.SSI_CONSUMER_SECRET;

    if (!consumerID || !consumerSecret) {
        throw new Error("Missing SSI credentials in environment");
    }

    const res = await fetch("https://fc-data.ssi.com.vn/api/v2/Market/AccessToken", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consumerID, consumerSecret })
    });

    if (!res.ok) {
        throw new Error(`Failed to authenticate with SSI: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.status === 200 && data.data) {
        ssiAccessTokenStr = data.data.accessToken;
        // Typically tokens expire in 2-24 hours. We'll cache for 1 hour to be safe.
        tokenExpiresAt = Date.now() + 60 * 60 * 1000;
        return ssiAccessTokenStr;
    } else {
        throw new Error(`SSI Auth failed: ${data.message || 'Unknown error'}`);
    }
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const tickersParam = searchParams.get('tickers'); // e.g., "FPT,SSI,VNM"

        if (!tickersParam) {
            return NextResponse.json({ error: "No tickers provided" }, { status: 400 });
        }

        const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase());
        const token = await getAccessToken();

        // SSI HTTP API for Daily Stock Price (latest day)
        // We will fetch the price for today. If the market is closed or it's a weekend,
        // we might need to fetch a date range to get the last trading day.

        const now = new Date();
        // Format DD/MM/YYYY
        const formatDate = (date) => {
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        };

        const todayStr = formatDate(now);
        // Look back 5 days to ensure we hit a trading day
        const pastDate = new Date(now);
        pastDate.setDate(now.getDate() - 5);
        const startDateStr = formatDate(pastDate);

        const priceData = {};

        // In a serverless environment, fetching 50 tickers sequentially is slow.
        // We will do parallel fetches. If there are too many, batch them.
        const BATCH_SIZE = 10;
        for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
            const batch = tickers.slice(i, i + BATCH_SIZE);
            const promises = batch.map(async (ticker) => {
                const url = `https://fc-data.ssi.com.vn/api/v2/Market/DailyStockPrice?symbol=${ticker}&fromDate=${startDateStr}&toDate=${todayStr}&pageIndex=1&pageSize=100`;

                try {
                    const priceRes = await fetch(url, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        },
                        // Next.js caching: revalidate every 30 seconds for "real-time" feel without spamming
                        next: { revalidate: 30 }
                    });

                    if (priceRes.ok) {
                        const pData = await priceRes.json();
                        if (pData.data && pData.data.length > 0) {
                            // The first element might be the oldest or newest depending on API sort order.
                            // Usually we want the item with the latest TradingDate.
                            // Let's parse dates and find the max.
                            let latestRecord = pData.data[0];
                            let maxDateInt = 0;

                            for (const rec of pData.data) {
                                const [d, m, y] = rec.TradingDate.split('/');
                                const val = parseInt(`${y}${m}${d}`);
                                if (val > maxDateInt) {
                                    maxDateInt = val;
                                    latestRecord = rec;
                                }
                            }

                            // SSI prices are usually true integer values (e.g. 10500)
                            priceData[ticker] = {
                                price: parseFloat(latestRecord.ClosePrice || latestRecord.Close || 0),
                                date: latestRecord.TradingDate
                            };
                        }
                    }
                } catch (e) {
                    console.error(`Failed to fetch for ${ticker}`, e);
                }
            });

            await Promise.all(promises);
        }

        return NextResponse.json({ prices: priceData });

    } catch (error) {
        console.error("Live Prices API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
