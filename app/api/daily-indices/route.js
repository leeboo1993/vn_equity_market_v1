import { getSSIAccessToken } from '@/lib/data';
import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';
import { RSI, MACD, SMA } from 'technicalindicators';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '@/auth';

const r2Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

export const dynamic = 'force-dynamic';

// Configuration cache
let cachedConfig = null;
let lastCacheUpdate = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getIndexConfig() {
    const now = Date.now();
    if (cachedConfig && (now - lastCacheUpdate < CACHE_TTL)) {
        return cachedConfig;
    }

    try {
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: "config/indices.json",
        });
        const response = await r2Client.send(command);
        const str = await response.Body.transformToString();
        cachedConfig = JSON.parse(str);
        lastCacheUpdate = now;
        return cachedConfig;
    } catch (error) {
        console.error('Error fetching indices config:', error);
        // Fallback or throw
        return [
            { id: 'VNINDEX', ssiId: 'VNINDEX', name: 'VN-Index', region: 'Vietnam', source: 'ssi', vnDirectId: 'VNINDEX' },
            { id: 'SPX', yfId: '^GSPC', name: 'S&P 500', region: 'USA', source: 'yahoo', proxyId: 'SPY' }
        ];
    }
}

async function getVNDirectRatios(symbol) {
    const url = `https://finfo-api.vndirect.com.vn/v4/ratios/latest?filter=itemCode:51025,51023&where=code:${symbol}`;
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.vndirect.com.vn/',
                'Origin': 'https://www.vndirect.com.vn'
            },
            next: { revalidate: 3600 } // Cache for 1 hour
        });
        const data = await res.json();
        let pe = 14.97, pb = 1.7; // default fallbacks
        if (data.data && data.data.length > 0) {
            data.data.forEach(item => {
                if (item.itemCode === '51025') pe = item.value;
                if (item.itemCode === '51023') pb = item.value;
            });
            return { pe, pb };
        }
        throw new Error('No data from VNDirect');
    } catch (e) {
        console.error(`VNDirect fetch failed for ${symbol}, trying market.json fallback`, e);
        try {
            // Fallback: Read from market.json in R2
            const command = new GetObjectCommand({
                Bucket: process.env.R2_BUCKET,
                Key: "cafef_data/dl_equity/market.json",
            });
            const response = await r2Client.send(command);
            const str = await response.Body.transformToString();
            const mData = JSON.parse(str);
            if (mData.vn_index && mData.vn_index.length > 0) {
                // Find latest entry for this index
                const sorted = mData.vn_index.sort((a, b) => b.date.localeCompare(a.date));
                const latest = sorted[0];
                return {
                    pe: latest.pe || 14.97,
                    pb: latest.pb || 1.7
                };
            }
        } catch (err) {
            console.error('Market.json fallback failed', err);
        }
        return { pe: 14.97, pb: 1.7 };
    }
}

async function getSSIData(token) {
    const INDEX_CONFIG = await getIndexConfig();
    const now = new Date();
    const formatDateSSI = (date) => {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}/${m}/${y}`;
    };

    const todayStr = formatDateSSI(now);
    const pastDate = new Date(now);
    pastDate.setDate(now.getDate() - 28); // SSI max range = 30 days
    const startDateStr = formatDateSSI(pastDate);

    const ssiIndices = INDEX_CONFIG.filter(i => i.source === 'ssi');
    const results = {};

    for (const config of ssiIndices) {
        const url = `https://fc-data.ssi.com.vn/api/v2/Market/DailyIndex?indexId=${config.ssiId}&fromDate=${startDateStr}&toDate=${todayStr}&pageIndex=1&pageSize=100`;
        try {
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) {
                const pData = await res.json();
                if (pData.data && pData.data.length > 0) {
                    const sorted = pData.data.sort((a, b) => {
                        const [d1, m1, y1] = a.TradingDate.split('/');
                        const [d2, m2, y2] = b.TradingDate.split('/');
                        return new Date(`${y1}-${m1}-${d1}`) - new Date(`${y2}-${m2}-${d2}`);
                    });

                    const latest = sorted[sorted.length - 1];
                    const closes = sorted.map(d => parseFloat(d.IndexValue || 0)).filter(v => !isNaN(v));

                    if (closes.length > 20) {
                        const recentRange = closes.slice(-20);
                        const support = Math.min(...recentRange);
                        const resistance = Math.max(...recentRange);
                        const close = parseFloat(latest.IndexValue || 0);

                        const ratios = await getVNDirectRatios(config.vnDirectId);

                        results[config.id] = {
                            id: config.id,
                            name: config.name,
                            region: config.region,
                            date: latest.TradingDate,
                            close: close,
                            d1: parseFloat(latest.RatioChange || 0),
                            turnover: parseFloat(latest.TotalMatchVal || 0) / 1000000 / 25400,
                            pe: ratios.pe,
                            pb: ratios.pb,
                            rsi: Math.round(RSI.calculate({ values: closes, period: 14 }).pop() || 0),
                            ma20: Math.round(SMA.calculate({ values: closes, period: 20 }).pop() || 0),
                            macd: (MACD.calculate({
                                values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false
                            }).pop()?.MACD || 0).toFixed(2),
                            support: Math.round(support * 100) / 100,
                            resistance: Math.round(resistance * 100) / 100,
                            ytd: parseFloat(latest.RatioChange || 0)
                        };
                    }
                }
            }
            await new Promise(r => setTimeout(r, 200)); // Throttle
        } catch (e) {
            console.error(`SSI error for ${config.id}`, e);
        }
    }
    return results;
}

async function getYahooData() {
    const INDEX_CONFIG = await getIndexConfig();
    const results = {};
    const yahooIndices = INDEX_CONFIG.filter(i => i.source === 'yahoo');

    for (const config of yahooIndices) {
        try {
            const queryOptions = { period1: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000) }; // 150 days
            const chart = await yahooFinance.chart(config.yfId, queryOptions);
            const quotes = chart.quotes;

            if (quotes && quotes.length > 0) {
                const validQuotes = quotes.filter(q => q.close != null && !isNaN(q.close));
                const latest = validQuotes[validQuotes.length - 1];
                const prev = validQuotes[validQuotes.length - 2];
                const closes = validQuotes.map(d => d.close);

                const d1 = ((latest.close - prev.close) / prev.close) * 100;

                const recentRange = closes.slice(-20);
                const support = Math.min(...recentRange);
                const resistance = Math.max(...recentRange);

                // Fetch Proxy ETF stats for fundamentals
                const proxySummary = await yahooFinance.quoteSummary(config.proxyId, { modules: ['summaryDetail', 'defaultKeyStatistics'] });
                const pe = proxySummary.summaryDetail?.trailingPE || 25;
                const pb = proxySummary.defaultKeyStatistics?.priceToBook || 4;

                let dateStr = "N/A";
                if (latest.date) {
                    const d = new Date(latest.date);
                    dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                }

                results[config.id] = {
                    id: config.id,
                    name: config.name,
                    region: config.region,
                    date: dateStr,
                    close: latest.close,
                    d1: d1,
                    turnover: (latest.volume * latest.close) / 1000000 || 0,
                    pe: parseFloat(pe.toFixed(2)),
                    pb: parseFloat(pb.toFixed(2)),
                    rsi: Math.round(RSI.calculate({ values: closes, period: 14 }).pop() || 0),
                    ma20: Math.round(SMA.calculate({ values: closes, period: 20 }).pop() || 0),
                    macd: (MACD.calculate({
                        values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false
                    }).pop()?.MACD || 0).toFixed(2),
                    support: Math.round(support * 100) / 100,
                    resistance: Math.round(resistance * 100) / 100,
                    ytd: d1
                };
            }
        } catch (e) {
            console.error(`Yahoo error for ${config.id}`, e);
        }
    }
    return results;
}

export async function GET() {
    try {
        const token = await getSSIAccessToken();

        const [ssiResults, yahooResults] = await Promise.all([
            getSSIData(token),
            getYahooData()
        ]);

        return NextResponse.json({
            indices: { ...ssiResults, ...yahooResults }
        });
    } catch (error) {
        console.error('Error in daily-indices API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
