import fs from 'fs';
import path from 'path';
import 'dotenv/config'; // Load env vars

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

        console.log(`Writing to ${outputPath}...`);
        fs.writeFileSync(outputPath, JSON.stringify(reports));
        console.log("Done.");

    } catch (e) {
        console.error("Prebuild failed:", e);
        process.exit(1);
    }
}

main();
