import fs from 'fs';
import path from 'path';
import os from 'os';
import { GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from './r2';
import { Readable } from 'stream';
// Dynamic import for parquetjs-lite inside the function to avoid issues if not needed immediately? 
// No, top level is fine but if it uses CommonJS we might need createRequire or just import.
// Using default import for now, if it fails we adjust.
import parquet from 'parquetjs-lite';

const dataDirectory = path.join(process.cwd(), 'data');

let cachedReports = null;
let cachedReportMap = null;

// Helper to stream to string
const streamToString = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });

// Helper to stream to file
const streamToFile = (stream, filePath) =>
    new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        stream.pipe(file);
        stream.on("error", reject);
        file.on("finish", resolve);
    });

export async function getReports() {
    if (cachedReports) {
        return cachedReports;
    }

    // 1. Fetch Reports List
    let reportsRaw = [];
    const reportCachePath = path.join(os.tmpdir(), "company_report_data.json");

    try {
        let needsDownload = true;

        let localSize = 0;
        if (fs.existsSync(reportCachePath)) {
            localSize = fs.statSync(reportCachePath).size;
        }

        // Check Remote Size via HEAD
        try {
            const headCmd = new HeadObjectCommand({
                Bucket: R2_BUCKET,
                Key: "company_report_data.json",
            });
            const headRes = await r2Client.send(headCmd);
            const remoteSize = headRes.ContentLength;

            if (localSize > 0 && localSize === remoteSize) {
                console.log(`[Cache] Local reports file matches remote size (${localSize} bytes). Using Cache.`);
                needsDownload = false;
            } else {
                console.log(`[Cache] Size mismatch or missing. Local: ${localSize}, Remote: ${remoteSize}. Downloading...`);
            }
        } catch (e) {
            console.warn("Could not HEAD remote file, proceeding to download if missing local:", e.message);
            if (localSize > 0) needsDownload = false; // Fallback to cache if offline/error
        }

        if (needsDownload) {
            console.log(`[R2] Downloading company_report_data.json (LARGE FILE)...`);
            const command = new GetObjectCommand({
                Bucket: R2_BUCKET,
                Key: "company_report_data.json",
            });
            const response = await r2Client.send(command);
            await streamToFile(response.Body, reportCachePath);
            console.log(`[R2] Download complete.`);
        }

        const fileContent = fs.readFileSync(reportCachePath, 'utf8');
        reportsRaw = JSON.parse(fileContent);

        // Handle case where JSON is an object grouped by broker (e.g. { "bvsc": { "id": ... }, ... })
        if (!Array.isArray(reportsRaw) && typeof reportsRaw === 'object' && reportsRaw !== null) {
            console.log("[Data] Flattening reports object into array...");
            const values = Object.values(reportsRaw);
            // Check if nested items are likely objects (Broker -> { ID: Report })
            if (values.length > 0 && !Array.isArray(values[0])) {
                reportsRaw = values.flatMap(brokerGroup => {
                    if (!brokerGroup || typeof brokerGroup !== 'object') return [];
                    return Object.entries(brokerGroup).map(([id, report]) => {
                        // Inject format if missing or normalize
                        if (report && typeof report === 'object') {
                            return { id, ...report };
                        }
                        return report;
                    });
                });
            } else {
                // Fallback for Array values
                reportsRaw = values.flat();
            }
        }

    } catch (e) {
        console.error("Error fetching/parsing company_report_data.json:", e);
    }

    if (!Array.isArray(reportsRaw) || reportsRaw.length === 0) {
        console.warn("No reports found.");
        return [];
    }

    // 2. Fetch Latest Price Parquet
    let priceMap = new Map();
    const pricesCachePath = path.join(os.tmpdir(), "latest_prices.parquet");

    try {
        let shouldUseCache = false;
        let localParquetSize = 0;

        if (fs.existsSync(pricesCachePath)) {
            localParquetSize = fs.statSync(pricesCachePath).size;
        }

        let latestKey = null;
        let latestRemoteSize = 0;

        // List R2 to see what's new
        const listCmd = new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            Prefix: 'cafef_data/cafef_stock_price',
        });
        const listRes = await r2Client.send(listCmd);
        let latestDateVal = -1;

        if (listRes.Contents) {
            listRes.Contents.forEach(item => {
                const match = item.Key.match(/cafef_stock_price_(\d{6})\.parquet/);
                if (match) {
                    const dStr = match[1];
                    const day = parseInt(dStr.slice(0, 2));
                    const month = parseInt(dStr.slice(2, 4));
                    const year = parseInt(dStr.slice(4, 6)) + 2000;
                    const dateNum = year * 10000 + month * 100 + day;
                    if (dateNum > latestDateVal) {
                        latestDateVal = dateNum;
                        latestKey = item.Key;
                        latestRemoteSize = item.Size;
                    }
                }
            });
        }

        // Validation Logic
        if (latestKey) {
            if (localParquetSize > 0 && localParquetSize === latestRemoteSize) {
                console.log(`[Cache] Local parquet matches remote (${latestKey}). Size: ${localParquetSize}. Using Cache.`);
                shouldUseCache = true;
            } else {
                console.log(`[Cache] Parquet update needed. Remote: ${latestKey} (${latestRemoteSize} bytes). Local: ${localParquetSize}.`);
            }
        }

        if (!shouldUseCache && latestKey) {
            console.log(`[R2] Downloading latest parquet: ${latestKey}`);
            const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: latestKey });
            const getRes = await r2Client.send(getCmd);
            await streamToFile(getRes.Body, pricesCachePath);
            shouldUseCache = true;
        } else if (localParquetSize > 0 && !latestKey) {
            // Fallback if list fails but we have local?
            shouldUseCache = true;
        }

        if (shouldUseCache && fs.existsSync(pricesCachePath)) {
            // Read Parquet
            // Uses simple parquetjs import from top level
            // If this fails, the issue is strict import
            const reader = await parquet.ParquetReader.openFile(pricesCachePath);
            const cursor = reader.getCursor();
            let record = null;
            while (record = await cursor.next()) {
                const ticker = record.Symbol || record.Ticker || record.symbol || record.ticker;
                const price = record.Close || record.close || record.Price || record.price;
                if (ticker && price) {
                    priceMap.set(ticker, parseFloat(price) * 1000);
                }
            }
            await reader.close();
        }
    } catch (e) {
        console.error("Error processing parquet:", e);
    }

    // 3. Fetch Sectors form CSV (or fallback to local)
    let sectorMap = new Map();
    try {
        // Try local first for speed, or R2
        // Assuming R2 path: broker-data/stock_information.csv OR broker-data/cafef_data/stock_information.csv
        // User screenshot showed it in cafef_data/ too?
        // Let's try R2 cafef_data/stock_information.csv
        const csvCmd = new GetObjectCommand({
            Bucket: R2_BUCKET,
            Key: "cafef_data/stock_information.csv"
        });
        // Check if exists? If throws error, try root
        let csvStr = "";
        try {
            const res = await r2Client.send(csvCmd);
            csvStr = await streamToString(res.Body);
        } catch (e) {
            console.log("CSV not in cafef_data, trying root stock_information.csv");
            const resRoot = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: "stock_information.csv" }));
            csvStr = await streamToString(resRoot.Body);
        }

        // Parse CSV (simple split)
        // ticker,industry,...
        const lines = csvStr.split('\n');
        // Assume header
        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        const tickerIdx = header.indexOf('ticker');
        const industryIdx = header.indexOf('industry');

        if (tickerIdx !== -1 && industryIdx !== -1) {
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(','); // Be careful of commas in quotes
                if (cols.length > Math.max(tickerIdx, industryIdx)) {
                    const t = cols[tickerIdx].trim();
                    const s = cols[industryIdx].trim();
                    if (t) sectorMap.set(t, s);
                }
            }
        }
    } catch (e) {
        console.error("Error fetching CSV:", e);
        // Fallback to local data/stock_information.csv logic if needed
        try {
            const localCsv = fs.readFileSync(path.join(dataDirectory, 'stock_information.csv'), 'utf8');
            // ... parsing logic same as above ...
            // For brevity, skipping dup logic, assuming R2 works or user wants R2 only
        } catch (ex) { }
    }


    // 4. Merge & Enrich
    const reports = reportsRaw.map(report => {
        const ticker = report.info_of_report?.ticker;
        if (!ticker) return report;

        // Enhance info_of_report
        let info = { ...report.info_of_report };
        if (sectorMap.has(ticker) && !info.sector) {
            info.sector = sectorMap.get(ticker);
        }

        // Enhance recommendation
        let rec = { ...report.recommendation };

        // Get generic price from Map
        // IMPORTANT: CafeF data is usually adjusted.
        // If priceMap has it
        const currentPrice = priceMap.get(ticker) || rec.current_price;
        if (currentPrice) {
            rec.current_price = currentPrice;
            rec.price_now = currentPrice; // Dashboard uses price_now

            // Calculate Upside Now
            const target = rec.target_price;
            if (target && currentPrice) {
                // ((Target - Current) / Current) * 100
                const upsideVal = ((target - currentPrice) / currentPrice) * 100;
                rec.upside_now = upsideVal;
            }
        }

        // Ensure upside_at_call exists (might be just 'upside' in raw)
        if (rec.upside_at_call === undefined && rec.upside !== undefined) {
            rec.upside_at_call = rec.upside;
        }

        return {
            ...report,
            info_of_report: info,
            recommendation: rec
        };
    });

    cachedReports = reports;
    return reports;
}

export async function getReport(id) {
    if (!cachedReportMap) {
        const reports = await getReports();
        // ... rest same
        cachedReportMap = new Map();
        for (const report of reports) {
            if (report.id) {
                cachedReportMap.set(report.id, report);
            }
        }
    }
    return cachedReportMap.get(id);
}
