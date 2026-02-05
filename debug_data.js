
import { getReports } from './lib/data.js';

async function debug() {
    console.log("Fetching reports...");
    const reports = await getReports();

    // Target tickers seen in user context
    const targets = ['DCM', 'PVS', 'MWG'];

    for (const ticker of targets) {
        console.log(`\n--- Inspecting ${ticker} ---`);
        const tickerReports = reports
            .filter(r => r.info_of_report.ticker === ticker)
            .sort((a, b) => b.info_of_report.date_of_issue - a.info_of_report.date_of_issue);

        if (tickerReports.length === 0) {
            console.log("No reports found.");
            continue;
        }

        // Take top 3
        tickerReports.slice(0, 3).forEach(r => {
            console.log(`ID: ${r.id}, Date: ${r.info_of_report.date_of_issue}, Broker: ${r.info_of_report.issued_company}`);
            if (r.forecast_table) {
                console.log("Forecast Columns:", r.forecast_table.columns);
                if (r.forecast_table.rows && Array.isArray(r.forecast_table.rows)) {
                    console.log(`Rows count: ${r.forecast_table.rows.length}`);
                    if (r.forecast_table.rows.length > 0) {
                        console.log("Row 0:", JSON.stringify(r.forecast_table.rows[0]));
                    }
                } else {
                    console.log("Rows is not an array or undefined");
                }
            } else {
                console.log("No Forecast Table");
            }
        });
    }
}

debug();
