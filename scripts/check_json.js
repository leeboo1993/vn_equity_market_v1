import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
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
    const Bucket = process.env.R2_BUCKET;
    try {
        const listCmd = new ListObjectsV2Command({ Bucket, Prefix: "vnd_data/financials/VCB_financials_" });
        const listResult = await s3Client.send(listCmd);
        const files = (listResult.Contents || []).filter(f => f.Key.endsWith('.json'));
        files.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));

        const getCmd = new GetObjectCommand({ Bucket, Key: files[0].Key });
        const res = await s3Client.send(getCmd);
        const raw = await res.Body.transformToString();
        const data = JSON.parse(raw);
        if (data.reports && data.reports.length > 0) {
            const firstData = data.reports[0].data;
            console.log("Total items:", firstData.length);
            console.log("Count by stmtType:", {
                IS: firstData.filter(d => d.stmtType === "IS").length,
                BS: firstData.filter(d => d.stmtType === "BS").length,
                CF: firstData.filter(d => d.stmtType === "CF").length,
                Unknown: firstData.filter(d => !d.stmtType).length
            });
            console.log("First IS item:", firstData.find(d => d.stmtType === "IS"));
        }
    } catch (e) { console.error(e); }
}
main();
