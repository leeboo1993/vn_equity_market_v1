require('dotenv').config({ path: '.env.local' });
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const endpoint = process.env.R2_ENDPOINT;

const r2Client = new S3Client({
    region: "us-east-1",
    endpoint: endpoint,
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

async function main() {
    try {
        console.log("Fetching forecast_latest.json...");
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET || "broker-data",
            Key: "forecast_latest.json",
        });

        const response = await r2Client.send(command);
        const str = await response.Body.transformToString();
        const data = JSON.parse(str);

        console.log("Keys in JSON:", Object.keys(data));

        // Print the structure of the first element or overall structure
        for (const key of Object.keys(data)) {
            console.log(`\n--- Key: ${key} ---`);
            if (Array.isArray(data[key])) {
                console.log(`Type: Array of length ${data[key].length}`);
                if (data[key].length > 0) {
                    console.log("First element keys:", Object.keys(data[key][0]));
                }
            } else if (typeof data[key] === 'object' && data[key] !== null) {
                console.log("Type: Object");
                console.log("Keys:", Object.keys(data[key]).slice(0, 10));
            } else {
                console.log("Type:", typeof data[key]);
                console.log("Value:", data[key]);
            }
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
