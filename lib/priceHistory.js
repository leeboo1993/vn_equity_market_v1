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

        return files[0].Key;
    } catch (e) {
        console.error("Error listing price files:", e);
        return null;
    }
}

let cachedHistoryMap = null;

export async function getPriceHistoryMap() {
    if (cachedHistoryMap) return cachedHistoryMap;

    const cachePath = path.join(os.tmpdir(), "price_history_latest.parquet");

    try {
        const latestKey = await findLatestPriceFile();
        if (!latestKey) {
            console.warn("[PriceHistory] No price file found in cafef_data/");
            return new Map();
        }

        console.log(`[PriceHistory] Using latest file: ${latestKey}`);

        if (!fs.existsSync(cachePath)) {
            console.log(`[R2] Downloading ${latestKey}...`);
            const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: latestKey });
            const res = await r2Client.send(getCmd);
            await streamToFile(res.Body, cachePath);
        }

        console.log("Parsing parquet...");
        const nodeBuffer = fs.readFileSync(cachePath);
        // hyparquet needs ArrayBuffer
        const arrayBuffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);

        const map = new Map();

        await new Promise((resolve, reject) => {
            parquetRead({
                file: arrayBuffer,
                onComplete: (rows) => {
                    // Structure based on inspection:
                    // [ 'AAA', 2026-01-05T00:00:00.000Z, 7.89, 7.94, 7.7, 7.7, 1704200n, 'HSX' ]
                    // Index 0: Ticker
                    // Index 1: Date
                    // Index 5: Close (7.7 matches last price in example)

                    rows.forEach(row => {
                        const ticker = row[0];
                        const dateVal = row[1];
                        const close = Number(row[5]);

                        if (ticker && !isNaN(close)) {
                            if (!map.has(ticker)) map.set(ticker, []);
                            // Push raw, we will sort later
                            map.get(ticker).push({
                                time: dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : String(dateVal),
                                close: close
                            });
                        }
                    });

                    // Sort all arrays by date ascending
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
        return new Map();
    }
}
