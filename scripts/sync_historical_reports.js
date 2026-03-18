import fs from 'fs';
import path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const r2Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const BUCKET = process.env.R2_BUCKET;
const SOURCE_FILE = '/Users/leeboo/Desktop/broker_data/others/github_automation_data/vnindex_github_action/data/vnindex_model_260309.json';
const PREFIX = 'vnindex_model_data/';

async function sync() {
    console.log(`Reading source file: ${SOURCE_FILE}...`);
    const data = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
    console.log(`Found ${data.length} records.`);

    // Iterate in chunks to avoid overwhelming the network
    for (let i = 0; i < data.length; i++) {
        const entry = data[i];
        const dateStr = entry.date; // YYYY-MM-DD
        const yymmdd = dateStr.replace(/-/g, '').substring(2); // YYMMDD
        const key = `${PREFIX}vnindex_model_${yymmdd}.json`;

        if (i % 10 === 0) {
            process.stdout.write(`(${i + 1}/${data.length}) Uploading... `);
        }

        try {
            await r2Client.send(new PutObjectCommand({
                Bucket: BUCKET,
                Key: key,
                Body: JSON.stringify(entry),
                ContentType: 'application/json',
            }));
            if (i % 10 === 0) console.log('✅');
        } catch (err) {
            console.log(`❌ Error at ${key}: ${err.message}`);
        }
    }

    console.log('\n--- SYNC COMPLETE ---');
}

sync().catch(console.error);
