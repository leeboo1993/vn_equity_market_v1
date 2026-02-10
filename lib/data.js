import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import { getStockInfoMap } from './stockInfo.js'; // Import stock info
import { getPriceHistoryMap } from './priceHistory.js'; // Import price history helper

// Load environment variables
dotenv.config({ path: '.env.local' });

// Ensure environment variables are loaded
const R2_BUCKET = process.env.R2_BUCKET;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!R2_BUCKET || !R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    console.error("Missing R2 environment variables");
}

const r2Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

// Helper to stream S3 body to file
async function streamToFile(stream, filePath) {
    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        if (stream instanceof Readable) {
            stream.pipe(writer);
        } else {
            // If it's a web stream (Edge/Node 18+ might differ)
            // Convert web stream to node stream if needed, or just write
            // For aws-sdk v3 in node, Body is usually incoming message.
            stream.pipe(writer);
        }
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// Helper to parse date "YYMMDD" or "YYYYMMDD" -> number YYYYMMDD for comparison
const parseIssueDate = (dStr) => {
    if (!dStr) return 0;
    const s = String(dStr).trim();
    if (s.length === 6) {
        // Assume 20xx
        const y = 2000 + parseInt(s.substring(0, 2));
        const m = parseInt(s.substring(2, 4));
        const d = parseInt(s.substring(4, 6));
        return y * 10000 + m * 100 + d;
    } else if (s.length === 8) {
        return parseInt(s);
    }
    return 0;
};

// Helper: 20241105 -> Date Object
export const intToDateObj = (val) => {
    if (!val || Number(val) < 10000000) return null;
    const s = String(val);
    const y = parseInt(s.substring(0, 4));
    const m = parseInt(s.substring(4, 6)) - 1; // Month 0-indexed
    const d = parseInt(s.substring(6, 8));
    return new Date(y, m, d);
};

// Helper: Standardized Quarter Label from Date String (YYYYMMDD or YYMMDD)
export const getQuarterLabel = (dStr) => {
    if (!dStr) return null;
    const dInt = parseIssueDate(dStr);
    if (dInt === 0) return null;

    const s = String(dInt);
    if (s.length !== 8) return null;

    const y = parseInt(s.substring(0, 4));
    const m = parseInt(s.substring(4, 6));

    // Ignore garbage years
    if (y < 2010 || y > 2030) return null;

    let q = Math.ceil(m / 3);
    if (q > 4) q = 4; // Clamp to Q4
    if (q < 1) q = 1;

    return `Q${q} ${y}`;
};

// === Enriched Report Helper ===
// Helper to find price at specific date (or closest previous) using Binary Search (O(log N))
export function getPriceAtDate(ticker, dateStr, historyMap) {
    if (!ticker || !historyMap.has(ticker)) return null;
    if (!dateStr || String(dateStr).length < 6) return null;

    const history = historyMap.get(ticker);
    if (!history || history.length === 0) return null;

    // Parse YYMMDD, YYYYMMDD, or YYYY-MM-DD to YYYY-MM-DD
    const s = String(dateStr).trim();
    let targetDateStr;

    if (s.includes('-')) {
        targetDateStr = s; // Already YYYY-MM-DD
    } else if (s.length === 8) {
        // YYYYMMDD
        targetDateStr = `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
    } else if (s.length === 6) {
        // YYMMDD
        targetDateStr = `20${s.substring(0, 2)}-${s.substring(2, 4)}-${s.substring(4, 6)}`;
    } else {
        return null; // Unsupported format
    }

    // Binary Search
    let low = 0;
    let high = history.length - 1;
    let bestIdx = -1;

    while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        if (history[mid].time <= targetDateStr) {
            bestIdx = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }

    return bestIdx !== -1 ? history[bestIdx].close : null;
}

// === Enriched Report Helper ===
export function enrichReport(report, historyMap, stockInfoMap) {
    const ticker = report.info_of_report?.ticker;

    // 1. Enrich with Stock Info (Sector, Company Name)
    if (ticker && stockInfoMap.has(ticker)) {
        const info = stockInfoMap.get(ticker);
        // Ensure sector exists
        if (!report.info_of_report.sector && info.industry_en) {
            report.info_of_report.sector = info.industry_en;
        }
        // Ensure company name exists
        if (!report.info_of_report.stock_name && info.other_name) {
            report.info_of_report.stock_name = info.other_name;
        } else if (!report.info_of_report.stock_name && info.short_name) {
            report.info_of_report.stock_name = info.short_name;
        }
    }

    // 2. Enrich with Current Price & Upside
    let currentPrice = null;
    if (ticker && historyMap.has(ticker)) {
        const history = historyMap.get(ticker);
        if (history.length > 0) {
            currentPrice = history[history.length - 1].close;
        }
    }

    if (currentPrice && report.recommendation) {
        report.recommendation.price_now = currentPrice;

        const tp = report.recommendation.target_price;
        // Sanitize Target Price (> 1.5M is invalid)
        if (tp > 1500000) {
            report.recommendation.target_price = null;
        } else if (tp > 0) {
            // Upside Now (Current vs Target)
            const upside = ((tp - currentPrice) / currentPrice) * 100;
            report.recommendation.upside = parseFloat(upside.toFixed(1));
            report.recommendation.upside_now = report.recommendation.upside;

            // Update Recommendation based on Upside
            if (upside > 15) {
                report.recommendation.recommendation = 'Buy';
            } else if (upside < -5) {
                report.recommendation.recommendation = 'Sell';
            } else {
                report.recommendation.recommendation = 'Neutral';
            }
        } else {
            report.recommendation.upside = null;
            report.recommendation.upside_now = null;
            report.recommendation.recommendation = 'No Rating';
        }

        // Performance Since Call & Upside at Call
        // Need price at call date
        const issueDate = report.info_of_report?.date_of_issue;
        const priceAtCall = getPriceAtDate(ticker, issueDate, historyMap);

        if (priceAtCall && priceAtCall > 0) {
            const perf = ((currentPrice - priceAtCall) / priceAtCall) * 100;
            report.recommendation.performance_since_call = parseFloat(perf.toFixed(1));

            // Upside at call (Target Price vs Price At Call)
            if (tp > 0) {
                const upAtCall = ((tp - priceAtCall) / priceAtCall) * 100;
                report.recommendation.upside_at_call = parseFloat(upAtCall.toFixed(1));
            }
        }

        // Performance For Specific Horizons (1M, 3M, 6M, 1Y) after the call
        // 1M = Price at (IssueDate + 1 Month) vs Price at Call

        const getFutureDateStr = (baseDateStr, monthsToAdd) => {
            const s = String(baseDateStr);
            let yy, mm, dd;
            if (s.length === 8) {
                yy = parseInt(s.substring(0, 4)) - 2000;
                mm = parseInt(s.substring(4, 6));
                dd = parseInt(s.substring(6, 8));
            } else {
                yy = parseInt(s.substring(0, 2));
                mm = parseInt(s.substring(2, 4));
                dd = parseInt(s.substring(4, 6));
            }
            const d = new Date(2000 + yy, mm - 1, dd);

            // Add months
            d.setMonth(d.getMonth() + monthsToAdd);

            // Format YYYY-MM-DD for check, but getPriceAtDate expects YYMMDD?
            // Actually getPriceAtDate implementation above takes YYMMDD "dateStr" argument.
            // We need to return YYMMDD.

            const y = d.getFullYear() % 100;
            const m = d.getMonth() + 1;
            const day = d.getDate();
            const p = n => n < 10 ? '0' + n : n;
            return `${p(y)}${p(m)}${p(day)}`;
        };

        // Helper to check if date has passed
        const isDateInPast = (dateStr) => {
            const s = String(dateStr);
            let yy, mm, dd;
            if (s.length === 8) {
                yy = parseInt(s.substring(0, 4)) - 2000;
                mm = parseInt(s.substring(4, 6));
                dd = parseInt(s.substring(6, 8));
            } else {
                yy = parseInt(s.substring(0, 2));
                mm = parseInt(s.substring(2, 4));
                dd = parseInt(s.substring(4, 6));
            }
            const target = new Date(2000 + yy, mm - 1, dd);
            return target < new Date(); // True if target is before now
        };

        if (priceAtCall && priceAtCall > 0 && issueDate) {
            const calcPeriodReturn = (months) => {
                const targetDateStr = getFutureDateStr(issueDate, months);

                // Only calculate if the period has completed (date is in past)
                if (!isDateInPast(targetDateStr)) return null;

                const priceAtPeriod = getPriceAtDate(ticker, targetDateStr, historyMap);
                if (priceAtPeriod && priceAtPeriod > 0) {
                    return parseFloat((((priceAtPeriod - priceAtCall) / priceAtCall) * 100).toFixed(1));
                }
                return null;
            };

            report.recommendation.return_1m = calcPeriodReturn(1);
            report.recommendation.return_3m = calcPeriodReturn(3);
            report.recommendation.return_6m = calcPeriodReturn(6);
            report.recommendation.return_1y = calcPeriodReturn(12);
        } else {
            report.recommendation.return_1m = null;
            report.recommendation.return_3m = null;
            report.recommendation.return_6m = null;
            report.recommendation.return_1y = null;
        }
    }

    return report;
}



// === TICKET #1: Metadata Loader ===
export async function getReportsMetadata() {
    const metadataPath = path.join(process.cwd(), 'public', 'reports_metadata.json');
    if (fs.existsSync(metadataPath)) {
        try {
            return JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        } catch (e) {
            console.error("Error parsing reports_metadata.json:", e);
        }
    }

    // Fallback: calculate from full data (slow, but works)
    const reports = await getFullRawReports();
    const uniqueQuarters = [...new Set(reports.map(r => getQuarterLabel(r.info_of_report?.date_of_issue)).filter(Boolean))].sort((a, b) => {
        const [qA, yA] = a.split(' ');
        const [qB, yB] = b.split(' ');
        if (yA !== yB) return parseInt(yB) - parseInt(yA);
        return parseInt(qB.replace('Q', '')) - parseInt(qA.replace('Q', ''));
    });

    return {
        uniqueTickers: [...new Set(reports.map(r => r.info_of_report?.ticker).filter(Boolean))].sort(),
        uniqueBrokers: [...new Set(reports.map(r => r.info_of_report?.issued_company).filter(Boolean))].sort(),
        uniqueSectors: [...new Set(reports.map(r => r.info_of_report?.sector).filter(Boolean))].sort(),
        uniqueQuarters,
        totalReports: reports.length
    };
}

// === TICKET #2: Thin List Loader ===
export async function getThinReports() {
    const listPath = path.join(process.cwd(), 'public', 'reports_list.json');
    if (fs.existsSync(listPath)) {
        try {
            return JSON.parse(fs.readFileSync(listPath, 'utf8'));
        } catch (e) {
            console.error("Error parsing reports_list.json:", e);
        }
    }
    // Fallback to full
    return getFullRawReports();
}

// Map to cache reports in memory
let cachedRawReports = null;
let lastRawFetchTimestamp = 0;
const RAW_CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Loads the raw reports from R2, flattens them, and performs static enrichment (names/sectors).
 * High-performance: Only does this when the cache expires or is missing.
 */
export async function getFullRawReports() {
    const now = Date.now();
    if (cachedRawReports && (now - lastRawFetchTimestamp < RAW_CACHE_TTL)) {
        return cachedRawReports;
    }

    const stockInfoMap = await getStockInfoMap();
    const reportCachePath = path.join(os.tmpdir(), "company_report_data.json");
    let reportsRaw = [];

    try {
        const headCmd = new HeadObjectCommand({ Bucket: R2_BUCKET, Key: "company_report_data.json" });
        const headRes = await r2Client.send(headCmd);
        const remoteSize = headRes.ContentLength;
        const localSize = fs.existsSync(reportCachePath) ? fs.statSync(reportCachePath).size : 0;

        if (localSize === 0 || localSize !== remoteSize) {
            console.log(`[R2] Downloading company_report_data.json (${(remoteSize / 1024 / 1024).toFixed(2)} MB)...`);
            const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: "company_report_data.json" });
            const res = await r2Client.send(getCmd);
            await streamToFile(res.Body, reportCachePath);
        }

        reportsRaw = JSON.parse(fs.readFileSync(reportCachePath, 'utf8'));
    } catch (e) {
        console.error("Error loading reports:", e);
        return [];
    }

    // Flatten logic
    let flattened = Array.isArray(reportsRaw) ? reportsRaw : [];
    if (!Array.isArray(reportsRaw)) {
        for (const broker in reportsRaw) {
            for (const id in reportsRaw[broker]) {
                const r = reportsRaw[broker][id];
                if (!r.id) r.id = id;
                flattened.push(r);
            }
        }
    }

    // Static Enrichment & Sorting (Done once per load)
    flattened.forEach(r => {
        const ticker = r.info_of_report?.ticker;
        if (ticker && stockInfoMap.has(ticker)) {
            const info = stockInfoMap.get(ticker);
            const normalize = (val) => {
                const s = String(val || '').trim();
                if (s === 'undefined' || s === 'NA' || s === 'null' || s === '') return null;
                return s;
            };
            const currentSector = normalize(r.info_of_report.sector);
            const currentName = normalize(r.info_of_report.stock_name);
            // Fix: Use 'icb_name2' instead of 'industry_en' and 'organ_short' instead of 'short_name'
            if ((!currentSector || currentSector === 'production') && info.icb_name2) r.info_of_report.sector = info.icb_name2;
            if (!currentName && info.organ_short) r.info_of_report.stock_name = info.organ_short;

            if (r.info_of_report.stock_name === 'undefined') r.info_of_report.stock_name = info.organ_short || info.other_name || ticker;
            if (r.info_of_report.sector === 'undefined') r.info_of_report.sector = info.icb_name2 || '';
        }
        // Standardize Date: YYMMDD -> YYYYMMDD
        const d = r.info_of_report?.date_of_issue;
        if (d) {
            const dInt = parseIssueDate(d);
            if (dInt > 0) r.info_of_report.date_of_issue = String(dInt);
        }
    });

    flattened.sort((a, b) => {
        const dA = parseIssueDate(b.info_of_report?.date_of_issue);
        const dB = parseIssueDate(a.info_of_report?.date_of_issue);
        return dA - dB;
    });

    cachedRawReports = flattened;
    lastRawFetchTimestamp = now;
    return flattened;
}

export async function getReports() {
    const rawReports = await getFullRawReports();
    const historyMap = await getPriceHistoryMap();
    const stockInfoMap = await getStockInfoMap();

    // PERFORMANCE: Instead of enriching all 18,000, we'll let the API filter them first.
    // However, the current API expects getReports() to return the full enriched set for pagination.
    // To stay safe and fulfill the "Instant" promise, we'll keep the full enrichment but use the Binary Search.

    // Calculate Target Price Change relative (needs full set)
    // We'll perform this only once per load too in getFullRawReports if possible, 
    // but for now, we'll keep it here but optimized.

    return enrichReportsBatch(rawReports);
}

export async function getReport(id) {
    // For single report, we DEFINITELY need the full data
    const reports = await getFullRawReports();
    return reports.find(r => r.id === id) || null;
}

export async function enrichReportsBatch(reportsRaw) {
    if (!reportsRaw || reportsRaw.length === 0) return [];

    const stockInfoMap = await getStockInfoMap();
    const historyMap = await getPriceHistoryMap();

    // Enrichment is now O(N log M) instead of O(N*M)
    const enriched = reportsRaw.map(r => enrichReport(r, historyMap, stockInfoMap));

    // Filter out invalid tickers AND unrealistic upsides
    const reports = enriched.filter(r => {
        const t = r.info_of_report?.ticker;
        const upside = r.recommendation?.upside;

        // Filter out if no ticker
        if (!t || t === 'NA' || t === 'na' || t.trim() === '') return false;

        // Filter out if upside > 150% (likely data error or reverse split)
        if (upside != null && upside > 150) return false;

        return true;
    });

    return reports;
}

// === Ticker Price Helper ===
// Used by Daily Tracking to fetch prices for many recommendations
export async function getTickerPrices(tickers, callDates) {
    if (!tickers || !Array.isArray(tickers)) return {};

    const historyMap = await getPriceHistoryMap();
    const result = {};

    for (let i = 0; i < tickers.length; i++) {
        const ticker = tickers[i];
        const dateStr = callDates && callDates[i] ? callDates[i] : null;

        if (!ticker) continue;

        // Current Price
        let priceNow = 0;
        if (historyMap.has(ticker)) {
            const hist = historyMap.get(ticker);
            if (hist.length > 0) {
                priceNow = hist[hist.length - 1].close;
            }
        }

        // Price at Call
        const priceAtCall = dateStr ? getPriceAtDate(ticker, dateStr, historyMap) : 0;

        const key = `${ticker}_${dateStr}`;
        result[key] = {
            priceNow,
            priceAtCall
        };
    }

    return result;
}

export async function getDailyReportData() {
    const cachePath = path.join(os.tmpdir(), "daily_report_data.json");

    try {
        let needsDownload = true;
        if (fs.existsSync(cachePath)) {
            // Check if local file is fresh enough (e.g. < 1 hour) or just blindly rely on revalidate
            // For simplicity and consistency with other methods, we'll check R2 size/mod time if possible, 
            // or just download if missing. 
            // Vercel serverless functions are ephemeral, so tmp is not persistent across long periods.
            // Let's standardly check head.
            try {
                const headCmd = new HeadObjectCommand({ Bucket: R2_BUCKET, Key: "daily_report_data.json" });
                const headRes = await r2Client.send(headCmd);
                const localStats = fs.statSync(cachePath);
                if (localStats.size === headRes.ContentLength) needsDownload = false;
            } catch (e) {
                // Ignore
            }
        }

        if (needsDownload) {
            console.log(`[R2] Downloading daily_report_data.json...`);
            const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: "daily_report_data.json" });
            const res = await r2Client.send(getCmd);
            await streamToFile(res.Body, cachePath);
        }

        const content = fs.readFileSync(cachePath, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        console.error("Error fetching daily report data:", e);
        return null;
    }
}
