require('dotenv').config({ path: '.env.local' });
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const r2Client = new S3Client({
    region: "us-east-1",
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

async function main() {
    const command = new GetObjectCommand({ Bucket: process.env.R2_BUCKET || "broker-data", Key: "cafef_data/website/latest_report.txt" });
    const response = await r2Client.send(command);
    const text = await response.Body.transformToString();
    console.log(text);
}
main();
