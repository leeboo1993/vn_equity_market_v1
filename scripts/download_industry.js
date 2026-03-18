import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

async function downloadFile(key, destination) {
    console.log(`Downloading ${key} to ${destination}...`);
    try {
        const response = await s3Client.send(new GetObjectCommand({
            Bucket: process.env.R2_BUCKET || "broker-data",
            Key: key,
        }));
        
        const stream = response.Body;
        const writer = fs.createWriteStream(destination);
        
        await new Promise((resolve, reject) => {
            stream.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        console.log("Download complete.");
    } catch (error) {
        console.error("Download failed:", error);
    }
}

async function main() {
    await downloadFile("vnd_data/industry_analysis/vnd_industry_analysis_260312.json", "/tmp/industry_full.json");
}

main();
