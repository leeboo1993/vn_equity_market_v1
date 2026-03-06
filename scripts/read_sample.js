import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

async function streamToString(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
}

async function analyzeFile(key) {
    console.log(`\n--- Analyzing ${key} ---`);
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: key,
        });
        const response = await s3Client.send(command);
        const text = await streamToString(response.Body);
        const data = JSON.parse(text);

        if (Array.isArray(data)) {
            if (data.length > 0) {
                console.log("First item:", JSON.stringify(data[0]));
            }
        } else {
            for (let k of Object.keys(data).slice(0, 5)) {
                const val = data[k];
                if (Array.isArray(val)) {
                    if (val.length > 0) console.log(`  ${k} First item:`, JSON.stringify(val[0]));
                } else {
                    console.log(`  ${k}: ${val}`);
                }
            }
        }
    } catch (err) {
        console.error(`Error reading ${key}:`, err.message);
    }
}

async function main() {
    await analyzeFile("vnd_data/market_valuation/vnd_market_valuation_260304.json");
    await analyzeFile("vnd_data/industry_analysis/vnd_industry_analysis_260304.json");
    await analyzeFile("vnd_data/financials/VND_financials_Q52025.json");
}
main();
