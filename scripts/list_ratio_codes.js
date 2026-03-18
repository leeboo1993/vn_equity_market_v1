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
        const command = new GetObjectCommand({ Bucket, Key });
        const response = await s3Client.send(command);
        const stream = response.Body;
        
        const ratioCodes = new Map();
        let buffer = '';
        let count = 0;
        
        for await (const chunk of stream) {
            buffer += new TextDecoder().decode(chunk);
            count += chunk.length;
            
            // Look for ratioCode and itemName
            const regex = /"ratioCode":\s*"([^"]*)",\s*"itemName":\s*"([^"]*)"/g;
            let match;
            while ((match = regex.exec(buffer)) !== null) {
                ratioCodes.set(match[1], match[2]);
            }
            
            // Keep buffer reasonable
            if (buffer.length > 500000) buffer = buffer.substring(400000);
            
            if (count > 50000000) break; // First 50MB should be enough to see codes
        }
        
        console.log("Unique Ratio Codes found:");
        for (const [code, name] of ratioCodes) {
            console.log(`${code}: ${name}`);
        }
        
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
