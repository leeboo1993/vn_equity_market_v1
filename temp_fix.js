const getQuarterFromDate = (dateString) => {
    if (!dateString || dateString.length !== 6) return null;

    // User confirmed JSON uses YYMMDD format
    // Try YYMMDD first
    const yy = parseInt(dateString.substring(0, 2));
    const mm = parseInt(dateString.substring(2, 4));
    const dd = parseInt(dateString.substring(4, 6)); // unused for quarter
    const year_yymmdd = 2000 + yy;

    // Check if YYMMDD gives reasonable year (2000-2027)
    const isValidYYMMDD = (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && year_yymmdd <= 2027);

    if (isValidYYMMDD) {
        const quarter = Math.ceil(mm / 3);
        return { quarter, year: year_yymmdd, label: `Q${quarter} ${year_yymmdd}` };
    }

    // If year > 2027 (e.g., "311223" -> 2031), try DDMMYY interpretation  
    const dd2 = parseInt(dateString.substring(0, 2));
    const mm2 = parseInt(dateString.substring(2, 4));
    const yy2 = parseInt(dateString.substring(4, 6));
    const year_ddmmyy = 2000 + yy2;

    if (mm2 >= 1 && mm2 <= 12 && dd2 >= 1 && dd2 <= 31 && year_ddmmyy <= 2027) {
        const quarter = Math.ceil(mm2 / 3);
        return { quarter, year: year_ddmmyy, label: `Q${quarter} ${year_ddmmyy}` };
    }

    // Fallback: cap year at 2027 and return null if still invalid
    if (year_yymmdd > 2027) return null;

    const quarter = Math.ceil(mm / 3);
    return { quarter, year: year_yymmdd, label: `Q${quarter} ${year_yymmdd}` };
};
