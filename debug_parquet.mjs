import { r2Client, R2_BUCKET } from './lib/r2.js';
import { ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { parquetRead, parquetMetadata } from 'hyparquet';

async function streamToFile(stream, filepath) {
    const writer = fs.createWriteStream(filepath);
    return new Promise((resolve, reject) => {
        stream.pipe(writer);
        writer.on('error', reject);
        writer.on('finish', resolve);
    });
}

async function debugParquet() {
    console.log("Listing Parquet files...");
    const listCmd = new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: 'cafef_data/cafef_stock_price',
    });
    const listRes = await r2Client.send(listCmd);

    if (!listRes.Contents || listRes.Contents.length === 0) {
        console.error("No parquet files found.");
        return;
    }

    const files = listRes.Contents.filter(i => i.Key.endsWith('.parquet'));
    files.sort((a, b) => b.Key.localeCompare(a.Key));

    if (files.length === 0) {
        console.log("No .parquet files match.");
        return;
    }

    const latest = files[0];
    console.log(`Latest file: ${latest.Key} (${latest.Size} bytes)`);

    const localPath = 'debug_latest.parquet';
    if (fs.existsSync(localPath) && fs.statSync(localPath).size === latest.Size) {
        console.log("Using cached file.");
    } else {
        console.log("Downloading...");
        const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: latest.Key });
        const getRes = await r2Client.send(getCmd);
        await streamToFile(getRes.Body, localPath);
        console.log("Downloaded.");
    }

    try {
        console.log("Parsing with hyparquet...");
        const buffer = fs.readFileSync(localPath);
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        const metadata = parquetMetadata(arrayBuffer);
        console.log("Schema:", JSON.stringify(metadata.schema, null, 2));

        await new Promise((resolve, reject) => {
            parquetRead({
                file: arrayBuffer,
                onComplete: (data) => {
                    console.log("Row Count:", data.length);
                    if (data.length > 0) {
                        console.log("First Record:", data[0]);
                    }
                    resolve();
                }
            });
        });
        console.log("SUCCESS");
    } catch (e) {
        console.error("Parse Failed:", e);
    }
}

debugParquet();
