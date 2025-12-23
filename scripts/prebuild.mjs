const fs = require('fs');
const path = require('path');
const { getReports } = require('../lib/data');

// Adapt require context for ES modules if needed, but we can probably use the existing lib if we rename this to .mjs
// or just use dynamic import.
// Since the project is using "type": "module" implied by .mjs extension of next config? 
// Let's check package.json type.
// package.json doesn't say "type": "module".
// But `lib/data.js` uses `import`. So we must run this script with `node` treating it as module or use `esm`.
// Or just rename to `scripts/prebuild.mjs`.

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
