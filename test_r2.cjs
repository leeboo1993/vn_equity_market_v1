require('dotenv').config({ path: '.env.local' });
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
async function main() {
    console.log("Fetching R2 objects...");
    const command = new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET, Prefix: "cafef_data/" });
    const response = await r2Client.send(command);
    if (!response.Contents) {
        console.log("No contents found.");
        return;
    }
    const keys = response.Contents.map(c => c.Key).filter(k => k.includes('bond') || k.includes('hnx') || k.includes('gov'));
    console.log("Found keys:", keys);
}
main().catch(console.error);
