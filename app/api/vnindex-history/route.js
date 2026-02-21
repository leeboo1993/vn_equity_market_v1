import { getSSIAccessToken } from '@/lib/data';
import { NextResponse } from 'next/server';
import dotenv from 'dotenv';

dotenv.config(); // Load .env
dotenv.config({ path: '.env.local' }); // Load custom .env.local

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const datesParam = searchParams.get('dates');
        if (!datesParam) {
            return NextResponse.json({ error: 'Missing dates parameter' }, { status: 400 });
        }

        const dates = datesParam.split(',');
        const prices = {};

        // Fetch token
        const token = await getSSIAccessToken();
        if (!token) {
            return NextResponse.json({ error: 'Failed to authenticate with SSI' }, { status: 500 });
        }

        // Parse YYMMDD into Date objects to find the min and max dates
        const dateObjs = dates.map(d => {
            if (d.length === 6) {
                const yy = parseInt(d.substring(0, 2), 10);
                const mm = parseInt(d.substring(2, 4), 10) - 1;
                const dd = parseInt(d.substring(4, 6), 10);
                return new Date(2000 + yy, mm, dd);
            }
            // fallback for YYYYMMDD
            if (d.length === 8) {
                const yyyy = parseInt(d.substring(0, 4), 10);
                const mm = parseInt(d.substring(4, 6), 10) - 1;
                const dd = parseInt(d.substring(6, 8), 10);
                return new Date(yyyy, mm, dd);
            }
            return new Date(d); // Fallback standard parsing
        }).filter(d => !isNaN(d.getTime()));

        if (dateObjs.length === 0) {
            return NextResponse.json({ prices: {} });
        }

        // Get min and max dates to fetch the range, plus buffer for T+1 / T-1
        const minDate = new Date(Math.min(...dateObjs.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dateObjs.map(d => d.getTime())));
        maxDate.setDate(maxDate.getDate() + 5); // Add 5 days buffer for T+1 and weekends
        minDate.setDate(minDate.getDate() - 5);

        const formatDateSSI = (date) => {
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        };

        const startDateStr = formatDateSSI(minDate);
        const toDateStr = formatDateSSI(maxDate);

        // Fetch VNINDEX history from SSI DailyIndex API
        const url = `https://fc-data.ssi.com.vn/api/v2/Market/DailyIndex?indexId=VNINDEX&fromDate=${startDateStr}&toDate=${toDateStr}&pageIndex=1&pageSize=100`;

        const priceRes = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });

        if (priceRes.ok) {
            const pData = await priceRes.json();
            if (pData.data && pData.data.length > 0) {
                // pData.data contains an array of index records
                // e.g. { "TradingDate": "12/02/2025", "IndexValue": "1234.56", ... }

                const historyMap = {};
                for (const rec of pData.data) {
                    if (rec.TradingDate && rec.IndexValue) {
                        // SSI date format: DD/MM/YYYY -> map to YYMMDD (e.g. 250212)
                        const [d, m, yStr] = rec.TradingDate.split('/');
                        const yy = yStr.substring(2, 4);
                        const formattedDateYYMMDD = `${yy}${m}${d}`;
                        const formattedDateYYYYMMDD = `${yStr}${m}${d}`;
                        historyMap[formattedDateYYMMDD] = parseFloat(rec.IndexValue);
                        historyMap[formattedDateYYYYMMDD] = parseFloat(rec.IndexValue);
                        historyMap[`${yStr}-${m}-${d}`] = parseFloat(rec.IndexValue);
                    }
                }

                // Map requested dates to fetched historical prices
                for (const date of dates) {
                    const priceAtCall = historyMap[date] || null;
                    const key = `VNINDEX_${date}`;
                    prices[key] = {
                        priceAtCall
                    };
                }
            }
        }

        return NextResponse.json({ prices });
    } catch (error) {
        console.error('Error fetching VNINDEX history:', error);
        return NextResponse.json({ error: 'Failed to fetch VNINDEX history' }, { status: 500 });
    }
}
