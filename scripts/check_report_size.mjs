import { getReports } from '../lib/data.js';

async function checkSize() {
    console.log("Fetching reports...");
    const start = Date.now();
    const reports = await getReports();
    const duration = Date.now() - start;

    console.log(`Fetched ${reports.length} reports in ${duration}ms`);

    const json = JSON.stringify(reports);
    const sizeBytes = Buffer.byteLength(json);
    const sizeMB = sizeBytes / (1024 * 1024);

    console.log(`Payload Size: ${sizeMB.toFixed(2)} MB`);
}

checkSize();
