import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env.local") });

console.log("R2_ENDPOINT:", process.env.R2_ENDPOINT);
console.log("R2_BUCKET:", process.env.R2_BUCKET);

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

async function main() {
    const key = "cafef_data/dl_equity/market.json";
    try {
        console.log(`Starting fetch for ${key}...`);
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: key,
        });
        const response = await s3Client.send(command);
        console.log("Response received. Parsing body...");
        const text = await streamToString(response.Body);
        console.log("Text length:", text.length);
        const data = JSON.parse(text);
        console.log("JSON Parsed successfully.");

        console.log("Sector Flows keys:", Object.keys(data.sector_flows?.[0] || {}));
        console.log("Participant types:", Array.from(new Set(data.sector_flows?.map(f => f.participant) || [])));
        
        if (data.sector_flows && data.sector_flows.length > 0) {
            console.log("SAMPLE ENTRY:", JSON.stringify(data.sector_flows[0]));
        }

    } catch (err) {
        console.error("FATAL ERROR:", err.message);
        console.error(err.stack);
    }
}

main();
