import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { r2Client, R2_BUCKET } from '../lib/r2.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';

async function main() {
    const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: 'vnd_data/financials/VCB_financials_Q42025.json' });
    const res = await r2Client.send(cmd);
    const text = await res.Body.transformToString();
    const data = JSON.parse(text);
    console.log("Keys:", Object.keys(data.reports[0].data[0]));
    console.log("First item:", data.reports[0].data[0]);
}
main();
