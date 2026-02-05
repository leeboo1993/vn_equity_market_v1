export const BANK_TYPES = ['Sector', 'SOCB', 'Private_1', 'Private_2', 'Private_3'];

// Format numbers nicely
export const formatNumber = (val, isPercent = false) => {
    if (val === null || val === undefined || isNaN(val)) return '-';
    if (isPercent) return (val * 100).toFixed(1) + '%';

    const absVal = Math.abs(val);
    if (absVal >= 1_000_000_000) return (val / 1_000_000_000).toFixed(0);
    if (absVal >= 1_000_000) return (val / 1_000_000).toFixed(1);
    return val.toLocaleString();
};

// Sort quarters: ['1Q24', '4Q23', ...] -> sorted array
export const sortQuarters = (quarters) => {
    return quarters.sort((a, b) => {
        const [qA, yA] = [parseInt(a[0]), parseInt(a.substring(2))];
        const [qB, yB] = [parseInt(b[0]), parseInt(b.substring(2))];
        if (yA !== yB) return yA - yB;
        return qA - qB;
    });
};

// Convert '2025-Q1' format to '1Q25' for display if needed
export const formatQuarterDisplay = (qStr) => {
    // Input could be "2025-Q1" or "1Q25" or "Year"
    if (!qStr) return '';
    if (qStr.match(/^\d{4}-Q\d$/)) {
        const [y, q] = qStr.split('-Q');
        return `${q}Q${y.slice(2)}`;
    }
    return qStr;
};

// Calculate Growth (QoQ or YoY)
// data: sorted array of objects { Date_Quarter: ..., Value: ... }
export const calculateGrowth = (data, valueKey, type = 'QoQ') => {
    const periodOffset = type === 'QoQ' ? 1 : 4;
    return data.map((item, idx) => {
        if (idx < periodOffset) return { ...item, [`${valueKey}_${type}`]: null };
        const prev = data[idx - periodOffset];
        const currVal = item[valueKey];
        const prevVal = prev[valueKey];

        let growth = null;
        if (prevVal && prevVal !== 0 && currVal !== null) {
            growth = (currVal - prevVal) / prevVal;
        }
        return { ...item, [`${valueKey}_${type}`]: growth };
    });
};

// Filter incomplete aggregates (simplified version of python logic)
export const filterIncompleteAggregates = (df, aggregatedTypes) => {
    // This might be complex to port fully without specific bug reports.
    // For now, we will assume data is reasonably clean or just filter basic nulls.
    return df.filter(item => item.TICKER);
};
