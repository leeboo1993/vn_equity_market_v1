require('dotenv').config({ path: '.env.local' });
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");

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
    try {
        console.log("Listing objects in R2...");
        let isTruncated = true;
        let continuationToken;
        const txtFiles = [];

        while (isTruncated) {
            const command = new ListObjectsV2Command({
                Bucket: process.env.R2_BUCKET || "broker-data",
                ContinuationToken: continuationToken,
            });

            const response = await r2Client.send(command);

            if (response.Contents) {
                for (const obj of response.Contents) {
                    const key = obj.Key.toLowerCase();
                    if (key.includes('model') || key.endsWith('.txt') || key.includes('report') || key.includes('industry')) {
                        txtFiles.push({ key: obj.Key, size: obj.Size, date: obj.LastModified });
                    }
                }
            }

            isTruncated = response.IsTruncated;
            continuationToken = response.NextContinuationToken;
        }

        console.log("Found potentially relevant files:");
        txtFiles.sort((a, b) => b.date - a.date).slice(0, 20).forEach(f => {
            console.log(`- ${f.key} (${Math.round(f.size / 1024)}KB) - ${f.date}`);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
