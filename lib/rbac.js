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
    // Top-Level Sidebar Links
    'Price Board': ['admin', 'member', 'guest'],
    'Research': ['admin', 'member'],
    'Market Dashboard': ['admin', 'member', 'guest'],

    // Tab-level: Broker Consensus
    'Broker Consensus - Daily': ['admin', 'member'],
    'Broker Consensus - Company': ['admin', 'member'],
    'Broker Consensus - Macro': ['admin'],
    'Broker Consensus - Strategy': ['admin', 'member'],

    // Tab-level: Daily Tracking
    'Daily Tracking - Market': ['admin', 'member', 'guest'],
    'Daily Tracking - Macroeconomics': ['admin', 'member', 'guest'],
    'Daily Tracking - Economics': ['admin', 'member', 'guest'],
    'Daily Tracking - Research': ['admin', 'member', 'guest'],
    'Daily Tracking - Fundamentals': ['admin', 'member', 'guest'],

    // Other Sites/Features
    'Broker Sentiment': ['admin', 'member'],
    'VN-Index Forecast': ['admin', 'member'],
    'DL Equity': ['admin', 'member'],
    'Export Data': ['admin'],
};

// Default configuration for the NEW website (more restrictive out-of-the-box)
const DEFAULT_FEATURES_NEW = {
    // Top-Level Sidebar Links
    'Price Board': ['admin', 'member', 'guest'],
    'Research': ['admin', 'member'],
    'Market Dashboard': ['admin', 'member', 'guest'],

    // Tab-level: Broker Consensus
    'Broker Consensus - Daily': ['admin', 'member'],
    'Broker Consensus - Company': ['admin', 'member'],
    'Broker Consensus - Macro': ['admin'],
    'Broker Consensus - Strategy': ['admin'],

    // Tab-level: Daily Tracking
    'Daily Tracking - Market': ['admin', 'member'],
    'Daily Tracking - Macroeconomics': ['admin', 'member'],
    'Daily Tracking - Economics': ['admin', 'member'],
    'Daily Tracking - Research': ['admin', 'member', 'guest'],
    'Daily Tracking - Fundamentals': ['admin', 'member'],

    // Other Sites/Features
    'Broker Sentiment': ['admin'],
    'VN-Index Forecast': ['admin'],
    'DL Equity': ['admin'],
    'Export Data': ['admin'],
};

const DEFAULT_FEATURES = process.env.PROJECT_ID ? DEFAULT_FEATURES_NEW : DEFAULT_FEATURES_OLD;

export async function getFeatureSettings() {
    try {
        const cmd = new GetObjectCommand({
            Bucket: R2_BUCKET,
            Key: FEATURES_FILE,
            IfNoneMatch: `"no-cache-${Date.now()}"`
        });
        const res = await r2Client.send(cmd);
        const body = await res.Body.transformToString();
        const storedFeatures = JSON.parse(body);

        // Merge defaults with stored, but filter out any obsolete keys that aren't in DEFAULT_FEATURES
        const merged = { ...DEFAULT_FEATURES, ...storedFeatures };
        const cleanSettings = {};
        for (const key of Object.keys(DEFAULT_FEATURES)) {
            cleanSettings[key] = merged[key];
        }
        return cleanSettings;
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
