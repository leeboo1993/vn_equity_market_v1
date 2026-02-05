import fs from 'fs';
import path from 'path';
import os from 'os';
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from './r2.js';

const streamToFile = (stream, filePath) =>
    new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        stream.pipe(file);
        stream.on("error", reject);
        file.on("finish", resolve);
    });

// Simple CSV parser (handles quoted fields)
const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = values[idx] || '';
        });
        rows.push(row);
    }

    return rows;
};

let cachedStockInfo = null;

export async function getStockInfoMap() {
    if (cachedStockInfo) return cachedStockInfo;

    const stockInfoCachePath = path.join(os.tmpdir(), "stock_information_en.csv");
    const stockInfoMap = new Map();

    try {
        let needsDownload = true;
        let localSize = 0;
        if (fs.existsSync(stockInfoCachePath)) {
            localSize = fs.statSync(stockInfoCachePath).size;
        }

        // Check if remote file exists and if we need to download
        try {
            const headCmd = new HeadObjectCommand({
                Bucket: R2_BUCKET,
                Key: "stock_information_en.csv"
            });
            const headRes = await r2Client.send(headCmd);
            const remoteSize = headRes.ContentLength;

            if (localSize > 0 && localSize === remoteSize) {
                needsDownload = false;
            }
        } catch (e) {
            if (localSize > 0) needsDownload = false;
        }

        if (needsDownload) {
            console.log(`[R2] Downloading stock_information_en.csv...`);
            const getCmd = new GetObjectCommand({
                Bucket: R2_BUCKET,
                Key: "stock_information_en.csv"
            });
            const res = await r2Client.send(getCmd);
            await streamToFile(res.Body, stockInfoCachePath);
        }

        // Parse CSV
        const fileContent = fs.readFileSync(stockInfoCachePath, 'utf8');
        const rows = parseCSV(fileContent);

        // Build map by ticker symbol
        for (const row of rows) {
            const ticker = row.symbol;
            const sector = (row.icb_name2 || '').trim();

            // Filter out invalid sectors (corrupted data, single words that aren't real sectors, etc.)
            const isValidSector = sector &&
                sector.length > 3 &&
                !sector.includes('"') &&
                !sector.toLowerCase().includes('production') &&
                !sector.toLowerCase().includes('corp');

            if (ticker) {
                stockInfoMap.set(ticker, {
                    ticker: row.symbol,
                    exchange: row.exchange || '',
                    type: row.type || '',
                    short_name: row.organ_short_name || '',
                    other_name: row.organ_name || '', // Use full name as other_name
                    industry_en: isValidSector ? sector : ''
                });
            }
        }

        console.log(`[Stock Info] Loaded ${stockInfoMap.size} stock entries`);
        cachedStockInfo = stockInfoMap;
        return stockInfoMap;

    } catch (e) {
        console.error("Error loading stock information:", e);
        return new Map();
    }
}
