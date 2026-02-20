import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET } from './r2.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import { parquetRead } from 'hyparquet';

async function streamToFile(stream, filePath) {
    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        if (stream instanceof Readable) {
            stream.pipe(writer);
        } else {
            stream.pipe(writer);
        }
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

// Find latest file matching cafef_data/cafef_stock_price_DDMMYY.parquet
async function findLatestPriceFile() {
    try {
        // 1. Try to find SSI file first
        const ssiCmd = new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            Prefix: "cafef_data/ssi_stock_price_"
        });
        const ssiRes = await r2Client.send(ssiCmd);

        let ssiFiles = [];
        if (ssiRes.Contents && ssiRes.Contents.length > 0) {
            ssiFiles = ssiRes.Contents.filter(c => c.Key.match(/ssi_stock_price_\d{6}\.parquet$/));
            ssiFiles.sort((a, b) => {
                const getVal = (key) => {
                    const match = key.match(/(\d{2})(\d{2})(\d{2})\.parquet/);
                    if (!match) return 0;
                    const [_, yy, mm, dd] = match; // Format is usually YYMMDD based on script
                    return parseInt(`20${yy}${mm}${dd}`);
                };
                return getVal(b.Key) - getVal(a.Key);
            });
        }

        if (ssiFiles.length > 0) {
            return { key: ssiFiles[0].Key, type: 'ssi' };
        }

        // 2. Fallback to CafeF
        const cmd = new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            Prefix: "cafef_data/cafef_stock_price_"
        });
        const res = await r2Client.send(cmd);
        if (!res.Contents || res.Contents.length === 0) return null;

        const files = res.Contents.filter(c => c.Key.match(/cafef_stock_price_\d{6}\.parquet$/));

        if (files.length === 0) return null;

        // Sort by parsing DDMMYY (assumed 20YY) to find latest
        files.sort((a, b) => {
            const getVal = (key) => {
                const match = key.match(/(\d{2})(\d{2})(\d{2})\.parquet/);
                if (!match) return 0;
                const [_, dd, mm, yy] = match;
                return parseInt(`20${yy}${mm}${dd}`);
            };
            return getVal(b.Key) - getVal(a.Key); // Descending
        });

        return { key: files[0].Key, type: 'cafef' };
    } catch (e) {
        console.error("Error listing price files:", e);
        return null;
    }
}

let cachedHistoryMap = null;
let historyPromise = null;

export async function getPriceHistoryMap() {
    if (cachedHistoryMap) return cachedHistoryMap;
    if (historyPromise) return historyPromise;

    historyPromise = (async () => {
        const cachePath = path.join(os.tmpdir(), "price_history_latest.parquet");

        try {
            const latestFile = await findLatestPriceFile();
            if (!latestFile) {
                console.warn("[PriceHistory] No price file found in cafef_data/");
                return new Map();
            }

            const { key: latestKey, type } = latestFile;

            console.log(`[PriceHistory] Using latest file: ${latestKey} (Type: ${type})`);

            if (!fs.existsSync(cachePath)) {
                console.log(`[R2] Downloading ${latestKey}...`);
                const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: latestKey });
                const res = await r2Client.send(getCmd);
                await streamToFile(res.Body, cachePath);
            }

            console.log("Parsing parquet...");
            const nodeBuffer = fs.readFileSync(cachePath);
            const arrayBuffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);

            const map = new Map();

            await new Promise((resolve, reject) => {
                parquetRead({
                    file: arrayBuffer,
                    onComplete: (rows) => {
                        rows.forEach(row => {
                            const ticker = row[0];
                            const dateVal = row[1];
                            let close = Number(row[5]);

                            // CafeF data is in thousands (e.g. 10.5 for 10500)
                            // SSI data is in units (e.g. 10500)
                            if (type === 'cafef') {
                                close = close * 1000;
                            }

                            if (ticker && !isNaN(close)) {
                                if (!map.has(ticker)) map.set(ticker, []);
                                map.get(ticker).push({
                                    time: dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : String(dateVal),
                                    close: close
                                });
                            }
                        });

                        for (const [key, val] of map.entries()) {
                            val.sort((a, b) => new Date(a.time) - new Date(b.time));
                        }
                        resolve();
                    }
                }).catch(reject);
            });

            cachedHistoryMap = map;
            return map;
        } catch (e) {
            console.error("Error fetching price history:", e);
            historyPromise = null; // Reset to allow retry
            return new Map();
        }
    })();

    return historyPromise;
}
