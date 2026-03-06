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

async function main() {
    const Bucket = process.env.R2_BUCKET;
    console.log("Bucket:", Bucket);

    try {
        const listCommand = new ListObjectsV2Command({
            Bucket,
            Prefix: "vnd_data/",
        });

        const response = await s3Client.send(listCommand);
        if (response.Contents) {
            for (const obj of response.Contents) {
                console.log(obj.Key, obj.Size);
            }
        } else {
            console.log("No contents found in vnd_data/");

            const listTopCommand = new ListObjectsV2Command({
                Bucket,
                Delimiter: "/"
            });
            const topResp = await s3Client.send(listTopCommand);
            if (topResp.CommonPrefixes) {
                console.log("Top level prefixes:", topResp.CommonPrefixes.map(p => p.Prefix));
            } else if (topResp.Contents) {
                console.log("Top level files:", topResp.Contents.slice(0, 10).map(p => p.Key));
            }
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

main();
