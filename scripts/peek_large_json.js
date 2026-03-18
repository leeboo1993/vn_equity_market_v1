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

async function streamToString(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
}

// Read only the first 50KB to see the structure
async function peekFile(key) {
    console.log(`\n--- Peeking ${key} ---`);
    const Bucket = process.env.R2_BUCKET;
    try {
        const command = new GetObjectCommand({
            Bucket,
            Key: key,
            Range: "bytes=0-50000"
        });
        const response = await s3Client.send(command);
        const text = await streamToString(response.Body);
        console.log("Characters read:", text.length);
        console.log("Start of content:", text.substring(0, 1000));
        
        // Try to find keys
        const keys = text.match(/"([^"]+)":/g);
        if (keys) {
            console.log("Found possible top level keys:", [...new Set(keys)].slice(0, 20));
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

async function main() {
    const key = process.argv[2] || "vnd_data/industry_analysis/vnd_industry_analysis_260311.json";
    await peekFile(key);
}

main();
