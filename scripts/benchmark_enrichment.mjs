import { getFullRawReports, enrichReportsBatch } from '../lib/data.js';

async function benchmark() {
    console.log('--- Enrichment Benchmark ---');
    console.log('Loading raw reports...');
    const startTime = Date.now();
    const reports = await getFullRawReports();
    console.log(`Loaded ${reports.length} reports in ${Date.now() - startTime}ms`);

    const samples = [200, 400, 800];

    for (const size of samples) {
        const batch = reports.slice(0, size);
        console.log(`\nTesting batch size: ${size}`);

        const enrichStart = Date.now();
        const result = await enrichReportsBatch(batch);
        const duration = Date.now() - enrichStart;

        console.log(`Enriched ${result.reports.length} reports in ${duration}ms`);
        console.log(`Average: ${(duration / size).toFixed(2)}ms per report`);
    }

    process.exit(0);
}

benchmark().catch(err => {
    console.error(err);
    process.exit(1);
});
