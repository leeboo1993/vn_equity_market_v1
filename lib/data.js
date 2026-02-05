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

// Helper to parse date "YYMMDD" -> number YYYYMMDD for comparison
const parseIssueDate = (dStr) => {
    if (!dStr || dStr.length !== 6) return 0;
    // Assume 20xx
    const y = 2000 + parseInt(dStr.substring(0, 2));
    const m = parseInt(dStr.substring(2, 4));
    const d = parseInt(dStr.substring(4, 6));
    return y * 10000 + m * 100 + d;
};

// Helper: 20241105 -> Date Object
const intToDateObj = (val) => {
    const s = String(val);
    const y = parseInt(s.substring(0, 4));
    const m = parseInt(s.substring(4, 6)) - 1; // Month 0-indexed
    const d = parseInt(s.substring(6, 8));
    return new Date(y, m, d);
};

// === Enriched Report Helper ===
// Helper to find price at specific date (or closest previous)
function getPriceAtDate(ticker, dateStr, historyMap) {
    if (!ticker || !historyMap.has(ticker)) return null;
    if (!dateStr || dateStr.length !== 6) return null;

    const history = historyMap.get(ticker);
    // Parse YYMMDD to YYYY-MM-DD string
    const yy = parseInt(dateStr.substring(0, 2));
    const mm = parseInt(dateStr.substring(2, 4));
    const dd = parseInt(dateStr.substring(4, 6));

    // Padding Helper
    const p = (n) => n < 10 ? '0' + n : n;
    const targetDateStr = `20${p(yy)}-${p(mm)}-${p(dd)}`;

    // Find matching date or closest previous using Binary Search
    // History is sorted asc by time ("YYYY-MM-DD")

    let low = 0;
    let high = history.length - 1;
    let best = null;

    // We want to find the largest index where history[index].time <= targetDateStr
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const midTime = history[mid].time;

        if (midTime <= targetDateStr) {
            // This is a candidate, but we want the latest possible on or before target
            best = history[mid];
            low = mid + 1; // Try to go higher
        } else {
            // midTime > targetDateStr, so this is too future
            high = mid - 1;
        }
    }

    return best ? best.close : null;
}

// === Enriched Report Helper ===
function enrichReport(report, historyMap, stockInfoMap) {
    const ticker = report.info_of_report?.ticker;

    // 1. Enrich with Stock Info (Sector, Company Name)
    if (ticker && stockInfoMap.has(ticker)) {
        const info = stockInfoMap.get(ticker);
        // Ensure sector exists
        if (!report.info_of_report.sector && info.icb_name2) {
            report.info_of_report.sector = info.icb_name2;
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
            report.recommendation.upside_now = report.recommendation.upside; // Alias for dashboard
        } else {
            report.recommendation.upside = null;
            report.recommendation.upside_now = null;
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
            // Parse YYMMDD
            const yy = parseInt(baseDateStr.substring(0, 2));
            const mm = parseInt(baseDateStr.substring(2, 4));
            const dd = parseInt(baseDateStr.substring(4, 6));
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
            const yy = parseInt(dateStr.substring(0, 2));
            const mm = parseInt(dateStr.substring(2, 4));
            const dd = parseInt(dateStr.substring(4, 6));
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


// Map to cache reports in memory
let cachedReports = null;

export async function getReports() {
    if (cachedReports) return cachedReports;

    const stockInfoMap = await getStockInfoMap();
    const historyMap = await getPriceHistoryMap();

    // 1. Fetch Reports List (Monolithic)
    let reportsRaw = [];
    const reportCachePath = path.join(os.tmpdir(), "company_report_data.json");

    try {
        let needsDownload = true;
        let localSize = 0;
        if (fs.existsSync(reportCachePath)) localSize = fs.statSync(reportCachePath).size;

        try {
            const headCmd = new HeadObjectCommand({ Bucket: R2_BUCKET, Key: "company_report_data.json" });
            const headRes = await r2Client.send(headCmd);
            const remoteSize = headRes.ContentLength;
            if (localSize > 0 && localSize === remoteSize) needsDownload = false;
        } catch (e) {
            // Remote might not exist yet or error
        }

        if (needsDownload) {
            console.log(`[R2] Downloading company_report_data.json...`);
            const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: "company_report_data.json" });
            const res = await r2Client.send(getCmd);
            await streamToFile(res.Body, reportCachePath);
        }

        const fileContent = fs.readFileSync(reportCachePath, 'utf8');
        reportsRaw = JSON.parse(fileContent);
    } catch (e) {
        console.error("Error fetching/parsing reports:", e);
        return [];
    }

    // Convert Object to Array if needed
    if (!Array.isArray(reportsRaw)) {
        // Assume structure: { broker: { reportId: { ... } } }
        // Flatten to array of reports
        const flattened = [];
        if (reportsRaw && typeof reportsRaw === 'object') {
            for (const brokerKey in reportsRaw) {
                const brokerGroup = reportsRaw[brokerKey];
                if (brokerGroup && typeof brokerGroup === 'object') {
                    // Check if it's already a report or a group
                    // The snippet showed "bvsc": { "id": { ... } }
                    // So we traverse values
                    for (const reportId in brokerGroup) {
                        const report = brokerGroup[reportId];
                        if (report && typeof report === 'object') {
                            // Inject ID if missing (from key)
                            if (!report.id) report.id = reportId;
                            flattened.push(report);
                        }
                    }
                }
            }
        }
        reportsRaw = flattened;
    }

    // 2. Enrich Reports
    let reports = reportsRaw.map(r => enrichReport(r, historyMap, stockInfoMap));

    // 3. Cleanup & Calculate Target Price Change
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

                // Calculate difference in days
                const diffTime = Math.abs(dCurrent - dLast);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                // Only calculate change if reports are within 1 year (365 days)
                if (diffDays <= 365 && last.tp > 0) {
                    const change = ((tp - last.tp) / last.tp) * 100;
                    if (r.recommendation) {
                        r.recommendation.target_price_change = parseFloat(change.toFixed(1));
                    }
                }
            }
            if (tp > 0) {
                tpMap.set(key, { tp, dateInt });
            }
        }
    });

    // 4. Filter invalid tickers
    reports = reports.filter(r => {
        const t = r.info_of_report?.ticker;
        // Simply check if ticker exists and is not literally "NA" or empty
        return t && t !== 'NA' && t !== 'na' && t.trim() !== '';
    });

    // Sort Descending by Date
    reports.sort((a, b) => {
        const dA = parseIssueDate(b.info_of_report?.date_of_issue);
        const dB = parseIssueDate(a.info_of_report?.date_of_issue);
        return dA - dB;
    });

    cachedReports = reports;
    return reports;
}

export async function getReport(id) {
    const reports = await getReports();
    return reports.find(r => r.id === id) || null;
}

// === Ticker Price Helper ===

// === Ticker Price Helper (Batch) ===
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
