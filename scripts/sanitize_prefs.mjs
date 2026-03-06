import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const client = new S3Client({
    region: "us-east-1",
    endpoint: process.env.R2_ENDPOINT,
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

async function main() {
    const bucket = process.env.R2_BUCKET || "broker-data";
    const key = "vnequity_financial_row_preferences.json";
    try {
        const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
        const res = await client.send(cmd);
        const text = await res.Body.transformToString();
        let prefs = JSON.parse(text);
        console.log("Current Prefs Found.");
        
        let fixed = false;
        if (prefs.rows) {
            for (let code in prefs.rows) {
                if (prefs.rows[code].name && (prefs.rows[code].name.includes("interest") || prefs.rows[code].name.includes("Interest"))) {
                    if (prefs.rows[code].name.length > 50 || prefs.rows[code].name.includes("Incomenterest") || prefs.rows[code].name.includes("similIInterest")) {
                        console.log("Fixing garbled name for", code, ":", prefs.rows[code].name);
                        prefs.rows[code].name = code === "421100" ? "Interest Income" : "Interest Income (Other)";
                        fixed = true;
                    }
                }
            }
        }

        if (fixed) {
            await client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: JSON.stringify(prefs, null, 2),
                ContentType: "application/json"
            }));
            console.log("✅ Fixed and saved preferences.");
        } else {
            console.log("No garbled names found.");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
main();
