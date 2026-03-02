import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { resolve } from 'path';
import { config } from 'dotenv';
config({ path: resolve(__dirname, '.env.local') });

const r2Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

async function test() {
    try {
        const cmd = new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: 'cafef_data/dl_equity/research.json' });
        const res = await r2Client.send(cmd);
        const str = await res.Body.transformToString();
        const data = JSON.parse(str);
        console.log(JSON.stringify(data.macro_research.slice(0, 2), null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
