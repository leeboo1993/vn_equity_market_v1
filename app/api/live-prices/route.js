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
        let tickersParam = searchParams.get('tickers');

        if (!tickersParam) {
            return NextResponse.json({ error: "No tickers provided" }, { status: 400 });
        }

        // Clean up tickers
        const tickers = tickersParam.split(',').map(t => t.trim().toUpperCase()).join(',');

        // We use a high-frequency public datafeed (VPS) to bypass the SSI FC-Data 1 req/sec limit 
        // and to obtain the actual Layer 2 order book (Bids/Asks) which FC-Data REST does not provide.
        const url = `https://bgapidatafeed.vps.com.vn/getliststockdata/${tickers}`;

        const res = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            cache: 'no-store'
        });

        if (!res.ok) {
            throw new Error("Failed to fetch order book data");
        }

        const rawData = await res.json();
        const priceData = {};

        // Parse VPS format
        // g1, g2, g3 = Bid 1, 2, 3
        // g4, g5, g6 = Ask 1, 2, 3
        const parseG = (gStr) => {
            if (!gStr) return { p: 0, v: 0 };
            const parts = gStr.split('|');
            return {
                p: (parseFloat(parts[0]) || 0) * 1000,
                v: (parseFloat(parts[1]) || 0) * 10
            };
        };

        rawData.forEach(item => {
            if (!item.sym) return;

            const b1 = parseG(item.g1);
            const b2 = parseG(item.g2);
            const b3 = parseG(item.g3);
            const a1 = parseG(item.g4);
            const a2 = parseG(item.g5);
            const a3 = parseG(item.g6);

            priceData[item.sym] = {
                price: (parseFloat(item.lastPrice || 0) * 1000),
                matchVol: (parseFloat(item.lastVolume || 0) * 10),
                totalVol: parseFloat(item.totalVol || item.fBVol || 0) * 10,
                ref: (parseFloat(item.r || 0) * 1000),
                ceil: (parseFloat(item.c || 0) * 1000),
                floor: (parseFloat(item.f || 0) * 1000),

                // Bids
                b1p: b1.p, b1v: b1.v,
                b2p: b2.p, b2v: b2.v,
                b3p: b3.p, b3v: b3.v,

                // Asks
                a1p: a1.p, a1v: a1.v,
                a2p: a2.p, a2v: a2.v,
                a3p: a3.p, a3v: a3.v,

                // Range and Foreign 
                high: (parseFloat(item.highPrice || 0) * 1000),
                low: (parseFloat(item.lowPrice || 0) * 1000),
                avg: (parseFloat(item.avePrice || 0) * 1000),
                fBuy: (parseFloat(item.fBVol || 0) * 10),
                fSell: (parseFloat(item.fSVolume || 0) * 10),

                date: new Date().toISOString()
            };
        });

        // SSI Index Cache and Futures Fallback
        const INDEX_CACHE_TTL = 60 * 1000; // 60 seconds
        if (typeof global.indexCache === 'undefined') {
            global.indexCache = { data: null, expires: 0 };
        }

        const tickersStr = tickersParam.toUpperCase();
        if ((tickersStr.includes('VNINDEX') || tickersStr.includes('VN30')) && Date.now() > global.indexCache.expires) {
            try {
                const ssiToken = await getAccessToken();

                // Construct date range (T-7 to T0) for weekends
                const dTo = new Date();
                const dFrom = new Date();
                dFrom.setDate(dFrom.getDate() - 7);

                const fmtDate = (d) => {
                    const dd = String(d.getDate()).padStart(2, '0');
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const yyyy = d.getFullYear();
                    return `${dd}/${mm}/${yyyy}`;
                };

                const fromStr = fmtDate(dFrom);
                const toStr = fmtDate(dTo);

                const fetchIndex = async (idxName) => {
                    const idxRes = await fetch(`https://fc-data.ssi.com.vn/api/v2/Market/DailyIndex?indexId=${idxName}&fromDate=${fromStr}&toDate=${toStr}&pageIndex=1&pageSize=10`, {
                        headers: { "Authorization": `Bearer ${ssiToken}` }
                    });
                    return await idxRes.json();
                };

                // Fetch Futures via DNSE Entrade (Public, No Auth)
                const fetchFuturesDNSE = async (sym) => {
                    const toTime = Math.floor(Date.now() / 1000);
                    const fromTime = toTime - (7 * 24 * 60 * 60); // 7 days ago
                    const res = await fetch(`https://services.entrade.com.vn/chart-api/v2/ohlcs/derivative?resolution=1D&symbol=${sym}&from=${fromTime}&to=${toTime}`);
                    if (!res.ok) return null;
                    const data = await res.json();

                    if (data && data.t && data.t.length > 0) {
                        const lastIdx = data.t.length - 1;
                        const prevIdx = lastIdx > 0 ? lastIdx - 1 : lastIdx;

                        const close = data.c[lastIdx];
                        const ref = lastIdx > 0 ? data.c[prevIdx] : close;

                        return {
                            symbol: sym,
                            price: close,
                            change: (close - ref),
                            pctChange: ref > 0 ? ((close - ref) / ref) * 100 : 0,
                            high: data.h[lastIdx],
                            low: data.l[lastIdx],
                            ref: ref,
                            totalVol: data.v[lastIdx]
                        };
                    }
                    return null;
                };

                const [vnindexData, vn30Data, f1mData, f2mData] = await Promise.all([
                    fetchIndex('VNINDEX'),
                    (async () => { await new Promise(r => setTimeout(r, 1200)); return fetchIndex('VN30'); })(),
                    fetchFuturesDNSE('VN30F1M'),
                    fetchFuturesDNSE('VN30F2M')
                ]);

                const ssiPrices = {};

                const processData = (indexData) => {
                    if ((indexData.status === 200 || String(indexData.status).toLowerCase() === 'success') && indexData.data) {
                        const sortedData = indexData.data.sort((a, b) => {
                            const parse = (s) => {
                                if (!s) return 0;
                                const parts = s.split('/');
                                return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
                            };
                            return parse(b.TradingDate) - parse(a.TradingDate);
                        });

                        if (sortedData.length > 0) {
                            let idx = sortedData[0];
                            let priceVal = 0;
                            for (const entry of sortedData) {
                                priceVal = parseFloat(entry.IndexValue || entry.indexValue || entry.ClosePrice || entry.closePrice || 0);
                                if (priceVal > 0) {
                                    idx = entry;
                                    break;
                                }
                            }

                            const sym = (idx.IndexId || idx.indexId || idx.Symbol || idx.symbol || '').toUpperCase();
                            if (sym) {
                                let changeVal = idx.Change !== undefined ? parseFloat(idx.Change || idx.change || 0) : parseFloat(idx.PriceChange || idx.priceChange || 0);
                                let pctVal = parseFloat(idx.RatioChange || idx.pctChange || idx.PerPriceChange || idx.perPriceChange || 0);

                                if (Math.abs(changeVal) < 1 && Math.abs(pctVal) > 0.01 && priceVal > 100) {
                                    changeVal *= 100;
                                }

                                ssiPrices[sym] = {
                                    price: priceVal,
                                    change: changeVal,
                                    pctChange: pctVal,
                                    totalVol: parseFloat(idx.TotalVol || idx.totalQuantity || idx.TotalTradedVol || idx.totalTradedVol || 0),
                                    totalVal: parseFloat(idx.TotalVal || idx.totalValue || idx.TotalTradedValue || idx.totalTradedValue || 0),
                                    advances: parseInt(idx.Advances || idx.advances || 0),
                                    declines: parseInt(idx.Declines || idx.declines || 0),
                                    noChanges: parseInt(idx.NoChanges || idx.noChanges || 0),
                                    ceilings: parseInt(idx.Ceilings || idx.ceilings || 0),
                                    floors: parseInt(idx.Floors || idx.floors || 0),
                                    ref: parseFloat(idx.RefPrice || idx.refPrice || 0),
                                    high: parseFloat(idx.HighestPrice || idx.highestPrice || 0),
                                    low: parseFloat(idx.LowestPrice || idx.lowestPrice || 0),
                                    date: idx.TradingDate || idx.tradingDate || '',
                                    time: idx.Time || idx.time || '',
                                    isIndex: true,
                                    isSnapshot: true
                                };
                            }
                        }
                    }
                };

                processData(vnindexData);
                processData(vn30Data);

                // Add Futures directly to cache
                if (f1mData) ssiPrices['VN30F1M'] = f1mData;
                if (f2mData) ssiPrices['VN30F2M'] = f2mData;

                global.indexCache = {
                    data: ssiPrices,
                    expires: Date.now() + INDEX_CACHE_TTL
                };
            } catch (idxError) {
                console.warn("Could not fetch SSI Index/Futures Data:", idxError.message);
            }
        }

        // Apply Cached or Fresh SSI Data
        if (global.indexCache.data) {
            Object.assign(priceData, global.indexCache.data);
        }


        return NextResponse.json({ prices: priceData });

    } catch (error) {
        console.error("Live Prices API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
