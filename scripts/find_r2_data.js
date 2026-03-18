import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
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

async function findFiles(prefix) {
    console.log(`\n--- Files with prefix: ${prefix} ---`);
    const Bucket = process.env.R2_BUCKET;
    try {
        const listCommand = new ListObjectsV2Command({
            Bucket,
            Prefix: prefix,
        });
        const response = await s3Client.send(listCommand);
        if (response.Contents) {
            const sorted = response.Contents.sort((a, b) => b.Key.localeCompare(a.Key));
            sorted.slice(0, 5).forEach(obj => {
                console.log(obj.Key, obj.Size, obj.LastModified);
            });
        } else {
            console.log("No files found.");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

async function main() {
    await findFiles("vnd_data/market_valuation/");
    await findFiles("vnd_data/industry_analysis/");
}

main();
