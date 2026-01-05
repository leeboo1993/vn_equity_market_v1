import fs from 'fs';
import path from 'path';
import os from 'os';
import { GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from './r2.js';
import { Readable } from 'stream';
import { parquetRead } from 'hyparquet';
import { getStockInfoMap } from './stockInfo.js';

const dataDirectory = path.join(process.cwd(), 'data');

let cachedReports = null;
let cachedReportMap = null;

// Helper to stream to file
const streamToFile = (stream, filePath) =>
    new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        stream.pipe(file);
        stream.on("error", reject);
        file.on("finish", resolve);
    });

// Date helpers
const toDateInt = (date) => {
    // Standard Date Parse
    const d = new Date(date);
    if (isNaN(d.getTime())) return 0;
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

const parseIssueDate = (val) => {
    if (!val) return 0;
    const str = String(val).trim();
    if (str.length === 6 && !isNaN(str)) {
        // User confirmed JSON uses YYMMDD format
        // Try YYMMDD first
        const yy = parseInt(str.slice(0, 2));
        const mm = parseInt(str.slice(2, 4));
        const dd = parseInt(str.slice(4, 6));
        const year_yymmdd = 2000 + yy;

        // Check if YYMMDD gives reasonable year (2000-2027)
        const isValidYYMMDD = (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && year_yymmdd <= 2027);

        if (isValidYYMMDD) {
            return year_yymmdd * 10000 + mm * 100 + dd;
        }

        // If year > 2027 (e.g., "311223" -> 2031), try DDMMYY interpretation
        const dd2 = parseInt(str.slice(0, 2));
        const mm2 = parseInt(str.slice(2, 4));
        const yy2 = parseInt(str.slice(4, 6));
        const year_ddmmyy = 2000 + yy2;

        if (mm2 >= 1 && mm2 <= 12 && dd2 >= 1 && dd2 <= 31 && year_ddmmyy <= 2027) {
            return year_ddmmyy * 10000 + mm2 * 100 + dd2;
        }

        // Fallback: cap the year at 2027
        const cappedYear = Math.min(year_yymmdd, 2027);
        return cappedYear * 10000 + mm * 100 + dd;
    }
    return toDateInt(val);
};

const intToDateObj = (dateInt) => {
    const year = Math.floor(dateInt / 10000);
    const month = Math.floor((dateInt % 10000) / 100);
    const day = dateInt % 100;
    return new Date(year, month - 1, day);
};

const addMonths = (dateInt, months) => {
    const year = Math.floor(dateInt / 10000);
    const month = Math.floor((dateInt % 10000) / 100);
    const day = dateInt % 100;
    const d = new Date(year, month - 1 + months, day);
    return toDateInt(d);
};

// Helper to enrich a single report
function enrichReport(report, historyMap, stockInfoMap) {
    const ticker = report.info_of_report?.ticker;
    if (!ticker) return report;

    let rec = report.recommendation ? { ...report.recommendation } : {};
    let info = report.info_of_report ? { ...report.info_of_report } : {};

    const hist = historyMap.get(ticker);

    if (hist && hist.dates.length > 0) {
        // A. Price Now
        const lastDate = hist.dates[hist.dates.length - 1];
        const priceNow = hist.prices[lastDate];
        if (priceNow) {
            rec.price_now = priceNow;
            rec.current_price = priceNow;
        }

        // B. Price At Call
        if (info.date_of_issue) {
            const issueInt = parseIssueDate(info.date_of_issue);
            if (issueInt > 0) {
                let priceAtCall = hist.prices[issueInt];
                if (!priceAtCall) {
                    const nearest = hist.dates.find(d => d >= issueInt);
                    if (nearest) priceAtCall = hist.prices[nearest];
                }
                if (priceAtCall) rec.price_at_call = priceAtCall;

                // D. Forward Returns
                if (priceAtCall) {
                    const calcReturn = (months) => {
                        const targetDate = addMonths(issueInt, months);
                        const foundDate = hist.dates.find(d => d >= targetDate);
                        if (foundDate) {
                            const pFuture = hist.prices[foundDate];
                            return ((pFuture - priceAtCall) / priceAtCall) * 100;
                        }
                        return null;
                    };
                    const r1m = calcReturn(1); if (r1m !== null) rec.return_1m = r1m;
                    const r3m = calcReturn(3); if (r3m !== null) rec.return_3m = r3m;
                    const r6m = calcReturn(6); if (r6m !== null) rec.return_6m = r6m;
                    const r1y = calcReturn(12); if (r1y !== null) rec.return_1y = r1y;
                }
            }
        }

        // C. Compare Metrics
        if (rec.target_price && rec.price_now) {
            rec.upside_now = ((rec.target_price - rec.price_now) / rec.price_now) * 100;
        }
        if (rec.target_price && rec.price_at_call) {
            rec.upside_at_call = ((rec.target_price - rec.price_at_call) / rec.price_at_call) * 100;
        }
        if (rec.price_now && rec.price_at_call) {
            rec.performance_since_call = ((rec.price_now - rec.price_at_call) / rec.price_at_call) * 100;
        }

        // D. Standardize Recommendations
        const originalRec = (rec.recommendation || '').toLowerCase();

        if (!rec.target_price) {
            rec.recommendation = "No Rating";
        } else if (['buy', 'outperform', 'add', 'accumulate', 'overweight'].some(k => originalRec.includes(k))) {
            rec.recommendation = "Buy";
        } else if (['sell', 'underperform', 'reduce', 'underweight'].some(k => originalRec.includes(k))) {
            rec.recommendation = "Sell";
        } else if (['hold', 'neutral'].some(k => originalRec.includes(k))) {
            rec.recommendation = "Neutral";
        } else {
            rec.recommendation = "Neutral";
        }
    }

    if (rec.upside_at_call === undefined && rec.upside !== undefined) rec.upside_at_call = rec.upside;

    // Enrich with stock information
    const stockInfo = stockInfoMap.get(ticker);
    const enrichedInfo = { ...info };

    delete enrichedInfo.sector;

    if (stockInfo) {
        enrichedInfo.stock_name = stockInfo.organ_short;
        enrichedInfo.exchange = stockInfo.exchange;
        if (stockInfo.icb_name2) {
            enrichedInfo.sector = stockInfo.icb_name2;
        }
        enrichedInfo.stock_type = stockInfo.type;
    }

    return {
        ...report,
        info_of_report: enrichedInfo,
        recommendation: rec
    };
}

export async function getReports() {
    if (cachedReports) return cachedReports;

    const stockInfoMap = await getStockInfoMap();
    const historyMap = await getPriceHistoryMap();

    // 1. Fetch Reports List (Meta)
    let reportsRaw = [];
    const reportCachePath = path.join(os.tmpdir(), "company_report_meta.json");

    try {
        let needsDownload = true;
        let localSize = 0;
        if (fs.existsSync(reportCachePath)) localSize = fs.statSync(reportCachePath).size;

        try {
            const headCmd = new HeadObjectCommand({ Bucket: R2_BUCKET, Key: "company_report_meta.json" });
            const headRes = await r2Client.send(headCmd);
            const remoteSize = headRes.ContentLength;
            if (localSize > 0 && localSize === remoteSize) needsDownload = false;
        } catch (e) {
            // Remote might not exist yet or error
        }

        if (needsDownload) {
            console.log(`[R2] Downloading company_report_meta.json...`);
            const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: "company_report_meta.json" });
            const res = await r2Client.send(getCmd);
            await streamToFile(res.Body, reportCachePath);
        }

        const fileContent = fs.readFileSync(reportCachePath, 'utf8');
        reportsRaw = JSON.parse(fileContent);
    } catch (e) {
        console.error("Error fetching/parsing reports meta:", e);
        return [];
    }

    if (!Array.isArray(reportsRaw)) reportsRaw = [];

    // 2. Enrich Reports
    let reports = reportsRaw.map(r => enrichReport(r, historyMap, stockInfoMap));

    // 3. Calculate Target Price Change (Requires Sorting by Date)
    reports.sort((a, b) => {
        const dA = parseIssueDate(a.info_of_report?.date_of_issue);
        const dB = parseIssueDate(b.info_of_report?.date_of_issue);
        return dA - dB;
    });

    const tpMap = new Map();

    reports.forEach(r => {
        const broker = r.info_of_report?.issued_company;
        const ticker = r.info_of_report?.ticker;
        const tp = r.recommendation?.target_price;
        const dateInt = parseIssueDate(r.info_of_report?.date_of_issue);

        if (broker && ticker && dateInt > 0) {
            const key = `${broker}|${ticker}`;
            const last = tpMap.get(key);

            if (last) {
                const dCurrent = intToDateObj(dateInt);
                const dLast = intToDateObj(last.dateInt);
                const diffTime = Math.abs(dCurrent - dLast);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 365 && diffDays > 0) {
                    if (last.price && tp) {
                        const change = ((tp - last.price) / last.price) * 100;
                        if (r.recommendation) r.recommendation.target_price_change = change;
                    }
                }
            }
            if (tp) {
                tpMap.set(key, { dateInt, price: tp });
            }
        }
    });

    // 4. Filter Invalid Reports
    reports = reports.filter(r => {
        const t = r.info_of_report?.ticker;
        if (!t) return false;

        // Strict Ticker Validation: Must be in official stock list
        if (!stockInfoMap.has(t)) {
            // console.warn(`Filtered unknown ticker: ${t}`);
            return false;
        }

        return true;
    });

    cachedReports = reports;
    return reports;
}

export async function getReport(id) {
    // Check if we have it in the list (for metadata)
    // But for full details, we need the individual file.

    // First, try fast path: if we already fetched all reports, we have metadata.
    // But metadata is missing 'investment_thesis' etc.
    // So we MUST fetch the individual file for the detail page.

    try {
        console.log(`[R2] Fetching report detail: reports/${id}.json`);
        // We probably don't want to use fs cache for every single report unless necessary.
        // For now, let's fetch directly or use a simple in-memory cache if we wanted.
        // But Next.js handles request deduplication.

        const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: `reports/${id}.json` });
        const res = await r2Client.send(getCmd);
        const body = await res.Body.transformToString();
        const rawReport = JSON.parse(body);

        // We also need to enrich it!
        const stockInfoMap = await getStockInfoMap();
        const historyMap = await getPriceHistoryMap();

        return enrichReport(rawReport, historyMap, stockInfoMap);
    } catch (e) {
        console.error(`Error fetching report ${id}:`, e);
        return null;
    }
}

// Cache for daily report data
let cachedDailyReportData = null;

export async function getDailyReportData() {
    if (cachedDailyReportData) return cachedDailyReportData;

    const dailyCachePath = path.join(os.tmpdir(), "daily_report_data.json");

    try {
        let needsDownload = true;
        let localSize = 0;
        if (fs.existsSync(dailyCachePath)) localSize = fs.statSync(dailyCachePath).size;

        try {
            const headCmd = new HeadObjectCommand({ Bucket: R2_BUCKET, Key: "daily_report_data.json" });
            const headRes = await r2Client.send(headCmd);
            const remoteSize = headRes.ContentLength;
            if (localSize > 0 && localSize === remoteSize) needsDownload = false;
        } catch (e) {
            if (localSize > 0) needsDownload = false;
        }

        if (needsDownload) {
            console.log(`[R2] Downloading daily_report_data.json...`);
            const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: "daily_report_data.json" });
            const res = await r2Client.send(getCmd);
            await streamToFile(res.Body, dailyCachePath);
        }

        const fileContent = fs.readFileSync(dailyCachePath, 'utf8');
        cachedDailyReportData = JSON.parse(fileContent);
        return cachedDailyReportData;
    } catch (e) {
        console.error("Error fetching/parsing daily report data:", e);
        return null;
    }
}

// Cache for price history
let cachedPriceHistory = null;

export async function getPriceHistoryMap() {
    if (cachedPriceHistory) return cachedPriceHistory;

    const pricesCachePath = path.join(os.tmpdir(), "cafef_prices_daily.parquet");
    const historyMap = new Map();

    try {
        const listCmd = new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: 'cafef_data/cafef_stock_price' });
        const listRes = await r2Client.send(listCmd);
        let latestKey = null;
        let latestSize = 0;
        if (listRes.Contents) {
            const files = listRes.Contents.filter(i => i.Key.match(/cafef_stock_price_(\d{6})\.parquet/));
            files.sort((a, b) => b.Key.localeCompare(a.Key));
            if (files.length > 0) {
                latestKey = files[0].Key;
                latestSize = files[0].Size;
            }
        }

        let useCache = false;
        let localSize = 0;
        if (fs.existsSync(pricesCachePath)) localSize = fs.statSync(pricesCachePath).size;

        if (latestKey) {
            if (localSize > 0 && localSize === latestSize) {
                useCache = true;
            } else {
                console.log(`[R2] Downloading Price Parquet for Daily: ${latestKey}`);
                const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: latestKey });
                const res = await r2Client.send(getCmd);
                await streamToFile(res.Body, pricesCachePath);
                useCache = true;
            }
        }

        if (useCache && fs.existsSync(pricesCachePath)) {
            console.log("Parsing Price History for Daily...");
            const buffer = fs.readFileSync(pricesCachePath);
            const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

            await new Promise((resolve, reject) => {
                try {
                    parquetRead({
                        file: arrayBuffer,
                        onComplete: (data) => {
                            data.forEach(row => {
                                const ticker = row[0];
                                const dateObj = row[1];
                                const close = row[5];

                                if (ticker && dateObj && close) {
                                    const dInt = toDateInt(dateObj);
                                    const pRaw = parseFloat(close);
                                    const p = pRaw < 5000 ? pRaw * 1000 : pRaw;

                                    if (!historyMap.has(ticker)) historyMap.set(ticker, { prices: {}, dates: [] });
                                    const entry = historyMap.get(ticker);
                                    entry.prices[dInt] = p;
                                    entry.dates.push(dInt);
                                }
                            });
                            resolve();
                        }
                    });
                } catch (e) { reject(e); }
            });

            for (const item of historyMap.values()) {
                item.dates.sort((a, b) => a - b);
            }
        }

        cachedPriceHistory = historyMap;
        return historyMap;
    } catch (e) {
        console.error("Error fetching price history:", e);
        return new Map();
    }
}

// Get price data for specific tickers
export async function getTickerPrices(tickers, callDates) {
    const historyMap = await getPriceHistoryMap();
    const result = {};

    for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        const callDateStr = callDates[i];

        if (!ticker) continue;

        const hist = historyMap.get(ticker);
        if (!hist || hist.dates.length === 0) {
            result[`${ticker}_${callDateStr}`] = { ticker, callDate: callDateStr, error: 'No price data' };
            continue;
        }

        // Get current price (latest)
        const lastDate = hist.dates[hist.dates.length - 1];
        const priceNow = hist.prices[lastDate];

        // Get price at call date
        let priceAtCall = null;
        if (callDateStr) {
            const callInt = parseIssueDate(callDateStr);
            if (callInt > 0) {
                priceAtCall = hist.prices[callInt];
                if (!priceAtCall) {
                    // Find nearest date after call date
                    const nearest = hist.dates.find(d => d >= callInt);
                    if (nearest) priceAtCall = hist.prices[nearest];
                }
            }
        }

        result[`${ticker}_${callDateStr}`] = {
            ticker,
            callDate: callDateStr,
            priceNow,
            priceAtCall
        };
    }

    return result;
}
