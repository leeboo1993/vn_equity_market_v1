import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

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

async function main() {
    console.log("Pre-fetching data from R2...");
    try {
        const { getReports } = await import('../lib/data.js');

        // This fetches FULL data from R2 (using getReports internal logic)
        const reports = await getReports();
        console.log(`Fetched ${reports.length} reports.`);

        const publicDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) {
            fs.mkdirSync(publicDir);
        }

        // --- OPTIMIZATION START ---
        console.log("Generating optimized artifacts...");

        // 1. Sort by date ascending for TP calc
        const sorted = [...reports].sort((a, b) => {
            const dA = parseIssueDate(a.info_of_report?.date_of_issue);
            const dB = parseIssueDate(b.info_of_report?.date_of_issue);
            return dA - dB;
        });

        const tpMap = new Map();
        const thinList = [];
        const tickers = new Set();
        const brokers = new Set();
        const sectors = new Set();
        const quarters = new Set();

        sorted.forEach(r => {
            const info = r.info_of_report || {};
            const rec = r.recommendation || {};

            if (info.ticker) tickers.add(info.ticker);
            if (info.issued_company) brokers.add(info.issued_company);
            if (info.sector) sectors.add(info.sector);

            const qLabel = getQuarterLabel(info.date_of_issue);
            if (qLabel) quarters.add(qLabel);

            const dInt = parseIssueDate(info.date_of_issue);
            const standardizedDate = dInt > 0 ? String(dInt) : info.date_of_issue;

            // Target Price Change
            let tpChange = null;
            const tp = rec.target_price;
            if (info.issued_company && info.ticker && dInt > 0) {
                const key = `${info.issued_company}|${info.ticker}`;
                const last = tpMap.get(key);
                if (last && last.tp > 0 && tp > 0) {
                    const change = ((tp - last.tp) / last.tp) * 100;
                    tpChange = parseFloat(change.toFixed(1));
                }
                if (tp > 0) {
                    tpMap.set(key, { tp, dateInt: dInt });
                }
            }

            // Recalculate Recommendation based on Upside
            // Logic: < -5% -> Sell, -5% to 15% -> Neutral, > 15% -> Buy
            // We need price info for this, but prebuild runs on server without price history loaded?
            // WAIT - 'getReports' loads raw data. We don't have price history here in prebuild.mjs easily unless we load it.
            // Actually, for the THIN list (initial view), we usually rely on the recommendation from the report itself
            // or we need to fetch the current price to calculate upside.
            // If the user wants the recommendation to be DYNAMIC based on CURRENT upside, 
            // the thin list must have the price info.

            // However, looking at the previous 'optimize_reports.cjs', it didn't import price history.
            // If I change it here, I need to fetch current price. 
            // But the thin list is static JSON. If prices change, the recommendation in the static file becomes stale.
            // The dynamic logic I added to lib/data.js handles the "enriched" view (background sync).

            // For the initial static list, we might have to stick to the broker's original recommendation 
            // OR fetch the latest price during build and bake it in.
            // Let's rely on the dashboard to override it or Bake it in now.

            // Let's bake it in using the recommendation FROM THE REPORT since we can't easily get live price in this script without more setup.
            // BUT wait, the user said "recommendation is based on upside at call".
            // "Upside at call" is (Target Price - Price At Call) / Price At Call.
            // This is static! It doesn't change with current price. 
            // Let's re-read: "the recommendation is based on upside at call"

            // "upside at call"
            // If so, we need 'price_at_call'. 
            // In raw reports, do we have 'price_at_call' or 'upside_at_call'?
            // 'rec.upside_at_call' is used in thin list.

            let finalRec = rec.recommendation;
            if (rec.upside_at_call !== undefined && rec.upside_at_call !== null) {
                if (rec.upside_at_call > 15) finalRec = 'Buy';
                else if (rec.upside_at_call < -5) finalRec = 'Sell';
                else finalRec = 'Neutral';
            } else if (!rec.target_price || rec.target_price === 0) {
                finalRec = 'No Rating';
            }

            // Thin Object
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
                    upside_at_call: rec.upside_at_call,
                    target_price_change: tpChange
                }
            });
        });

        // Sort Thin List Descending
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
            totalReports: reports.length,
            updatedAt: new Date().toISOString()
        };

        const listPath = path.join(publicDir, 'reports_list.json');
        const metaPath = path.join(publicDir, 'reports_metadata.json');

        fs.writeFileSync(listPath, JSON.stringify(thinList));
        fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));

        console.log(`Saved reports_list.json (${thinList.length} items)`);
        console.log(`Saved reports_metadata.json`);

        // Also save full raw reports to avoid redownload if falling back?
        // Actually lib/data.js caches separately in tmp. 
        // We don't strictly need reports.json anymore if we rely on the above.
        // But let's keep it for safety if any other logic uses it (though I doubt it).
        // I'll skip writing reports.json to save space if I'm sure.
        // But to be safe, I'll write 'reports_list.json' is the key one.

    } catch (e) {
        console.error("Prebuild failed:", e);
        // Fallback: create empty files to prevent crash
        const publicDir = path.join(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir);
        if (!fs.existsSync(path.join(publicDir, 'reports_list.json'))) {
            fs.writeFileSync(path.join(publicDir, 'reports_list.json'), '[]');
        }
        if (!fs.existsSync(path.join(publicDir, 'reports_metadata.json'))) {
            fs.writeFileSync(path.join(publicDir, 'reports_metadata.json'), '{}');
        }
    }
}

main();
