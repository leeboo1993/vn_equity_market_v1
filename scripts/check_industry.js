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

        console.log("Classification count:", data.classification.length);
        console.log("First classification:", data.classification[0]);

        console.log("Ratios count:", data.ratios.length);
        console.log("First 3 ratios:", data.ratios.slice(0, 3));

        const ratioCodes = new Set();
        data.ratios.forEach(r => ratioCodes.add(`${r.ratioCode}: ${r.itemName}`));
        console.log(`Unique ratio codes: ${ratioCodes.size}. Showing first 10:`, Array.from(ratioCodes).slice(0, 10));

        // Find sample data for Gross Profit Margin if possible (Tỷ suất lợi nhuận gộp biên)
        const gpmRatios = data.ratios.filter(r => r.itemName && r.itemName.toLowerCase().includes('gộp'));
        console.log("GPM Ratios count:", gpmRatios.length);
        if (gpmRatios.length > 0) console.log("Sample GPM Ratio:", gpmRatios[0]);

    } catch (err) {
        console.error(err);
    }
}

main();
