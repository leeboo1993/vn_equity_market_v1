import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

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
    const key = "vnd_data/industry_analysis/vnd_industry_analysis_260311.json";
    const Bucket = process.env.R2_BUCKET;
    try {
        const command = new GetObjectCommand({ Bucket, Key: key });
        const response = await s3Client.send(command);
        let text = await response.Body.transformToString();
        text = text.replace(/:\s*NaN/g, ': null');
        const data = JSON.parse(text);
        
        console.log("Top level keys:", Object.keys(data));
        
        if (data.classification) {
            console.log("\nClassification sample (first 2):", JSON.stringify(data.classification.slice(0, 2), null, 2));
        }
        
        if (data.ratios) {
            console.log("\nRatios sample (first 5):", JSON.stringify(data.ratios.slice(0, 5), null, 2));
            const uniqueRatioCodes = new Set();
            data.ratios.forEach(r => uniqueRatioCodes.add(r.ratioCode));
            console.log("\nUnique ratio codes in global 'ratios' key:", [...uniqueRatioCodes].sort());
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
