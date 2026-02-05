import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import dotenv from 'dotenv';
import { Readable } from 'stream';

dotenv.config({ path: '.env.local' });

const R2_BUCKET = process.env.R2_BUCKET;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

const r2Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

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

async function run() {
    console.log("Starting Lite Report Generation...");
    const cachePath = path.join(os.tmpdir(), "company_report_data.json");

    // 1. Ensure we have the full file
    if (!fs.existsSync(cachePath)) {
        console.log("Downloading full reports...");
        const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: "company_report_data.json" });
        const res = await r2Client.send(getCmd);
        await streamToFile(res.Body, cachePath);
    }

    const rawData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    let reports = [];
    if (Array.isArray(rawData)) {
        reports = rawData;
    } else {
        // Flatten
        for (const brokerKey in rawData) {
            const group = rawData[brokerKey];
            for (const id in group) {
                const r = group[id];
                r.id = id;
                reports.push(r);
            }
        }
    }

    console.log(`Processing ${reports.length} reports...`);

    // 2. Create Lite Version
    const liteReports = reports.map(r => ({
        id: r.id,
        info_of_report: r.info_of_report,
        recommendation: r.recommendation,
        forecast_summary: r.forecast_summary,
        // vital for filtering but small
        key_tracking: r.key_tracking ? {
            // Keep only minimal if needed, or keep all if small (0.3KB is fine)
            ...r.key_tracking
        } : null,
        // Strip heavy text/html/tables
        // forecast_table: REMOVED
        // company_update: REMOVED
        // analyst_viewpoints: REMOVED
        // risk_assessment: REMOVED
        // investment_thesis: REMOVED
        // other_info: REMOVED
    }));

    const litePath = path.join(os.tmpdir(), "company_report_data_lite.json");
    fs.writeFileSync(litePath, JSON.stringify(liteReports));

    const originalSize = fs.statSync(cachePath).size;
    const liteSize = fs.statSync(litePath).size;

    console.log(`Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Lite: ${(liteSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Reduction: ${((1 - liteSize / originalSize) * 100).toFixed(1)}%`);

    // 3. Upload to R2
    console.log("Uploading to R2...");
    const fileStream = fs.createReadStream(litePath);
    const putCmd = new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: "company_report_data_lite.json",
        Body: fileStream,
        ContentType: "application/json"
    });

    await r2Client.send(putCmd);
    console.log("Upload Complete!");
}

run().catch(console.error);
