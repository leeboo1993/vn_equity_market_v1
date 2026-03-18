import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");
dotenv.config({ path: envPath });

const s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

async function main() {
    const Bucket = process.env.R2_BUCKET;
    const Key = "vnd_data/industry_analysis/vnd_industry_analysis_260312.json";
    
    try {
        const command = new GetObjectCommand({ 
            Bucket, 
            Key,
            Range: "bytes=0-200000" // Fetch first 200KB
        });
        const response = await s3Client.send(command);
        let text = await response.Body.transformToString();
        
        fs.writeFileSync("/tmp/chunk_industry.json", text);
        console.log("Saved 200KB chunk to /tmp/chunk_industry.json");
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
