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
    const command = new GetObjectCommand({ Bucket: process.env.R2_BUCKET || "broker-data", Key: "forecast_latest.json" });
    const response = await r2Client.send(command);
    const data = JSON.parse(await response.Body.transformToString());
    console.log("META:", JSON.stringify(data.meta, null, 2));
    console.log("FORECAST:", JSON.stringify(data.forecast, null, 2));
    console.log("CHART (first 2):", JSON.stringify(data.chart.slice(0, 2), null, 2));
}
main();
