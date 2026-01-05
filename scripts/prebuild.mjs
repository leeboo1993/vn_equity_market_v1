import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Ensure R2 credentials are available
if (!process.env.R2_ACCESS_KEY_ID) {
    console.warn("Available Env Keys:", Object.keys(process.env));
}

// Adapt require context for ES modules if needed, but we can probably use the existing lib if we rename this to .mjs

async function main() {
    console.log("Pre-fetching data from R2...");
    try {
        // We need to import the module dynamically because it's ESM
        const { getReports } = await import('../lib/data.js');

        const reports = await getReports();
        console.log(`Fetched ${reports.length} reports.`);

        const outputPath = path.join(process.cwd(), 'public', 'reports.json');

        // Ensure public dir exists
        if (!fs.existsSync(path.join(process.cwd(), 'public'))) {
            fs.mkdirSync(path.join(process.cwd(), 'public'));
        }

        // SAFETY: If we fetched 0 reports, check if there's existing data
        if (reports.length === 0) {
            console.warn("[WARN] Fetched 0 reports from R2!");
            if (fs.existsSync(outputPath)) {
                console.warn("[WARN] Keeping existing reports.json as fallback");
                return; // Don't overwrite with empty data
            } else {
                console.warn("[WARN] No existing reports.json found. Creating empty array.");
                fs.writeFileSync(outputPath, JSON.stringify([]));
                return;
            }
        }

        console.log(`Writing to ${outputPath}...`);
        fs.writeFileSync(outputPath, JSON.stringify(reports));
        console.log("Done.");

    } catch (e) {
        console.error("Prebuild failed:", e);
        // Don't exit with error - allow build to continue with cached/empty data
        const outputPath = path.join(process.cwd(), 'public', 'reports.json');
        if (!fs.existsSync(outputPath)) {
            console.error("[ERROR] No cached data available. Creating empty reports.json");
            fs.writeFileSync(outputPath, JSON.stringify([]));
        } else {
            console.warn("[WARN] Using cached reports.json due to R2 error");
        }
    }
}

main();
