import fs from 'fs';
import path from 'path';

const reportsPath = path.join(process.cwd(), 'data', 'reports.json');
// Check public if data not exists
const reportsPathPublic = path.join(process.cwd(), 'public', 'reports.json');
const finalPath = fs.existsSync(reportsPath) ? reportsPath : reportsPathPublic;

const reportsData = JSON.parse(fs.readFileSync(finalPath, 'utf-8'));

// Helper to get Quarter
const getQuarter = (dStr) => {
    if (!dStr || dStr.length !== 6) return null;
    const yy = parseInt(dStr.substring(0, 2));
    const mm = parseInt(dStr.substring(2, 4));
    const year = 2000 + yy;
    const q = Math.ceil(mm / 3);
    return `Q${q} ${year}`;
};

// Group by Quarter
const quartersMap = {};
reportsData.forEach(r => {
    const q = getQuarter(r.info_of_report?.date_of_issue);
    if (q) {
        if (!quartersMap[q]) quartersMap[q] = [];
        quartersMap[q].push(r);
    }
});

// Sort Quarters Descending
const sortedQuarters = Object.keys(quartersMap).sort((a, b) => {
    const [qA, yA] = a.split(' ');
    const [qB, yB] = b.split(' ');
    if (yA !== yB) return parseInt(yB) - parseInt(yA);
    return parseInt(qB.replace('Q', '')) - parseInt(qA.replace('Q', ''));
});

const recent5 = sortedQuarters.slice(0, 5);
console.log('Recent 5 Quarters:', recent5);

let totalSize = 0;
let totalCount = 0;

recent5.forEach(q => {
    const reports = quartersMap[q];
    const size = JSON.stringify(reports).length;
    console.log(`${q}: ${reports.length} reports, ${(size / 1024 / 1024).toFixed(2)} MB`);
    totalSize += size;
    totalCount += reports.length;
});

console.log('---');
console.log(`Total for 5 Quarters: ${totalCount} reports`);
console.log(`Total Size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
