import fs from 'fs';
import path from 'path';
import os from 'os';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Setup R2 Client
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
        stream.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

(async () => {
    try {
        console.log("Fetching meta sample...");
        const metaPath = path.join(os.tmpdir(), "company_report_meta_debug.json");

        // Always download fresh to be sure
        console.log(`[R2] Downloading company_report_meta.json...`);
        const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: "company_report_meta.json" });
        const res = await r2Client.send(getCmd);
        await streamToFile(res.Body, metaPath);

        const reports = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        console.log(`Total reports: ${reports.length}`);

        // Check for future dates
        const futureReports = [];
        reports.forEach(r => {
            const d = r.info_of_report?.date_of_issue; // YYMMDD
            if (d && d.length === 6) {
                const yy = parseInt(d.substring(0, 2), 10);
                const year = 2000 + yy;
                if (year > 2025) {
                    futureReports.push({ id: r.id, date: d, year });
                }
            }
        });

        if (futureReports.length > 0) {
            console.log(`⚠️ FOUND ${futureReports.length} FUTURE REPORTS!`);
            console.log(JSON.stringify(futureReports, null, 2));
        } else {
            console.log("✅ No reports found with year > 2025");
        }

    } catch (e) {
        console.error("Error:", e);
    }
})();
