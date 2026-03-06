const fs = require('fs');

async function check() {
    const res = await fetch("http://localhost:3000/api/financials?ticker=VCB");
    const json = await res.json();
    const is = json.quarterly['Q4/2025'].filter(x => x.stmtType === 'IS');
    console.log("VCB Income Statement items from API:");
    is.forEach((item, i) => console.log(`${i}. [${item.code}] ${item.nameEn}`));
}
check();
