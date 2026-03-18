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
        const decoder = new TextDecoder();
        
        for await (const chunk of stream) {
            buffer += decoder.decode(chunk);
            if (buffer.includes('"englishName": "Banks"') || buffer.includes('"englishName": "Construction & Materials"')) {
                const searchStr = buffer.includes('"englishName": "Banks"') ? '"englishName": "Banks"' : '"englishName": "Construction & Materials"';
                const start = buffer.indexOf('{', buffer.lastIndexOf(searchStr) - 2000);
                if (start === -1) continue;
                
                let braceCount = 0;
                let end = -1;
                for (let i = start; i < buffer.length; i++) {
                    if (buffer[i] === '{') braceCount++;
                    else if (buffer[i] === '}') {
                        braceCount--;
                        if (braceCount === 0) {
                            end = i;
                            break;
                        }
                    }
                }
                
                if (end !== -1) {
                    const objStr = buffer.substring(start, end + 1);
                    const obj = JSON.parse(objStr.replace(/:\s*NaN/g, ': null'));
                    const peRatios = (obj.ratios || []).filter(r => r.ratioCode.trim() === 'PRICE_TO_EARNINGS');
                    console.log(`Industry: ${obj.englishName}`);
                    console.log(`Total PE ratio entries: ${peRatios.length}`);
                    if (peRatios.length > 0) {
                        console.log(`Date Range: ${peRatios[peRatios.length - 1].reportDate} to ${peRatios[0].reportDate}`);
                        console.log(`Sample PE 1:`, peRatios[0]);
                    }
                    found = true;
                    break;
                }
            }
            if (buffer.length > 5000000) buffer = buffer.substring(2500000);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
