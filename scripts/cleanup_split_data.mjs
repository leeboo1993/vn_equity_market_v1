import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Setup R2 Client
const R2_BUCKET = process.env.R2_BUCKET;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

const r2Client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

async function deleteFolder(prefix) {
    console.log(`Deleting items with prefix: ${prefix}...`);
    let continuationToken = undefined;
    let totalDeleted = 0;

    do {
        // List objects
        const listCmd = new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            Prefix: prefix,
            ContinuationToken: continuationToken
        });
        const listRes = await r2Client.send(listCmd);

        if (!listRes.Contents || listRes.Contents.length === 0) {
            break;
        }

        // Prepare delete request
        const objectsToDelete = listRes.Contents.map(obj => ({ Key: obj.Key }));
        const deleteCmd = new DeleteObjectsCommand({
            Bucket: R2_BUCKET,
            Delete: { Objects: objectsToDelete }
        });

        const deleteRes = await r2Client.send(deleteCmd);
        const deletedCount = deleteRes.Deleted ? deleteRes.Deleted.length : 0;
        totalDeleted += deletedCount;
        console.log(`Deleted batch of ${deletedCount} items...`);

        if (deleteRes.Errors && deleteRes.Errors.length > 0) {
            console.error("Errors deleting some objects:", deleteRes.Errors);
        }

        continuationToken = listRes.IsTruncated ? listRes.NextContinuationToken : undefined;

    } while (continuationToken);

    console.log(`✅ Finished deleting prefix ${prefix}. Total deleted: ${totalDeleted}`);
}

(async () => {
    try {
        console.log("⚠️ STARTING CLEANUP OF SPLIT DATA ⚠️");

        // 1. Delete company_report_meta.json
        try {
            console.log("Deleting company_report_meta.json...");
            await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: "company_report_meta.json" }));
            console.log("✅ Deleted company_report_meta.json");
        } catch (e) {
            console.log("Info: Could not delete meta file (maybe already gone).", e.message);
        }

        // 2. Delete reports/*
        await deleteFolder("reports/");

        console.log("🎉 CLEANUP COMPLETE");
    } catch (e) {
        console.error("Refatal error:", e);
    }
})();
