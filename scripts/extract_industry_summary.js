import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function extract() {
    const rawPath = "/tmp/industry_full.json";
    if (!fs.existsSync(rawPath)) {
        console.error("File not found:", rawPath);
        return;
    }

    console.log(`Reading ${rawPath}...`);
    let text = fs.readFileSync(rawPath, 'utf8');
    
    console.log("Parsing JSON...");
    let data;
    try {
        data = JSON.parse(text);
    } catch (e) {
        console.warn("JSON.parse failed, cleaning...");
        text = text.replace(/:\s*NaN/g, ': null')
                   .replace(/:\s*Infinity/g, ': null')
                   .replace(/:\s*-Infinity/g, ': null');
        data = JSON.parse(text);
    }

    const industries = {};
    const classification = data.classification || [];
    
    // 1. Identify Level 2 Industries
    classification.forEach(item => {
        if (String(item.industryLevel) === "2") {
            industries[item.industryCode] = {
                name: item.englishName,
                vnName: item.vietnameseName,
                code: item.industryCode,
                count: item.totalCount,
                ratios: []
            };
        }
    });

    console.log(`Identified ${Object.keys(industries).length} Level 2 industries.`);

    // 2. Process Global Ratios
    const allRatios = data.ratios || [];
    console.log(`Processing ${allRatios.length} global ratios...`);

    allRatios.forEach(r => {
        if (industries[r.code]) {
            industries[r.code].ratios.push(r);
        }
    });

    // 3. Generate Summary and History
    const summary = [];
    const fullHistory = {};

    let firstIndLogged = false;
    Object.values(industries).forEach(ind => {
        const ratios = ind.ratios;
        ratios.sort((a, b) => b.reportDate.localeCompare(a.reportDate));

        if (!firstIndLogged && ratios.length > 0) {
            console.log(`--- Ratio Codes for ${ind.name} ---`);
            const uniqueCodes = [...new Set(ratios.map(r => r.ratioCode.trim()))];
            console.log(uniqueCodes.slice(0, 100).join(', '));
            firstIndLogged = true;
        }

        const findRatio = (codes) => {
           if (!Array.isArray(codes)) codes = [codes];
           const r = ratios.find(r => codes.includes(r.ratioCode.trim()));
           return r ? r.value : undefined;
        };

        const pe = findRatio(['PRICE_TO_EARNINGS', 'P/E']);
        const pb = findRatio(['PRICE_TO_BOOK', 'P/B']);
        const roe = findRatio(['ROAE', 'ROE', 'RETURN_ON_EQUITY', 'RETURN_ON_EQUITY_AVG']);
        const dy = findRatio(['DIVIDEND_YIELD', 'DY']);

        summary.push({
            industry: ind.name,
            vnName: ind.vnName,
            code: ind.code,
            pe: pe,
            pb: pb,
            roe: roe,
            dividendYield: dy,
            count: ind.count,
            latestDate: ratios[0]?.reportDate
        });

        const peHistory = ratios
            .filter(r => ['PRICE_TO_EARNINGS', 'P/E'].includes(r.ratioCode.trim()) && r.value != null);
        
        const pbHistory = ratios
            .filter(r => ['PRICE_TO_BOOK', 'P/B'].includes(r.ratioCode.trim()) && r.value != null);

        // Group by date to provide both metrics if possible
        const combined = {};
        peHistory.forEach(r => {
            if (!combined[r.reportDate]) combined[r.reportDate] = { date: r.reportDate };
            combined[r.reportDate].pe = r.value;
        });
        pbHistory.forEach(r => {
            if (!combined[r.reportDate]) combined[r.reportDate] = { date: r.reportDate };
            combined[r.reportDate].pb = r.value;
        });

        fullHistory[ind.code] = {
            name: ind.name,
            history: Object.values(combined).sort((a, b) => b.date.localeCompare(a.date))
        };
    });

    console.log(`Extraction finished.`);
    
    const outputPath = path.resolve(__dirname, "../public/industry_valuation_summary.json");
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log(`Saved to ${outputPath}`);

    const historyPath = path.resolve(__dirname, "../public/industry_valuation_history.json");
    fs.writeFileSync(historyPath, JSON.stringify(fullHistory, null, 2));
    console.log(`Saved valuation history to ${historyPath}`);
}

extract();
