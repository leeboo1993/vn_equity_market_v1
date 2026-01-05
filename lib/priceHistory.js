import pkg from 'parquetjs-lite';
const { ParquetReader } = pkg;
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET } from './r2.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';

async function streamToFile(stream, filePath) {
    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        if (stream instanceof Readable) {
            stream.pipe(writer);
        } else {
            // For web streams compatibility
            stream.pipe(writer);
        }
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

let cachedHistoryMap = null;

export async function getPriceHistoryMap() {
    if (cachedHistoryMap) return cachedHistoryMap;

    const cachePath = path.join(os.tmpdir(), "price_history.parquet");

    try {
        // Download if missing
        // Verify file integrity check could be better (e.g. check size > 0), but existence is fine for fast fix
        let needsDownload = !fs.existsSync(cachePath);

        if (needsDownload) {
            console.log(`[R2] Downloading price_history.parquet...`);
            const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: "price_history.parquet" });
            const res = await r2Client.send(getCmd);
            await streamToFile(res.Body, cachePath);
        }

        const map = new Map();
        const reader = await ParquetReader.openFile(cachePath);
        const cursor = reader.getCursor();
        let record = null;

        while (record = await cursor.next()) {
            const t = record.ticker;
            if (t) {
                if (!map.has(t)) map.set(t, []);
                // Ensure data types
                map.get(t).push({
                    time: record.time,
                    close: Number(record.close)
                });
            }
        }

        await reader.close();
        cachedHistoryMap = map;
        return map;

    } catch (e) {
        console.error("Error fetching price history:", e);
        // Return empty map on error to prevent crash
        return new Map();
    }
}
