import { getSSIAccessToken } from '@/lib/data';
import { NextResponse } from 'next/server';
import { RSI, MACD, SMA } from 'technicalindicators';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';


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
            // Vietnam
            { id: 'VNINDEX', ssiId: 'VNINDEX', name: 'VN-Index', region: 'Vietnam', source: 'ssi', vnDirectId: 'VNINDEX' },
            { id: 'HNXINDEX', ssiId: 'HNXINDEX', name: 'HNX-Index', region: 'Vietnam', source: 'ssi', vnDirectId: 'HNXINDEX' },
            { id: 'VN30', ssiId: 'VN30', name: 'VN30', region: 'Vietnam', source: 'ssi', vnDirectId: 'VNINDEX' },
            // USA
            { id: 'SPX', yfId: '^GSPC', name: 'S&P 500', region: 'USA', source: 'yahoo' },
            { id: 'NASDAQ', yfId: '^IXIC', name: 'Nasdaq', region: 'USA', source: 'yahoo' },
            { id: 'DJI', yfId: '^DJI', name: 'Dow Jones', region: 'USA', source: 'yahoo' },
            // Europe
            { id: 'FTSE', yfId: '^FTSE', name: 'FTSE 100', region: 'UK', source: 'yahoo' },
            { id: 'DAX', yfId: '^GDAXI', name: 'DAX', region: 'Germany', source: 'yahoo' },
            { id: 'CAC40', yfId: '^FCHI', name: 'CAC 40', region: 'France', source: 'yahoo' },
            // China
            { id: 'SSE', yfId: '000001.SS', name: 'Shanghai (SSE)', region: 'China', source: 'yahoo' },
            { id: 'CSI300', yfId: '000300.SS', name: 'CSI 300', region: 'China', source: 'yahoo' },
            { id: 'HSI', yfId: '^HSI', name: 'Hang Seng', region: 'Hong Kong', source: 'yahoo' },
            // Asia
            { id: 'N225', yfId: '^N225', name: 'Nikkei 225', region: 'Japan', source: 'yahoo' },
            { id: 'KOSPI', yfId: '^KS11', name: 'KOSPI', region: 'Korea', source: 'yahoo' },
            { id: 'ASX200', yfId: '^AXJO', name: 'ASX 200', region: 'Australia', source: 'yahoo' },
            { id: 'STI', yfId: '^STI', name: 'STI', region: 'Singapore', source: 'yahoo' },
        ];
    }
}

let cachedVNRatios = null;
let cachedVNRatiosTime = 0;

async function getVNDirectRatios(symbol) {
    // Try R2 market.json first (updated daily, fast)
    try {
        // Cache for 30 min within same process
        if (cachedVNRatios && Date.now() - cachedVNRatiosTime < 30 * 60 * 1000) {
            return cachedVNRatios[symbol] || { pe: null, pb: null };
        }
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: 'cafef_data/dl_equity/market.json',
        });
        const response = await r2Client.send(command);
        const str = await response.Body.transformToString();
        const mData = JSON.parse(str);
        // market.json may have vn_index array sorted by date
        const build = {};
        if (mData.vn_index && mData.vn_index.length > 0) {
            const sorted = [...mData.vn_index].sort((a, b) => b.date.localeCompare(a.date));
            const latest = sorted[0];
            build['VNINDEX'] = { pe: latest.pe || null, pb: latest.pb || null };
        }
        if (Object.keys(build).length > 0) {
            cachedVNRatios = build;
            cachedVNRatiosTime = Date.now();
            return build[symbol] || { pe: null, pb: null };
        }
    } catch (e) {
        console.error('R2 market.json failed, trying VNDirect live', e.message);
    }

    // Fallback: live VNDirect API (with timeout)
    try {
        const url = `https://finfo-api.vndirect.com.vn/v4/ratios/latest?filter=itemCode:51025,51023&where=code:${symbol}`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://www.vndirect.com.vn/',
            },
            signal: AbortSignal.timeout(5000),
        });
        const data = await res.json();
        let pe = null, pb = null;
        if (data.data && data.data.length > 0) {
            data.data.forEach(item => {
                if (item.itemCode === '51025') pe = item.value;
                if (item.itemCode === '51023') pb = item.value;
            });
            return { pe, pb };
        }
    } catch (e) {
        console.error(`VNDirect fallback failed for ${symbol}:`, e.message);
    }
    return { pe: null, pb: null };
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
    pastDate.setDate(now.getDate() - 30); // SSI max range = 30 days
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

                    if (closes.length > 2) {
                        const recentRange = closes.slice(-Math.min(20, closes.length));
                        const support = Math.min(...recentRange);
                        const resistance = Math.max(...recentRange);
                        const close = parseFloat(latest.IndexValue || 0);

                        const ratios = await getVNDirectRatios(config.vnDirectId);
                        const rsiValues = closes.length >= 14 ? RSI.calculate({ values: closes, period: 14 }) : [];
                        const maValues = closes.length >= 15 ? SMA.calculate({ values: closes, period: Math.min(20, closes.length) }) : [];
                        const macdValues = closes.length >= 27 ? MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false }) : [];

                        // SSI only has 30 days — compute available period returns
                        const prevClose = closes[0]; // earliest in window (≈30 days)
                        const d1 = parseFloat(latest.RatioChange || 0);

                        results[config.id] = {
                            id: config.id,
                            name: config.name,
                            region: config.region,
                            date: latest.TradingDate,
                            close: close,
                            d1,
                            d1m: closes.length >= 20 ? calcPctChg(closes[closes.length - 20], close) : null,
                            d3m: null, // SSI window too short
                            d6m: null,
                            d12m: null,
                            ytd: null, // would need full year data
                            turnover: parseFloat(latest.TotalMatchVal || 0) / 1000000 / 25400,
                            pe: ratios.pe,
                            pb: ratios.pb,
                            rsi: rsiValues.length ? Math.round(rsiValues[rsiValues.length - 1]) : null,
                            ma20: maValues.length ? Math.round(maValues[maValues.length - 1]) : null,
                            macd: macdValues.length ? parseFloat((macdValues[macdValues.length - 1]?.MACD || 0).toFixed(2)) : null,
                            support: Math.round(support * 100) / 100,
                            resistance: Math.round(resistance * 100) / 100,
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

const calcPctChg = (from, to) => from && to ? parseFloat(((to - from) / from * 100).toFixed(2)) : null;

// Per-index result cache: serves stale data when live fetch fails
const yahooCache = {};

async function fetchOneYahoo(config) {
    const period1 = Math.floor((Date.now() - 400 * 24 * 60 * 60 * 1000) / 1000); // 400 days for 12M returns
    const period2 = Math.floor(Date.now() / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.yfId)}?period1=${period1}&period2=${period2}&interval=1d`;

    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error('No result');

    const timestamps = result.timestamp || [];
    const closePrices = result.indicators?.quote?.[0]?.close || [];
    const meta = result.meta || {};

    const validPairs = timestamps
        .map((ts, i) => ({ date: new Date(ts * 1000), close: closePrices[i] }))
        .filter(p => p.close != null && !isNaN(p.close));

    if (validPairs.length < 2) throw new Error('Insufficient data');

    const latest = validPairs[validPairs.length - 1];
    const prev = validPairs[validPairs.length - 2];
    const closes = validPairs.map(p => p.close);
    const d1 = ((latest.close - prev.close) / prev.close) * 100;

    // Find close price approximately N calendar days ago
    const findClose = (daysBack) => {
        const target = Date.now() - daysBack * 24 * 60 * 60 * 1000;
        return [...validPairs].reverse().find(p => p.date.getTime() <= target)?.close ?? null;
    };

    // YTD reference: last close on or before Jan 1
    const jan1 = new Date(new Date().getFullYear(), 0, 1).getTime();
    const ytdRef = [...validPairs].reverse().find(p => p.date.getTime() <= jan1)?.close ?? null;

    const recentRange = closes.slice(-Math.min(20, closes.length));
    const dateStr = `${String(latest.date.getDate()).padStart(2, '0')}/${String(latest.date.getMonth() + 1).padStart(2, '0')}/${latest.date.getFullYear()}`;

    const rsiVals = closes.length >= 15 ? RSI.calculate({ values: closes, period: 14 }) : [];
    const maVals = closes.length >= 20 ? SMA.calculate({ values: closes, period: 20 }) : [];
    const macdVals = closes.length >= 27 ? MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false }) : [];

    // Fetch PE from Yahoo quoteSummary in parallel (best effort)
    let pe = meta.trailingPE ? parseFloat(meta.trailingPE.toFixed(2)) : null;
    try {
        const sumUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(config.yfId)}?modules=summaryDetail`;
        const sumRes = await fetch(sumUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' }, signal: AbortSignal.timeout(5000) });
        if (sumRes.ok) {
            const sumJson = await sumRes.json();
            const raw = sumJson?.quoteSummary?.result?.[0]?.summaryDetail?.trailingPE?.raw;
            if (raw) pe = parseFloat(raw.toFixed(2));
        }
    } catch (_) { /* ignore */ }

    return {
        id: config.id, name: config.name, region: config.region,
        date: dateStr,
        close: parseFloat(latest.close.toFixed(2)),
        d1: parseFloat(d1.toFixed(2)),
        d1m: calcPctChg(findClose(30), latest.close),
        d3m: calcPctChg(findClose(91), latest.close),
        d6m: calcPctChg(findClose(182), latest.close),
        d12m: calcPctChg(findClose(365), latest.close),
        ytd: calcPctChg(ytdRef, latest.close),
        turnover: null, pe, pb: null,
        rsi: rsiVals.length ? Math.round(rsiVals[rsiVals.length - 1]) : null,
        ma20: maVals.length ? Math.round(maVals[maVals.length - 1]) : null,
        macd: macdVals.length ? parseFloat((macdVals[macdVals.length - 1]?.MACD || 0).toFixed(2)) : null,
        support: Math.round(Math.min(...recentRange) * 100) / 100,
        resistance: Math.round(Math.max(...recentRange) * 100) / 100,
        stale: false
    };
}

async function getYahooData() {
    const INDEX_CONFIG = await getIndexConfig();
    const yahooIndices = INDEX_CONFIG.filter(i => i.source === 'yahoo');

    // Fetch ALL in parallel — no sequential delays
    const settled = await Promise.allSettled(yahooIndices.map(c => fetchOneYahoo(c)));

    const results = {};
    settled.forEach((outcome, i) => {
        const config = yahooIndices[i];
        if (outcome.status === 'fulfilled') {
            yahooCache[config.id] = outcome.value;          // update cache
            results[config.id] = outcome.value;
        } else {
            console.error(`Yahoo failed for ${config.yfId}: ${outcome.reason?.message}`);
            // Serve cached data with a stale flag so user knows
            if (yahooCache[config.id]) {
                results[config.id] = { ...yahooCache[config.id], stale: true };
            }
        }
    });
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
