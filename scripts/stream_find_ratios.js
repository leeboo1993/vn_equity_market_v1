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
        
        let found = false;
        let buffer = '';
        let count = 0;
        
        for await (const chunk of stream) {
            buffer += new TextDecoder().decode(chunk);
            count += chunk.length;
            
            if (buffer.includes('"ratios":')) {
                const index = buffer.indexOf('"ratios":');
                const slice = buffer.substring(index, index + 2000);
                fs.writeFileSync("/tmp/ratios_sample.json", slice);
                console.log(`Found ratios at offset ~${count}. Saved sample to /tmp/ratios_sample.json`);
                found = true;
                break;
            }
            
            // Keep buffer reasonable
            if (buffer.length > 200000) buffer = buffer.substring(100000);
            
            if (count > 200000000) { // Limit to 200MB (whole file basically)
                console.log("Reached limit without finding ratios");
                break;
            }
        }
        
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
