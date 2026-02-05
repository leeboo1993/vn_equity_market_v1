import { r2Client, R2_BUCKET } from './lib/r2.js';
import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { Readable } from 'stream';

// Load env vars
dotenv.config({ path: '.env.local' });

const streamToFile = (stream, filePath) =>
    new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filePath);
        stream.pipe(file);
        stream.on("error", reject);
        file.on("finish", resolve);
    });

async function verify() {
    console.log("Checking R2 Connection...");
    console.log("Endpoint:", process.env.R2_ENDPOINT);

    const filesToCheck = [
        "company_report_data.json",
        "stock_information.csv",
        "cafef_data/stock_information.csv",
        "data/company_report_data.json"
    ];

    console.log("\n1. Checking for critical files...");

    for (const key of filesToCheck) {
        try {
            const cmd = new GetObjectCommand({ // Using GetObject because HeadObject sometimes requires different permissions, though Head is better. Let's stick to Head if possible, but Get with Range might be safer? No, Head is standard.
                Bucket: process.env.R2_BUCKET || R2_BUCKET,
                Key: key
            });
            // Actually lets just list with prefix to be sure of case sensitivity etc
            // But HEAD is faster.
            const headCmd = new ListObjectsV2Command({
                Bucket: process.env.R2_BUCKET || R2_BUCKET,
                Prefix: key,
                MaxKeys: 1
            });
            const res = await r2Client.send(headCmd);

            if (res.Contents && res.Contents.length > 0 && res.Contents[0].Key === key) {
                console.log(`✅ FOUND: ${key} (${res.Contents[0].Size} bytes)`);
            } else {
                console.log(`❌ MISSING: ${key}`);
            }
        } catch (e) {
            console.log(`❌ ERROR checking ${key}:`, e.message);
        }
    }

    // NEW: Try to download and parse company_report_data.json
    console.log("\n2. STRESS TEST: Downloading and Parsing company_report_data.json...");
    const reportPath = path.join(os.tmpdir(), "test_company_report.json");
    try {
        const cmd = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET || R2_BUCKET,
            Key: "company_report_data.json"
        });
        const res = await r2Client.send(cmd);

        console.log("Downloading...");
        const start = Date.now();
        await streamToFile(res.Body, reportPath);
        const dlTime = Date.now() - start;
        console.log(`Downloaded in ${dlTime}ms`);

        const size = fs.statSync(reportPath).size;
        console.log(`Size on disk: ${size} bytes`);

        console.log("Parsing JSON...");
        const pStart = Date.now();
        const content = fs.readFileSync(reportPath, 'utf8');
        const data = JSON.parse(content);
        console.log(`Parsed in ${Date.now() - pStart}ms.`);

        // ...

        console.log(`Parsed in ${Date.now() - pStart}ms.`);

        // ...

        console.log(`Parsed in ${Date.now() - pStart}ms.`);

        let allReports = [];
        if (Array.isArray(data)) {
            allReports = data;
        } else if (typeof data === 'object' && data !== null) {
            console.log("Flattening object values...");
            // Try determine if values are arrays or objects
            const values = Object.values(data);
            if (values.length > 0 && !Array.isArray(values[0])) {
                console.log("Detected nested objects (Broker -> { ID: Report }). Flattening and injecting ID...");
                allReports = values.flatMap(brokerGroup =>
                    Object.entries(brokerGroup).map(([id, report]) => {
                        // Sometimes report might be further nested or just the object
                        // Based on log: {"id": {info...}}
                        // So report is {info...}
                        if (report.info_of_report) return { id, ...report };
                        // What if it is {"report_id": { ... }} inside the array?
                        // If brokerGroup is { "id": content }, this works.
                        return { id, ...report };
                    })
                );
            } else {
                allReports = values.flat();
            }
        }

        console.log(`Total items after normalization: ${allReports.length}`);
        // ...

        console.log(`Total items after flattening: ${allReports.length}`);
        if (allReports.length > 0) {
            console.log("Sample item keys:", Object.keys(allReports[0]));
            const withId = allReports.filter(r => r.id).length;
            console.log(`Items with 'id': ${withId} / ${allReports.length}`);

            if (withId < allReports.length) {
                console.warn("⚠️ SOME ITEMS MISS ID!");
                const missing = allReports.find(r => !r.id);
                console.log("Sample missing ID item:", JSON.stringify(missing).slice(0, 200));
            }
        }

        // ...

        console.log("✅ SUCCESS: Data is valid and parsable.");

    } catch (e) {
        console.error("❌ FAILURE during download/parse:", e);
    }
}

verify();
