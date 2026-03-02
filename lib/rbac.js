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
const FEATURES_FILE = `${prefix}features.json`;

// Default configuration for the ORIGINAL website
const DEFAULT_FEATURES_OLD = {
    'Daily Tracking': ['admin', 'member', 'guest'],
    'Company Research': ['admin', 'member'],
    'Macro Research': ['admin'], // Admin only
    'Strategy Research': ['admin', 'member'],
    'Broker Sentiment': ['admin', 'member'],
    'VN-Index Forecast': ['admin', 'member'],
    'DL Equity': ['admin', 'member'],
    'Export Data': ['admin'],
};

// Default configuration for the NEW website (more restrictive out-of-the-box)
const DEFAULT_FEATURES_NEW = {
    'Daily Tracking': ['admin', 'member', 'guest'],
    'Company Research': ['admin'],
    'Macro Research': ['admin'],
    'Strategy Research': ['admin'],
    'Broker Sentiment': ['admin'],
    'VN-Index Forecast': ['admin'],
    'DL Equity': ['admin'],
    'Export Data': ['admin'],
};

const DEFAULT_FEATURES = process.env.PROJECT_ID ? DEFAULT_FEATURES_NEW : DEFAULT_FEATURES_OLD;


export async function getFeatureSettings() {
    try {
        const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: FEATURES_FILE });
        const res = await r2Client.send(cmd);
        const body = await res.Body.transformToString();
        return JSON.parse(body);
    } catch (e) {
        if (e.name === 'NoSuchKey') return DEFAULT_FEATURES;
        return DEFAULT_FEATURES;
    }
}

export async function saveFeatureSettings(features) {
    try {
        const cmd = new PutObjectCommand({
            Bucket: R2_BUCKET,
            Key: FEATURES_FILE,
            Body: JSON.stringify(features, null, 2),
            ContentType: 'application/json',
        });
        await r2Client.send(cmd);
    } catch (e) {
        console.error("Error saving features:", e);
    }
}

export function hasAccess(userRole, featureName, settings) {
    if (!userRole) return false;
    if (userRole === 'admin') return true; // Admin always has access

    const allowedRoles = settings[featureName] || [];
    return allowedRoles.includes(userRole);
}
