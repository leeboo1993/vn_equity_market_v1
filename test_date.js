const getQuarterFromDate = (dateString) => {
    if (!dateString) return null;
    const s = String(dateString);

    let year, mm;
    if (s.length === 8) {
        year = parseInt(s.substring(0, 4));
        mm = parseInt(s.substring(4, 6));
    } else if (s.length === 6) {
        year = 2000 + parseInt(s.substring(0, 2));
        mm = parseInt(s.substring(2, 4));
    } else {
        return null; // missing logic for length === 10 or other
    }

    if (year >= 2010 && year <= 2030 && mm >= 1 && mm <= 12) {
        const quarter = Math.ceil(mm / 3);
        return { quarter, year, label: `Q${quarter} ${year}` };
    }
    return null;
};

const parseDateHelper = (dStr) => {
    if (!dStr) return new Date(0);
    const s = String(dStr).trim();
    let y, m, d;
    if (s.includes('-')) {
        const parts = s.split('-');
        y = parseInt(parts[0]);
        m = parseInt(parts[1]) - 1;
        d = parseInt(parts[2]);
    } else if (s.length === 8) { // YYYYMMDD
        y = parseInt(s.substring(0, 4));
        m = parseInt(s.substring(4, 6)) - 1;
        d = parseInt(s.substring(6, 8));
    } else if (s.length === 6) { // YYMMDD
        y = 2000 + parseInt(s.substring(0, 2));
        m = parseInt(s.substring(2, 4)) - 1;
        d = parseInt(s.substring(4, 6));
    } else {
        const dObj = new Date(s);
        return isNaN(dObj.getTime()) ? new Date(0) : dObj;
    }
    return new Date(y, m, d);
};

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    // Use helper for standardized parsing
    const dObj = parseDateHelper(dateStr);
    if (!isNaN(dObj.getTime()) && dObj.getTime() !== 0) {
        const day = String(dObj.getDate()).padStart(2, '0');
        const month = String(dObj.getMonth() + 1).padStart(2, '0');
        const year = dObj.getFullYear();
        return `${day}/${month}/${year}`;
    }
    return dateStr || '-';
};

console.log(formatDate("2026-03-08T00:00:00"));
console.log(getQuarterFromDate("2026-03-08T00:00:00"));
