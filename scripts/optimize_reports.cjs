
const fs = require('fs');
const path = require('path');
const os = require('os');

// Helper to parse date "YYMMDD" or "YYYYMMDD" -> number YYYYMMDD for comparison
const parseIssueDate = (dStr) => {
    if (!dStr) return 0;
    const s = String(dStr).trim();
    if (s.length === 6) {
        const y = 2000 + parseInt(s.substring(0, 2));
        const m = parseInt(s.substring(2, 4));
        const d = parseInt(s.substring(4, 6));
        return y * 10000 + m * 100 + d;
    } else if (s.length === 8) {
        return parseInt(s);
    }
    return 0;
};

const getQuarterLabel = (dStr) => {
    const dInt = parseIssueDate(dStr);
    if (dInt === 0) return null;
    const s = String(dInt);
    const y = parseInt(s.substring(0, 4));
    const m = parseInt(s.substring(4, 6));
    let q = Math.ceil(m / 3);
    if (q > 4) q = 4;
    if (q < 1) q = 1;
    return `Q${q} ${y}`;
};

async function optimize() {
    const sourcePath = path.join(os.tmpdir(), "company_report_data.json");
    if (!fs.existsSync(sourcePath)) {
        console.error("Source file not found at " + sourcePath);
        process.exit(1);
    }

    console.log("Loading source file...");
    const rawData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

    let flattened = Array.isArray(rawData) ? rawData : [];
    if (!Array.isArray(rawData)) {
        for (const broker in rawData) {
            for (const id in rawData[broker]) {
                const r = rawData[broker][id];
                if (!r.id) r.id = id;
                flattened.push(r);
            }
        }
    }

    console.log(`Processing ${flattened.length} reports...`);

    const thinList = [];
    const tickers = new Set();
    const brokers = new Set();
    const sectors = new Set();
    const quarters = new Set();

    flattened.forEach(r => {
        const info = r.info_of_report || {};
        const rec = r.recommendation || {};

        // Extract metadata
        if (info.ticker) tickers.add(info.ticker);
        if (info.issued_company) brokers.add(info.issued_company);
        if (info.sector) sectors.add(info.sector);

        const qLabel = getQuarterLabel(info.date_of_issue);
        if (qLabel) quarters.add(qLabel);

        // Standardize date for thin list
        const dInt = parseIssueDate(info.date_of_issue);
        const standardizedDate = dInt > 0 ? String(dInt) : info.date_of_issue;

        // Create thin object
        thinList.push({
            id: r.id,
            info_of_report: {
                ticker: info.ticker,
                date_of_issue: standardizedDate,
                issued_company: info.issued_company,
                sector: info.sector,
                stock_name: info.stock_name
            },
            recommendation: {
                recommendation: rec.recommendation,
                target_price: rec.target_price,
                upside_at_call: rec.upside_at_call
            }
        });
    });

    // Sort thin list descending
    thinList.sort((a, b) => {
        const dA = parseIssueDate(b.info_of_report.date_of_issue);
        const dB = parseIssueDate(a.info_of_report.date_of_issue);
        return dA - dB;
    });

    const metadata = {
        uniqueTickers: Array.from(tickers).sort(),
        uniqueBrokers: Array.from(brokers).sort(),
        uniqueSectors: Array.from(sectors).sort(),
        uniqueQuarters: Array.from(quarters).sort((a, b) => {
            const [qA, yA] = a.split(' ');
            const [qB, yB] = b.split(' ');
            if (yA !== yB) return parseInt(yB) - parseInt(yA);
            return parseInt(qB.replace('Q', '')) - parseInt(qA.replace('Q', ''));
        }),
        totalReports: flattened.length,
        updatedAt: new Date().toISOString()
    };

    console.log("Saving optimized files...");
    fs.writeFileSync('public/reports_metadata.json', JSON.stringify(metadata, null, 2));
    fs.writeFileSync('public/reports_list.json', JSON.stringify(thinList));

    console.log("Done!");
    console.log(`Metadata: public/reports_metadata.json (${(fs.statSync('public/reports_metadata.json').size / 1024).toFixed(2)} KB)`);
    console.log(`Thin List: public/reports_list.json (${(fs.statSync('public/reports_list.json').size / 1024 / 1024).toFixed(2)} MB)`);
}

optimize().catch(console.error);
