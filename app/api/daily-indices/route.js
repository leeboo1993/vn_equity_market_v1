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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ── Configuration ────────────────────────────────────────────────────────────
async function getIndexConfig() {
    return [
        { id: 'VNINDEX', ssiId: 'VNINDEX', name: 'VN-Index', region: 'Vietnam', source: 'ssi', vnDirectId: 'VNINDEX' },
        { id: 'HNXINDEX', ssiId: 'HNXINDEX', name: 'HNX-Index', region: 'Vietnam', source: 'ssi', vnDirectId: 'HNXINDEX' },
        { id: 'VN30', ssiId: 'VN30', name: 'VN30', region: 'Vietnam', source: 'ssi', vnDirectId: 'VNINDEX' },
        { id: 'SPX', stooqId: '^spx', yfId: '^GSPC', name: 'S&P 500', region: 'USA', source: 'yahoo' },
        { id: 'NASDAQ', stooqId: '^ndx', yfId: '^IXIC', name: 'Nasdaq', region: 'USA', source: 'yahoo' },
        { id: 'DJI', stooqId: '^dji', yfId: '^DJI', name: 'Dow Jones', region: 'USA', source: 'yahoo' },
        { id: 'FTSE', stooqId: null, yfId: '^FTSE', name: 'FTSE 100', region: 'UK', source: 'yahoo' },
        { id: 'DAX', stooqId: '^dax', yfId: '^GDAXI', name: 'DAX', region: 'Germany', source: 'yahoo' },
        { id: 'CAC40', stooqId: '^cac', yfId: '^FCHI', name: 'CAC 40', region: 'France', source: 'yahoo' },
        { id: 'SSE', stooqId: null, yfId: '000001.SS', name: 'Shanghai (SSE)', region: 'China', source: 'yahoo' },
        { id: 'CSI300', stooqId: null, yfId: '000300.SS', name: 'CSI 300', region: 'China', source: 'yahoo' },
        { id: 'HSI', stooqId: '^hsi', yfId: '^HSI', name: 'Hang Seng', region: 'Hong Kong', source: 'yahoo' },
        { id: 'N225', stooqId: '^nkx', yfId: '^N225', name: 'Nikkei 225', region: 'Japan', source: 'yahoo' },
        { id: 'KOSPI', stooqId: null, yfId: '^KS11', name: 'KOSPI', region: 'Korea', source: 'yahoo' },
        { id: 'ASX200', stooqId: null, yfId: '^AXJO', name: 'ASX 200', region: 'Australia', source: 'yahoo' },
        { id: 'STI', stooqId: null, yfId: '^STI', name: 'STI', region: 'Singapore', source: 'yahoo' },
    ];
}

const calcPctChg = (from, to) => from && to ? parseFloat(((to - from) / from * 100).toFixed(2)) : null;

// ── Valuation ────────────────────────────────────────────────────────────────
let cachedRatios = null;
let cachedRatiosTime = 0;

async function getValuationRatios(symbol) {
    try {
        if (cachedRatios && Date.now() - cachedRatiosTime < 30 * 60 * 1000) {
            return cachedRatios[symbol] || { pe: null, pb: null };
        }
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: 'cafef_data/dl_equity/market.json',
        });
        const res = await r2Client.send(command).catch(() => null);
        if (res) {
            const str = await res.Body.transformToString();
            const mData = JSON.parse(str);
            const build = {};
            if (mData.vn_index && mData.vn_index.length > 0) {
                const latest = [...mData.vn_index].sort((a, b) => b.date.localeCompare(a.date))[0];
                build['VNINDEX'] = { pe: latest.pe, pb: latest.pb };
                build['VN30'] = { pe: latest.pe, pb: latest.pb };
                build['HNXINDEX'] = { pe: 16.1, pb: 1.25 };
            }
            cachedRatios = build;
            cachedRatiosTime = Date.now();
            return build[symbol] || { pe: null, pb: null };
        }
    } catch (e) { }
    return { pe: null, pb: null };
}

// ── SSI (Vietnam) ────────────────────────────────────────────────────────────
async function getSSIData(token) {
    const configList = await getIndexConfig();
    const ssiIndices = configList.filter(i => i.source === 'ssi');
    const results = {};

    const formatDate = (date) => {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        return `${d}/${m}/${date.getFullYear()}`;
    };

    const dNow = new Date();
    const todayStr = formatDate(dNow);
    const dPast = new Date(dNow.getTime() - 28 * 24 * 60 * 60 * 1000);
    const startStr = formatDate(dPast);

    for (const config of ssiIndices) {
        try {
            await sleep(1000); // 1s delay to avoid 429 on SSI
            const url = `https://fc-data.ssi.com.vn/api/v2/Market/DailyIndex?indexId=${config.ssiId}&fromDate=${startStr}&toDate=${todayStr}&pageIndex=1&pageSize=100`;
            const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
            if (!res.ok) continue;
            const pData = await res.json();
            if (pData.data && pData.data.length > 0) {
                const sorted = pData.data.sort((a, b) => {
                    const [d1, m1, y1] = a.TradingDate.split('/');
                    const [d2, m2, y2] = b.TradingDate.split('/');
                    return new Date(`${y1}-${m1}-${d1}`) - new Date(`${y2}-${m2}-${d2}`);
                });
                const latest = sorted[sorted.length - 1];
                const closes = sorted.map(d => parseFloat(d.IndexValue)).filter(v => !isNaN(v));
                if (closes.length < 2) continue;

                const ratios = await getValuationRatios(config.id);
                const rsi = RSI.calculate({ values: closes, period: 14 });
                const ma = SMA.calculate({ values: closes, period: Math.min(20, closes.length) });
                const recent = closes.slice(-Math.min(20, closes.length));

                results[config.id] = {
                    id: config.id, name: config.name, region: config.region,
                    date: latest.TradingDate,
                    close: parseFloat(latest.IndexValue),
                    d1: parseFloat(latest.RatioChange),
                    d1m: closes.length >= 20 ? calcPctChg(closes[closes.length - 20], parseFloat(latest.IndexValue)) : null,
                    turnover: parseFloat(latest.TotalMatchVal || 0) / 1000000 / 25400,
                    pe: ratios.pe, pb: ratios.pb,
                    rsi: rsi.length ? Math.round(rsi[rsi.length - 1]) : null,
                    ma20: ma.length ? Math.round(ma[ma.length - 1]) : null,
                    support: Math.round(Math.min(...recent) * 100) / 100,
                    resistance: Math.round(Math.max(...recent) * 100) / 100,
                    stale: false
                };
            }
        } catch (e) { console.error(`SSI Fail ${config.id}:`, e.message); }
    }
    return results;
}

// ... (fetchFromStooq, buildGlobalResult, fetchOneGlobal, getGlobalData same as before)
const globalCache = {};
async function fetchFromStooq(stooqId) {
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqId)}&i=d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split('\n');
    if (lines.length < 3 || lines[1].toLowerCase().includes('no data')) throw new Error('No Data');
    return lines.slice(1).map(csvLine => {
        const [date, o, h, lo, c, v] = csvLine.split(',');
        return { date: date.trim(), close: +c, vol: +v };
    }).filter(r => r.close > 0).slice(-420);
}
function buildGlobalResult(config, pairs) {
    if (pairs.length < 2) throw new Error('Short Data');
    const latest = pairs[pairs.length - 1];
    const prev = pairs[pairs.length - 2];
    const closes = pairs.map(p => p.close);
    const findClose = (days) => {
        const t = new Date(latest.date);
        t.setDate(t.getDate() - days);
        return [...pairs].reverse().find(p => new Date(p.date) <= t)?.close ?? null;
    };
    const jan1 = new Date(new Date().getFullYear(), 0, 1);
    const ytdRef = [...pairs].reverse().find(p => new Date(p.date) <= jan1)?.close ?? null;
    const getTO = (p) => (p?.vol && p?.close && p.vol > 0) ? Math.round(p.vol * p.close / 1_000_000) : null;
    const toCur = getTO(latest);
    const toYest = getTO(prev);
    const last10 = pairs.slice(-11, -1).map(p => getTO(p)).filter(v => v != null);
    const toAvg = last10.length > 0 ? Math.round(last10.reduce((s, v) => s + v, 0) / last10.length) : null;
    const rsi = RSI.calculate({ values: closes, period: 14 });
    const ma = SMA.calculate({ values: closes, period: 20 });
    const macd = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
    const d = new Date(latest.date);
    const dateStr = !isNaN(d) ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : latest.date;
    return {
        id: config.id, name: config.name, region: config.region, date: dateStr,
        close: parseFloat(latest.close.toFixed(2)),
        d1: calcPctChg(prev.close, latest.close),
        d1m: calcPctChg(findClose(30), latest.close),
        d3m: calcPctChg(findClose(91), latest.close),
        d6m: calcPctChg(findClose(182), latest.close),
        d12m: calcPctChg(findClose(365), latest.close),
        ytd: calcPctChg(ytdRef, latest.close),
        turnover: toCur, turnoverChgYest: calcPctChg(toYest, toCur), turnoverChg10d: calcPctChg(toAvg, toCur),
        rsi: rsi.length ? Math.round(rsi[rsi.length - 1]) : null,
        ma20: ma.length ? Math.round(ma[ma.length - 1]) : null,
        macd: macd.length ? parseFloat((macd[macd.length - 1]?.MACD || 0).toFixed(2)) : null,
        support: Math.round(Math.min(...closes.slice(-20)) * 100) / 100,
        resistance: Math.round(Math.max(...closes.slice(-20)) * 100) / 100,
        stale: false
    };
}
async function fetchOneGlobal(config) {
    if (config.stooqId) {
        try {
            const rows = await fetchFromStooq(config.stooqId);
            return buildGlobalResult(config, rows);
        } catch (e) { console.warn(`Stooq fail ${config.id}:`, e.message); }
    }
    const p1 = Math.floor((Date.now() - 400 * 24 * 3600 * 1000) / 1000);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.yfId)}?period1=${p1}&period2=${Math.floor(Date.now() / 1000)}&interval=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) throw new Error('No Data');
    const ts = result.timestamp || [];
    const cp = result.indicators?.quote?.[0]?.close || [];
    const vl = result.indicators?.quote?.[0]?.volume || [];
    const pairs = ts.map((t, i) => ({ date: new Date(t * 1000).toISOString().split('T')[0], close: cp[i], vol: vl[i] })).filter(p => p.close != null);
    return buildGlobalResult(config, pairs);
}
async function getGlobalData() {
    const list = await getIndexConfig();
    const globals = list.filter(i => i.source === 'yahoo');
    const settled = await Promise.allSettled(globals.map(c => fetchOneGlobal(c)));
    const results = {};
    settled.forEach((outcome, i) => {
        const config = globals[i];
        if (outcome.status === 'fulfilled') {
            globalCache[config.id] = outcome.value;
            results[config.id] = outcome.value;
        } else if (globalCache[config.id]) {
            results[config.id] = { ...globalCache[config.id], stale: true };
        }
    });
    return results;
}

export async function GET() {
    try {
        const token = await getSSIAccessToken();
        const [vnResults, globalResults] = await Promise.all([
            getSSIData(token),
            getGlobalData()
        ]);
        return NextResponse.json({
            indices: { ...vnResults, ...globalResults }
        });
    } catch (e) {
        console.error('API Error:', e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
