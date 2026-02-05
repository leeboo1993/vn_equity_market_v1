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

            // Filter by Date (3 Years ~ 2022+)
            const dateStr = report.info_of_report?.date_of_issue;
            let keep = false;

            if (dateStr) {
                // Try YYMMDD
                let year = 0;
                const s = String(dateStr).trim();
                if (s.length === 6 && !isNaN(s)) {
                    // 22xxxx -> 2022
                    year = 2000 + parseInt(s.substring(0, 2));
                    // If year > 2050 likely parsing error or old 1990s (unlikely for this data), 
                    // but let's assume valid range.
                } else if (!isNaN(new Date(dateStr).getFullYear())) {
                    year = new Date(dateStr).getFullYear();
                }

                if (year >= 2022) keep = true;
            } else {
                // If no date, maybe keep? Or drop? 
                // Let's drop to be safe for size.
                keep = false;
            }

            if (!keep) continue;

            // Create Meta (Lightweight)
            const {
                investment_thesis,
                company_update,
                risk_assessment,
                justification,
                forecast_table, // HEAVY
                key_tracking,   // HEAVY
                other_info,     // HEAVY
                ...metaRest
            } = report;

            // Deep clone to safely remove nested justification without affecting original if needed
            // But we already extracted top-level heavy fields. 
            // `justification` might be inside `recommendation`!

            const meta = { ...metaRest };
            if (meta.recommendation) {
                const { justification, ...recRest } = meta.recommendation;
                meta.recommendation = recRest;
            }

            // Remove any other potential heavy arrays that might be variable
            // e.g. extracted_data, tables
            delete meta.extracted_data;
            delete meta.tables;

            metadataList.push(meta);

            // SKIP Detail Upload (Assuming already done)
            // batches.push({
            //     Key: `reports/${report.id}.json`,
            //     Body: JSON.stringify(report),
            //     ContentType: "application/json"
            // });

            // if (batches.length >= batchSize) {
            //     await Promise.all(batches.map(b => r2Client.send(new PutObjectCommand({ Bucket: BUCKET, ...b }))));
            //     uploadCount += batches.length;
            //     console.log(`Uploaded ${uploadCount}/${total} individual reports...`);
            //     batches = [];
            // }
        }

        // Flush remaining
        // if (batches.length > 0) {
        //     await Promise.all(batches.map(b => r2Client.send(new PutObjectCommand({ Bucket: BUCKET, ...b }))));
        //     uploadCount += batches.length;
        //     console.log(`Uploaded ${uploadCount}/${total} individual reports.`);
        // }

        console.log(`Filtered to ${metadataList.length} recent reports (>= 2022).`);

        // 3. Upload Metadata
        console.log("Uploading filtered company_report_meta.json...");
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

optimize().then(async () => {
    // Dynamically import the trigger script to avoid top-level await issues if not supported
    try {
        const { triggerRebuild } = await import('./trigger_rebuild.mjs');
        await triggerRebuild();
    } catch (e) {
        console.error("Failed to load trigger script:", e);
    }
});
