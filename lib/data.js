import fs from 'fs';
import path from 'path';
import os from 'os';
import { GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from './r2.js';
import { Readable } from 'stream';
import { parquetRead } from 'hyparquet';

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

export async function getReports() {
    if (cachedReports) return cachedReports;

    // 1. Fetch Reports List
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
            if (localSize > 0) needsDownload = false;
        }

        if (needsDownload) {
            console.log(`[R2] Downloading company_report_data.json...`);
            const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: "company_report_data.json" });
            const res = await r2Client.send(getCmd);
            await streamToFile(res.Body, reportCachePath);
        }

        const fileContent = fs.readFileSync(reportCachePath, 'utf8');
        let raw = JSON.parse(fileContent);

        // Normalize JSON
        if (!Array.isArray(raw) && typeof raw === 'object' && raw !== null) {
            const values = Object.values(raw);
            if (values.length > 0 && !Array.isArray(values[0])) {
                reportsRaw = values.flatMap(group => {
                    if (!group || typeof group !== 'object') return [];
                    return Object.entries(group).map(([id, r]) => {
                        if (r && typeof r === 'object') return { id, ...r };
                        return r;
                    });
                });
            } else {
                reportsRaw = values.flat();
            }
        } else {
            reportsRaw = raw;
        }
    } catch (e) {
        console.error("Error fetching/parsing reports:", e);
        return [];
    }

    if (!Array.isArray(reportsRaw)) reportsRaw = [];

    // 2. Fetch and Process Price History (Parquet)
    const historyMap = new Map();
    const pricesCachePath = path.join(os.tmpdir(), "latest_prices.parquet");

    try {
        let useCache = false;
        let localSize = 0;
        if (fs.existsSync(pricesCachePath)) localSize = fs.statSync(pricesCachePath).size;

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

        if (latestKey) {
            if (localSize > 0 && localSize === latestSize) {
                useCache = true;
            } else {
                console.log(`[R2] Downloading Prices Parquet: ${latestKey}`);
                const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: latestKey });
                const res = await r2Client.send(getCmd);
                await streamToFile(res.Body, pricesCachePath);
                useCache = true;
            }
        }

        if (useCache && fs.existsSync(pricesCachePath)) {
            console.log("Parsing Parquet History...");
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
    } catch (e) {
        console.error("Error processing prices:", e);
    }

    // 4. Enrich Reports (Map Phase)
    let reports = reportsRaw.map(report => {
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

            // Keep original broker recommendation intact
            // Frontend getCallType will handle mapping for display purposes
        }

        if (rec.upside_at_call === undefined && rec.upside !== undefined) rec.upside_at_call = rec.upside;

        return {
            ...report,
            info_of_report: info,
            recommendation: rec
        };
    });

    // 5. Calculate Target Price Change (Requires Sorting by Date)
    // Sort Ascending
    reports.sort((a, b) => {
        const dA = parseIssueDate(a.info_of_report?.date_of_issue);
        const dB = parseIssueDate(b.info_of_report?.date_of_issue);
        return dA - dB;
    });

    // Logic: Previous report from SAME BROKER for SAME TICKER within 1 YEAR
    const tpMap = new Map(); // Key: "Broker|Ticker" -> { dateInt, price }

    reports.forEach(r => {
        const broker = r.info_of_report?.issued_company;
        const ticker = r.info_of_report?.ticker;
        const tp = r.recommendation?.target_price;
        const dateInt = parseIssueDate(r.info_of_report?.date_of_issue);

        if (broker && ticker && dateInt > 0) {
            const key = `${broker}|${ticker}`;
            const last = tpMap.get(key);

            if (last) {
                // Check date diff <= 365 days
                const dCurrent = intToDateObj(dateInt);
                const dLast = intToDateObj(last.dateInt);
                const diffTime = Math.abs(dCurrent - dLast);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays <= 365 && diffDays > 0) {
                    // Calculate Change
                    if (last.price && tp) {
                        const change = ((tp - last.price) / last.price) * 100;
                        if (r.recommendation) r.recommendation.target_price_change = change;
                    }
                }
            }
            // Update map if current has valid TP
            if (tp) {
                tpMap.set(key, { dateInt, price: tp });
            }
        }
    });

    // 6. Filter Invalid Reports
    reports = reports.filter(r => {
        const t = r.info_of_report?.ticker;
        const p = r.recommendation?.price_now;

        if (!t) return false;
        if (t.length > 3) return false;
        if (!p) return false;

        return true;
    });

    // Re-Sort Descending (for display default, though client does re-sort)
    // reports.sort((a, b) => ... ); // Optional since client sorts by date desc default

    cachedReports = reports;
    return reports;
}

export async function getReport(id) {
    if (!cachedReportMap) {
        const reports = await getReports();
        cachedReportMap = new Map();
        for (const report of reports) {
            if (report.id) cachedReportMap.set(report.id, report);
        }
    }
    return cachedReportMap.get(id);
}
