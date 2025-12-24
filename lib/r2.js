import { S3Client } from "@aws-sdk/client-s3";

if (!process.env.R2_ACCOUNT_ID && !process.env.R2_ENDPOINT) {
    // Should be handled by .env, but purely for this session I might need to know if they are missing
    // console.warn("Missing R2 credentials");
}

// Construct endpoint if account ID is provided, otherwise use explicit ENDPOINT env
const endpoint = process.env.R2_ENDPOINT;

export const r2Client = new S3Client({
    region: "us-east-1", // R2 doesn't care about region, but SDK needs a valid one
    endpoint: endpoint,
    forcePathStyle: true, // Critical for R2/non-AWS S3
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
    },
});

export const R2_BUCKET = process.env.R2_BUCKET || "broker-data";
