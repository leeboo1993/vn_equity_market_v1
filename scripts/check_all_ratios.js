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
            Key: "vnd_data/industry_analysis/vnd_industry_analysis_260304.json",
        });
        const response = await s3Client.send(command);
        const text = await streamToString(response.Body);
        const data = JSON.parse(text);

        const ratioCodes = new Set();
        data.ratios.forEach(r => ratioCodes.add(`${r.ratioCode}: ${r.itemName}`));
        const uniqueCodes = Array.from(ratioCodes);
        console.log(`Unique ratio codes: ${uniqueCodes.length}. Showing all:`);
        uniqueCodes.forEach(c => console.log(c));
    } catch (err) {
        console.error(err);
    }
}

main();
