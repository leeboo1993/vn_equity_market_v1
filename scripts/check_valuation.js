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
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString("utf8");
}

async function main() {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: "vnd_data/market_valuation/vnd_market_valuation_260304.json",
        });
        const response = await s3Client.send(command);
        const text = await streamToString(response.Body);
        const data = JSON.parse(text);

        console.log("Ratios count:", data.ratios.length);
        console.log("First 3 ratios:", data.ratios.slice(0, 3));

        const keys = new Set();
        data.ratios.forEach(r => Object.keys(r).forEach(k => keys.add(k)));
        console.log("Keys in ratios:", Array.from(keys));

        const ratioCodes = new Set();
        data.ratios.forEach(r => { if (r.ratioCode) ratioCodes.add(r.ratioCode); });
        console.log("Ratio codes found:", Array.from(ratioCodes));

    } catch (err) {
        console.error(err);
    }
}

main();
