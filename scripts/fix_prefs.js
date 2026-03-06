import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { r2Client, R2_BUCKET } from '../lib/r2.js';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

async function main() {
    const prefix = process.env.PROJECT_ID ? `${process.env.PROJECT_ID}_` : '';
    const PREFS_FILE = `${prefix}financial_row_preferences.json`;
    console.log("File:", PREFS_FILE);

    try {
        const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: PREFS_FILE });
        const res = await r2Client.send(cmd);
        const text = await res.Body.transformToString();
        let prefs = JSON.parse(text);
        console.log("Current Prefs:", JSON.stringify(prefs, null, 2));

        // Fix the specific garbled name for 421100 if present
        if (prefs.rows && prefs.rows["421100"]) {
            prefs.rows["421100"].name = "Net Interest Income"; // Or just remove the name override
            console.log("Fixed 421100 name");
        }

        // Clean up any other potential garbled names
        for (let code in prefs.rows) {
            if (prefs.rows[code].name && prefs.rows[code].name.includes("Interest and simil")) {
                prefs.rows[code].name = "Net Interest Income";
            }
        }

        const putCmd = new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: PREFS_FILE,
            Body: JSON.stringify(prefs),
            ContentType: 'application/json'
        });
        await r2Client.send(putCmd);
        console.log("✅ Preferences fixed and saved to R2");
    } catch (e) {
        console.error("Error:", e.message);
    }
}
main();
