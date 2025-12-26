'use client';

import { useMemo } from 'react';

// Helper to format dates to DD/MM/YYYY
const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 6) return dateStr;
    const day = dateStr.substring(4, 6);
    const month = dateStr.substring(2, 4);
    const year = `20${dateStr.substring(0, 2)}`;
    return `${day}/${month}/${year}`;
};

// Helper to format numbers
const formatNumber = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '-';
    return num.toLocaleString();
};

// Helper to format percentages
const formatPercentage = (value) => {
    if (value === null || value === undefined) return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
};

// Helper to derive recommendation from upside/target (matches ReportList.js logic)
const getDerivedRec = (report) => {
    const upside = report.recommendation?.upside || 0;
    const targetPrice = report.recommendation?.target_price;

    // If no target price, return "No Rating"
    if (!targetPrice || targetPrice === 0) {
        return 'No Rating';
    }

    // Standardize based on upside at call
    if (upside >= 15) {
        return 'Buy';
    } else if (upside <= -5) {
        return 'Sell';
    } else {
        return 'Neutral';
    }
};

export default function UnifiedComparisonTable({ mode, currentReport, allReports, selectedYear }) {
    // Process data based on mode
    const tableData = useMemo(() => {
        if (!currentReport || !allReports) return null;

        if (mode === 'brokers') {
            // Broker comparison: same ticker, different brokers
            const currentTicker = currentReport.info_of_report?.ticker;
            if (!currentTicker) return null;

            const brokerReports = allReports.filter(r => {
                return r.info_of_report?.ticker === currentTicker;
            });

            const brokerMap = new Map();
            brokerReports.forEach(report => {
                const broker = report.info_of_report?.issued_company;
                if (!broker) return;

                const existing = brokerMap.get(broker);
                if (!existing) {
                    brokerMap.set(broker, report);
                } else {
                    const existingDate = existing.info_of_report?.date_of_issue || '000000';
                    const currentDate = report.info_of_report?.date_of_issue || '000000';

                    const isValid = (r) => {
                        const rec = getDerivedRec(r);
                        return rec && rec.toLowerCase() !== 'no rating';
                    };

                    const existingValid = isValid(existing);
                    const currentValid = isValid(report);

                    if (currentValid && !existingValid) {
                        brokerMap.set(broker, report);
                    } else if (existingValid && !currentValid) {
                        // Keep existing
                    } else {
                        // Both valid or both invalid - sort by date
                        if (currentDate > existingDate) {
                            brokerMap.set(broker, report);
                        }
                    }
                }
            });

            const brokers = Array.from(brokerMap.values())
                .filter(report => {
                    const rec = getDerivedRec(report);
                    return rec && rec.toLowerCase() !== 'no rating';
                })
                .sort((a, b) => {
                    const brokerA = a.info_of_report?.issued_company || '';
                    const brokerB = b.info_of_report?.issued_company || '';
                    return brokerA.localeCompare(brokerB);
                });

            return {
                type: 'brokers',
                columns: brokers,
                getColumnHeader: (col) => col.info_of_report?.issued_company,
                emptyMessage: `No broker forecasts found for ${currentTicker}`
            };

        } else if (mode === 'peers') {
            // Peer comparison: same sector + same broker, different tickers
            const currentSector = currentReport.info_of_report?.sector;
            const currentBroker = currentReport.info_of_report?.issued_company;

            if (!currentSector || !currentBroker) return null;

            const peerReports = allReports.filter(r => {
                const matchesSector = r.info_of_report?.sector === currentSector;
                const matchesBroker = r.info_of_report?.issued_company === currentBroker;
                return matchesSector && matchesBroker;
            });

            const tickerMap = new Map();
            peerReports.forEach(report => {
                const ticker = report.info_of_report?.ticker;
                if (!ticker) return;

                const existing = tickerMap.get(ticker);
                if (!existing) {
                    tickerMap.set(ticker, report);
                } else {
                    const existingDate = existing.info_of_report?.date_of_issue || '000000';
                    const currentDate = report.info_of_report?.date_of_issue || '000000';

                    const isValid = (r) => {
                        const rec = getDerivedRec(r);
                        return rec && rec.toLowerCase() !== 'no rating';
                    };

                    const existingValid = isValid(existing);
                    const currentValid = isValid(report);

                    if (currentValid && !existingValid) {
                        tickerMap.set(ticker, report);
                    } else if (existingValid && !currentValid) {
                        // Keep existing
                    } else {
                        // Both valid or both invalid - sort by date
                        if (currentDate > existingDate) {
                            tickerMap.set(ticker, report);
                        }
                    }
                }
            });

            const peers = Array.from(tickerMap.values())
                .filter(report => {
                    const rec = getDerivedRec(report);
                    return rec && rec.toLowerCase() !== 'no rating';
                })
                .sort((a, b) => {
                    const tickerA = a.info_of_report?.ticker || '';
                    const tickerB = b.info_of_report?.ticker || '';
                    return tickerA.localeCompare(tickerB);
                });

            return {
                type: 'peers',
                columns: peers,
                getColumnHeader: (col) => col.info_of_report?.ticker,
                emptyMessage: `No peer companies found in ${currentSector} sector from ${currentBroker}`
            };

        } else {
            // Historical comparison: same broker + ticker, grouped by quarter
            const parseDateDate = (dStr) => {
                if (!dStr) return new Date(0);
                const y = 2000 + parseInt(dStr.substring(0, 2));
                const m = parseInt(dStr.substring(2, 4)) - 1;
                const d = parseInt(dStr.substring(4, 6));
                return new Date(y, m, d);
            };

            const currentRepDate = parseDateDate(currentReport.info_of_report?.date_of_issue);
            const oneYearAgo = new Date(currentRepDate);
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            const comparisonReportsRaw = allReports
                .filter(r => {
                    if (!r || !r.info_of_report) return false;

                    const rDate = parseDateDate(r.info_of_report.date_of_issue);
                    if (!rDate) return false;

                    if (r.info_of_report.issued_company !== currentReport.info_of_report.issued_company) return false;
                    if (r.info_of_report.ticker !== currentReport.info_of_report.ticker) return false;
                    if (rDate > currentRepDate || rDate < oneYearAgo) return false;
                    const hasTP = r.recommendation?.target_price != null;
                    const hasForecast = r.forecast_table != null || r.forecast_summary != null;
                    return hasTP || hasForecast;
                })
                .sort((a, b) => parseDateDate(a.info_of_report.date_of_issue) - parseDateDate(b.info_of_report.date_of_issue));

            const reportsByQuarter = {};
            comparisonReportsRaw.forEach(r => {
                const d = parseDateDate(r.info_of_report.date_of_issue);
                const q = Math.floor(d.getMonth() / 3) + 1;
                const key = `${d.getFullYear()}-Q${q}`;
                if (!reportsByQuarter[key] || parseDateDate(reportsByQuarter[key].info_of_report.date_of_issue) < d) {
                    reportsByQuarter[key] = r;
                }
            });

            const historicals = Object.values(reportsByQuarter);

            return {
                type: 'historical',
                columns: historicals,
                getColumnHeader: (col) => formatDate(col.info_of_report?.date_of_issue),
                emptyMessage: 'No historical data available'
            };
        }
    }, [mode, currentReport, allReports]);

    // Helper to get recommendation style
    const getRecommendationStyle = (rec) => {
        const r = (rec || '').toLowerCase();
        if (['buy', 'outperform', 'add', 'accumulate', 'overweight'].some(k => r.includes(k)))
            return { bg: '#00ff7f', color: 'black' };
        if (['sell', 'underperform', 'reduce', 'underweight'].some(k => r.includes(k)))
            return { bg: '#ff4444', color: 'white' };
        if (['neutral', 'hold', 'market perform'].some(k => r.includes(k)))
            return { bg: '#4A5568', color: 'white' };
        return { bg: 'transparent', color: 'gray', border: '1px solid #3A3A3C' };
    };

    // Helper to get financial data for a specific year
    const getFinancialsForYear = (rep, key, tYear) => {
        if (!rep || !rep.forecast_table || !rep.forecast_table.columns || !Array.isArray(rep.forecast_table.columns)) return null;
        if (!rep.forecast_table.rows || !Array.isArray(rep.forecast_table.rows)) return null;
        if (!tYear) return null;

        try {
            const cols = rep.forecast_table.columns || [];
            const tYearClean = tYear.replace(/[A-Za-z]/g, ''); // e.g. "2025" or "12-25"

            // Find column index for the year
            let colIndex = cols.findIndex(c => c.toString().includes(tYearClean));
            if (colIndex === -1 && tYearClean.length === 4) {
                const shortYear = tYearClean.substring(2);
                colIndex = cols.findIndex(c => c.toString().includes(shortYear));
            }

            if (colIndex !== -1 && colIndex < cols.length) {
                const colName = cols[colIndex];
                if (!colName) return null;

                const isMatch = (r) => {
                    const rKey = r.metric || r.item || r.name;
                    return rKey && (rKey === key || rKey.toLowerCase() === key.toLowerCase());
                };

                // Top-level row match
                const row = rep.forecast_table.rows.find(r => isMatch(r));
                if (row) {
                    if (row.values && Array.isArray(row.values)) {
                        if (colIndex >= 0 && colIndex < row.values.length) return row.values[colIndex];
                    }
                    if (row[colName] !== undefined) return row[colName];
                }

                // Row-per-Year Match (HSC style)
                const yearRow = rep.forecast_table.rows.find(r => r.Year && r.Year.toString() === colName.toString());
                if (yearRow) {
                    if (yearRow[key] !== undefined) return yearRow[key];
                    const categories = ['balance_sheet', 'income_statement', 'cash_flow', 'key_ratios'];
                    for (const cat of categories) {
                        if (yearRow[cat] && yearRow[cat][key] !== undefined) return yearRow[cat][key];
                    }
                }
            }
        } catch (e) {
            console.error("Error parsing financials:", e);
        }
        return null;
    };

    // Determine target year for financial data
    const getAvailableForecastYears = (rep) => {
        if (!rep || !rep.forecast_table || !rep.forecast_table.columns) return [];

        // Get report date to determine which years are forecasts
        const reportDate = rep.info_of_report?.date_of_issue || '250101'; // Default to 2025
        const reportYear = 2000 + parseInt(reportDate.substring(0, 2));

        // Helper to normalize year formats
        const normalizeYear = (yearStr) => {
            const str = yearStr.toString();

            // Match patterns like "2025F", "2025", "12/25", "12-25"
            const fourDigit = str.match(/(\d{4})/);
            if (fourDigit) return fourDigit[1];

            const twoDigit = str.match(/(\d{2})[\/-]?(\d{2})/);
            if (twoDigit) return `20${twoDigit[2]}`;

            return null;
        };

        // Get all years from columns and normalize them
        const allYears = rep.forecast_table.columns
            .map(c => {
                const normalized = normalizeYear(c);
                if (!normalized) return null;
                return {
                    original: c,
                    normalized: normalized,
                    numeric: parseInt(normalized)
                };
            })
            .filter(y => y !== null && !isNaN(y.numeric))
            .sort((a, b) => a.numeric - b.numeric);

        // Get unique years (in case of duplicates)
        const uniqueYears = [];
        const seen = new Set();
        for (const y of allYears) {
            if (!seen.has(y.numeric)) {
                seen.add(y.numeric);
                uniqueYears.push(y);
            }
        }

        // Filter forecast years (>= report year)
        const forecastYears = uniqueYears.filter(y => y.numeric >= reportYear);

        // If we have at least 4 forecast years, return them
        if (forecastYears.length >= 4) {
            return forecastYears.slice(0, 4).map(y => y.original);
        }

        // Otherwise, backfill with historical years
        const historicalYears = uniqueYears.filter(y => y.numeric < reportYear).reverse();
        const neededHistorical = 4 - forecastYears.length;
        const backfillYears = historicalYears.slice(0, neededHistorical).reverse();
        const combined = [...backfillYears, ...forecastYears];

        return combined.map(y => y.original);
    };

    const availableYears = currentReport ? getAvailableForecastYears(currentReport) : [];
    const targetYear = selectedYear || (availableYears.length > 0 ? availableYears[availableYears.length - 1] : null);

    // Define metrics to display (all 11 metrics)
    const metrics = [
        { key: 'recommendation', label: 'Recommendation' },
        { key: 'target_price', label: 'Target price' },
        { key: 'upside_at_call', label: 'Upside at call' },
        { key: 'perf_since_call', label: 'Perf since call' },
        { key: 'revenue', label: 'Revenue', isFinancial: true },
        { key: 'npat', label: 'NPAT', isFinancial: true },
        { key: 'eps', label: 'EPS', isFinancial: true },
        { key: 'bvps', label: 'BVPS', isFinancial: true },
        { key: 'pe', label: 'PE', isFinancial: true },
        { key: 'pb', label: 'PB', isFinancial: true }
    ];

    // Helper to match ReportList.js logic
    const getDerivedRec = (report) => {
        const upside = report.recommendation?.upside_at_call || 0; // Use upside_at_call for consistency
        const targetPrice = report.recommendation?.target_price;

        // If no target price, return "No Rating"
        if (!targetPrice || targetPrice === 0) {
            return 'No Rating';
        }

        // Standardize based on upside at call
        if (upside >= 15) {
            return 'Buy';
        } else if (upside <= -5) {
            return 'Sell';
        } else {
            return 'Neutral';
        }
    };

    // Get value for a metric from a report
    const getValue = (report, metricKey, isFinancial) => {
        if (!report) return '-';

        if (metricKey === 'recommendation') {
            const derived = getDerivedRec(report);
            // Prefer derived to match ReportList, but fallback to API if needed (though ReportList ignores API)
            // The original recommendation from API is `report.recommendation?.recommendation`
            // We prioritize the derived recommendation.
            return derived !== 'No Rating' ? derived : (report.recommendation?.recommendation || 'No Rating');
        }

        if (isFinancial) {
            const val = getFinancialsForYear(report, metricKey, targetYear);
            if (val == null) return null;

            if (metricKey === 'pe') {
                return val != null ? val.toFixed(1) : null;
            } else if (metricKey === 'pb') {
                return val != null ? val.toFixed(2) : null;
            } else {
                return formatNumber(val);
            }
        }

        switch (metricKey) {
            case 'date':
                return formatDate(report.info_of_report?.date_of_issue);
            case 'recommendation':
                return report.recommendation?.recommendation || 'No Rating';
            case 'target_price':
                return formatNumber(report.recommendation?.target_price);
            case 'upside_at_call':
                return formatPercentage(report.recommendation?.upside_at_call);
            case 'perf_since_call':
                return formatPercentage(report.recommendation?.performance_since_call);
            default:
                return '-';
        }
    };

    // Calculate delta (change) for the last column
    const calculateDelta = (reports, metricKey) => {
        if (reports.length < 2) return null;

        const latest = reports[reports.length - 1];
        const previous = reports[reports.length - 2];

        if (metricKey === 'target_price') {
            const latestVal = latest.recommendation?.target_price;
            const prevVal = previous.recommendation?.target_price;
            if (latestVal != null && prevVal != null && prevVal !== 0) {
                const change = ((latestVal - prevVal) / prevVal) * 100;
                return formatPercentage(change);
            }
        } else if (metricKey === 'upside_at_call' || metricKey === 'perf_since_call') {
            const latestVal = metricKey === 'upside_at_call'
                ? latest.recommendation?.upside_at_call
                : latest.recommendation?.performance_since_call;
            const prevVal = metricKey === 'upside_at_call'
                ? previous.recommendation?.upside_at_call
                : previous.recommendation?.performance_since_call;
            if (latestVal != null && prevVal != null) {
                const change = latestVal - prevVal;
                return formatPercentage(change);
            }
        }
        return null;
    };

    if (!tableData || tableData.columns.length === 0) {
        return (
            <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#888',
                fontStyle: 'italic'
            }}>
                {tableData?.emptyMessage || 'No data available'}
            </div>
        );
    }

    return (
        <div style={{ marginTop: '20px' }}>
            <div style={{
                width: '100%',
                overflowX: 'auto',
                borderRadius: '8px'
            }}>
                <table className="table" style={{ tableLayout: 'fixed', minWidth: '100%', borderCollapse: 'collapse' }}>
                    <colgroup>
                        <col style={{ width: '150px' }} />
                        {tableData.columns.map((_, idx) => (
                            <col key={idx} style={{ width: '120px' }} />
                        ))}
                        <col style={{ width: '80px' }} />
                    </colgroup>
                    <thead>
                        <tr style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 10,
                            backgroundColor: '#1E1E1E',
                            borderBottom: '1px solid #333'
                        }}>
                            <th style={{
                                textAlign: 'left',
                                position: 'sticky',
                                left: 0,
                                zIndex: 20,
                                backgroundColor: '#1E1E1E',
                                borderBottom: '1px solid #333',
                                color: '#4ade80'
                            }}>Metric</th>
                            {tableData.columns.map((col, idx) => (
                                <th key={idx} style={{ textAlign: 'center' }}>
                                    {tableData.getColumnHeader(col)}
                                </th>
                            ))}
                            <th style={{ textAlign: 'center' }}>Δ</th>
                        </tr>
                    </thead>

                    <tbody style={{ fontSize: '10px' }}>
                        {/* Date row - only for brokers/peers modes */}
                        {mode !== 'historical' && (
                            <tr style={{ borderBottom: '1px solid #2A2A2A' }}>
                                <td style={{
                                    position: 'sticky',
                                    left: 0,
                                    backgroundColor: '#1E1E1E',
                                    zIndex: 10,
                                    textAlign: 'left'
                                }}>
                                    Date
                                </td>
                                {tableData.columns.map((col, colIdx) => (
                                    <td key={colIdx} style={{ textAlign: 'center' }}>
                                        {formatDate(col.info_of_report?.date_of_issue)}
                                    </td>
                                ))}
                                <td style={{ textAlign: 'center' }}>-</td>
                            </tr>
                        )}

                        {/* Metric rows */}
                        {metrics.map((metric, metricIdx) => {
                            const isRec = metric.key === 'recommendation';
                            const delta = calculateDelta(tableData.columns, metric.key);

                            // Check if this row has any data - skip if all columns are empty
                            let filledCount = 0;
                            for (const col of tableData.columns) {
                                const val = getValue(col, metric.key, metric.isFinancial);
                                if (val !== null && val !== undefined && val !== '' && val !== '-') {
                                    filledCount++;
                                }
                            }

                            // Hide row if all columns are empty
                            if (filledCount === 0) {
                                return null;
                            }

                            return (
                                <tr key={metric.key} style={{ borderBottom: '1px solid #2A2A2A' }}>
                                    <td style={{
                                        position: 'sticky',
                                        left: 0,
                                        backgroundColor: '#1E1E1E',
                                        zIndex: 10,
                                        textAlign: 'left'
                                    }}>
                                        {metric.label}
                                    </td>
                                    {tableData.columns.map((col, colIdx) => {
                                        const value = getValue(col, metric.key, metric.isFinancial);

                                        if (isRec) {
                                            // Don't show "No Rating" as a pill - just show standard dash
                                            if (value === 'No Rating' || value === 'no rating') {
                                                return (
                                                    <td key={colIdx} style={{ textAlign: 'center' }}>-</td>
                                                );
                                            }

                                            const style = getRecommendationStyle(value);
                                            return (
                                                <td key={colIdx} style={{ textAlign: 'center' }}>
                                                    <span style={{
                                                        backgroundColor: style.bg,
                                                        color: style.color,
                                                        border: style.border,
                                                        padding: '4px 12px',
                                                        borderRadius: '9999px',
                                                        fontWeight: 'bold',
                                                        fontSize: '10px',
                                                        display: 'inline-block'
                                                    }}>
                                                        {value}
                                                    </span>
                                                </td>
                                            );
                                        }

                                        return (
                                            <td key={colIdx} style={{ textAlign: 'center' }}>
                                                {value || '-'}
                                            </td>
                                        );
                                    })}
                                    <td style={{ textAlign: 'center' }}>{delta || '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
