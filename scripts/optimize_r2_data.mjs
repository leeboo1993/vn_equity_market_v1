import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Load env vars from .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const BUCKET = process.env.R2_BUCKET || "broker-data";

const r2Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const streamToString = (stream) =>
    new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });

async function optimize() {
    console.log("Starting R2 Data Optimization...");

    try {
        // 1. Download original large file
        console.log("Downloading company_report_data.json...");
        const getCmd = new GetObjectCommand({
            Bucket: BUCKET,
            Key: "company_report_data.json"
        });
        const response = await r2Client.send(getCmd);
        const dataStr = await streamToString(response.Body);
        const data = JSON.parse(dataStr);

        console.log(`Loaded ${Array.isArray(data) ? data.length : 'unknown'} items.`);

        let reports = [];
        // Normalize data same as in lib/data.js
        if (Array.isArray(data)) {
            reports = data;
        } else if (typeof data === 'object' && data !== null) {
            const values = Object.values(data);
            if (values.length > 0 && !Array.isArray(values[0])) {
                reports = values.flatMap(group => {
                    if (!group || typeof group !== 'object') return [];
                    return Object.entries(group).map(([id, r]) => {
                        if (r && typeof r === 'object') return { id, ...r }; // Inject ID if missing and used as key
                        return r;
                    });
                });
            } else {
                reports = values.flat();
            }
        }

        console.log(`Normalized to ${reports.length} reports.`);

        // 2. Separate Metadata and Content
        const metadataList = [];
        let uploadCount = 0;
        const total = reports.length;

        console.log("Processing reports...");

        // Batch upload helper
        const batchSize = 50;
        let batches = [];

        for (const report of reports) {
            // Ensure ID
            if (!report.id) {
                // If no ID, generate one or skip? 
                // We really need an ID. If it's the old format w/o ID, we might have issues.
                // Assuming normalization handled it or we use a hash/random. 
                // For now, warn and skip if truly no ID, but usually normalization ensures it.
                if (report.info_of_report?.reports_link) {
                    // desperate fallback: use filename from link
                    const parts = report.info_of_report.reports_link.split('/');
                    report.id = parts[parts.length - 1].replace('.pdf', '');
                } else {
                    console.warn("Skipping report without ID:", report.info_of_report?.title);
                    continue;
                }
            }

            // Create Meta (Lightweight)
            const {
                investment_thesis,
                company_update,
                risk_assessment,
                analyst_viewpoints,
                justification,
                ...meta
            } = report;

            metadataList.push(meta);

            // Create Full (Heavy)
            batches.push({
                Key: `reports/${report.id}.json`,
                Body: JSON.stringify(report),
                ContentType: "application/json"
            });

            if (batches.length >= batchSize) {
                await Promise.all(batches.map(b => r2Client.send(new PutObjectCommand({ Bucket: BUCKET, ...b }))));
                uploadCount += batches.length;
                console.log(`Uploaded ${uploadCount}/${total} individual reports...`);
                batches = [];
            }
        }

        // Flush remaining
        if (batches.length > 0) {
            await Promise.all(batches.map(b => r2Client.send(new PutObjectCommand({ Bucket: BUCKET, ...b }))));
            uploadCount += batches.length;
            console.log(`Uploaded ${uploadCount}/${total} individual reports.`);
        }

        // 3. Upload Metadata
        console.log("Uploading company_report_meta.json...");
        await r2Client.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: "company_report_meta.json",
            Body: JSON.stringify(metadataList),
            ContentType: "application/json"
        }));

        console.log("✅ Optimization Complete!");

    } catch (e) {
        console.error("❌ Error during optimization:", e);
    }
}

optimize();
