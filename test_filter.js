import { enrichReportsBatch } from './lib/data.js';

async function run() {
    const raw = [{
        "id": "acbs_kbc_production_company_report_260309",
        "info_of_report": {
            "ticker": "KBC",
            "date_of_issue": "20260309",
            "issued_company": "ACBS",
            "sector": "Real Estate",
            "stock_name": "Kinh Bac Urban Development"
        },
        "recommendation": {
            "recommendation": "Buy",
            "target_price": 40200,
            "target_price_change": -4.1
        }
    }];
    const res = await enrichReportsBatch(raw);
    console.log("Enriched:", JSON.stringify(res, null, 2));
}

run().catch(console.error);
