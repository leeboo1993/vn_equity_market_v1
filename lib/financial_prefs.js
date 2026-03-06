import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

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

const prefix = process.env.PROJECT_ID ? `${process.env.PROJECT_ID}_` : '';
const PREFS_FILE = `${prefix}financial_row_preferences.json`;

// Default empty preferences if the file doesn't exist yet
// Format: { "rows": { "421600": { hidden: true, name: "Custom Name", unit: "B" } } }
const DEFAULT_PREFS = {
    rows: {}
};

export async function getFinancialPrefs() {
    try {
        const cmd = new GetObjectCommand({
            Bucket: R2_BUCKET,
            Key: PREFS_FILE,
            IfNoneMatch: `"no-cache-${Date.now()}"`
        });
        const res = await r2Client.send(cmd);
        const body = await res.Body.transformToString();
        const storedPrefs = JSON.parse(body);

        return { ...DEFAULT_PREFS, ...storedPrefs };
    } catch (e) {
        if (e.name === 'NoSuchKey') return DEFAULT_PREFS;
        console.error("Error fetching financial row preferences:", e);
        return DEFAULT_PREFS;
    }
}

export async function saveFinancialPrefs(prefs) {
    try {
        const cmd = new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: PREFS_FILE,
            Body: JSON.stringify(prefs, null, 2),
            ContentType: 'application/json',
        });
        await r2Client.send(cmd);
    } catch (e) {
        console.error("Error saving financial row preferences:", e);
    }
}
