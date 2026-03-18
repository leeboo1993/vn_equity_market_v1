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
        let maxDate = new Date(Math.max(...dateObjs.map(d => d.getTime())));
        maxDate.setDate(maxDate.getDate() + 5); // Add 5 days buffer for T+1 and weekends
        minDate.setDate(minDate.getDate() - 5);

        const formatDateSSI = (date) => {
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        };

        const today = new Date();
        if (maxDate > today) {
            maxDate = today;
        }

        const historyMap = {};

        // SSI DailyIndex API has a max range of 30 days. We must chunk the range.
        let currentStart = new Date(minDate.getTime());
        while (currentStart <= maxDate) {
            let currentEnd = new Date(currentStart.getTime());
            currentEnd.setDate(currentEnd.getDate() + 29); // Max 30 days inclusive
            if (currentEnd > maxDate) {
                currentEnd = new Date(maxDate.getTime());
            }

            const startDateStr = formatDateSSI(currentStart);
            const toDateStr = formatDateSSI(currentEnd);

            const url = `https://fc-data.ssi.com.vn/api/v2/Market/DailyIndex?indexId=VNINDEX&fromDate=${startDateStr}&toDate=${toDateStr}&pageIndex=1&pageSize=100`;

            let priceRes = null;
            let pData = null;
            let attempts = 0;
            const maxAttempts = 5;

            while (attempts < maxAttempts) {
                priceRes = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    },
                    next: { revalidate: 3600 } // Cache for 1 hour
                });

                if (priceRes.status === 429) {
                    attempts++;
                    console.warn(`[vnindex-history] 429 Rate Limit hit. Retrying in 1s... (Attempt ${attempts}/${maxAttempts})`);
                    await new Promise(resolve => setTimeout(resolve, 1100)); // Wait > 1s
                } else if (priceRes.ok) {
                    pData = await priceRes.json();
                    break;
                } else {
                    console.error(`SSI API Error: ${priceRes.status} ${priceRes.statusText}`);
                    break;
                }
            }

            if (pData && pData.data && pData.data.length > 0) {
                console.log(`[vnindex-history] Parsing ${pData.data.length} records for range: ${startDateStr} - ${toDateStr}`);
                for (const rec of pData.data) {
                    const tradingDate = rec.TradingDate || rec.tradingDate;
                    // Coverage for multiple possible field names from various SSI API versions
                    const indexValue = rec.IndexValue !== undefined ? rec.IndexValue : 
                                      (rec.indexValue !== undefined ? rec.indexValue : 
                                      (rec.ClosePrice !== undefined ? rec.ClosePrice : 
                                      (rec.closePrice !== undefined ? rec.closePrice : 
                                      (rec.Close !== undefined ? rec.Close : rec.close))));

                    if (tradingDate && indexValue !== undefined) {
                        const [d, m, yStr] = tradingDate.split('/');
                        const ddStr = d.padStart(2, '0');
                        const mmStr = m.padStart(2, '0');
                        const yyStrShort = yStr.substring(2);
                        const formattedDateYYMMDD = `${yyStrShort}${mmStr}${ddStr}`;
                        const formattedDateYYYYMMDD = `${yStr}${mmStr}${ddStr}`;
                        const val = parseFloat(indexValue);
                        if (!isNaN(val)) {
                            historyMap[formattedDateYYMMDD] = val;
                            historyMap[formattedDateYYYYMMDD] = val;
                            historyMap[`${yStr}-${mmStr}-${ddStr}`] = val;
                        }
                    }
                }
            } else {
                console.warn(`[vnindex-history] No data returned from SSI for range: ${startDateStr} - ${toDateStr}`);
            }
            // Move start to next chunk
            currentStart = new Date(currentEnd.getTime());
            currentStart.setDate(currentStart.getDate() + 1);
        }

        // Map requested dates to fetched historical prices
        for (const date of dates) {
            const priceAtCall = historyMap[date] || null;
            if (priceAtCall === null) {
                console.warn(`[vnindex-history] Missing price for date: ${date}`);
            }
            const key = `VNINDEX_${date}`;
            prices[key] = {
                priceAtCall
            };
        }

        console.log(`[vnindex-history] Returning prices for ${Object.keys(prices).length} dates.`);
        return NextResponse.json({ prices });
    } catch (error) {
        console.error('Error fetching VNINDEX history:', error);
        return NextResponse.json({ error: 'Failed to fetch VNINDEX history' }, { status: 500 });
    }
}
