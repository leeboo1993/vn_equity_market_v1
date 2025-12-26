'use client';

import { useMemo } from 'react';

// Helper to format dates
const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 6) return dateStr;
    return `${dateStr.substring(4, 6)}/${dateStr.substring(2, 4)}/20${dateStr.substring(0, 2)}`;
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

export default function UnifiedComparisonTable({ mode, currentReport, allReports }) {
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
                    if (currentDate > existingDate) {
                        brokerMap.set(broker, report);
                    }
                }
            });

            const brokers = Array.from(brokerMap.values()).sort((a, b) => {
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
                    if (currentDate > existingDate) {
                        tickerMap.set(ticker, report);
                    }
                }
            });

            const peers = Array.from(tickerMap.values()).sort((a, b) => {
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

    // Define metrics to display
    const metrics = [
        { key: 'date', label: 'Date' },
        { key: 'recommendation', label: 'Recommendation' },
        { key: 'target_price', label: 'Target price' },
        { key: 'upside_at_call', label: 'Upside at call' },
        { key: 'perf_since_call', label: 'Perf since call' },
        { key: 'revenue', label: 'Revenue' },
        { key: 'npat', label: 'NPAT' },
        { key: 'eps', label: 'EPS' },
        { key: 'bvps', label: 'BVPS' },
        { key: 'pe', label: 'PE' },
        { key: 'pb', label: 'PB' }
    ];

    // Get value for a metric from a report
    const getValue = (report, metricKey) => {
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
            case 'revenue':
                const forecast = report.forecast_summary;
                return formatNumber(forecast?.revenue ?? forecast?.['Revenue (bn VND)']);
            case 'npat':
                return formatNumber(report.forecast_summary?.npat ?? report.forecast_summary?.['NPAT (bn VND)']);
            case 'eps':
                return formatNumber(report.forecast_summary?.eps ?? report.forecast_summary?.['EPS (VND)']);
            case 'bvps':
                return formatNumber(report.forecast_summary?.bvps ?? report.forecast_summary?.['BVPS (VND)']);
            case 'pe':
                const peVal = report.forecast_summary?.pe ?? report.forecast_summary?.['P/E'];
                return peVal != null ? peVal.toFixed(1) : '-';
            case 'pb':
                const pbVal = report.forecast_summary?.pb ?? report.forecast_summary?.['P/B'];
                return pbVal != null ? pbVal.toFixed(2) : '-';
            default:
                return '-';
        }
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
                overflowX: 'auto',
                border: '1px solid #333',
                borderRadius: '8px'
            }}>
                <table className="mini-table w-full relative border-collapse">
                    <thead>
                        <tr style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 10,
                            backgroundColor: '#1E1E1E'
                        }}>
                            <th>Metric</th>
                            {tableData.columns.map((col, idx) => (
                                <th key={idx}>
                                    {tableData.getColumnHeader(col)}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {metrics.map((metric, metricIdx) => {
                            const isRec = metric.key === 'recommendation';

                            return (
                                <tr key={metric.key}>
                                    <td style={{
                                        position: 'sticky',
                                        left: 0,
                                        backgroundColor: '#1E1E1E',
                                        zIndex: 10
                                    }}>
                                        {metric.label}
                                    </td>
                                    {tableData.columns.map((col, colIdx) => {
                                        const value = getValue(col, metric.key);

                                        if (isRec) {
                                            const style = getRecommendationStyle(value);
                                            return (
                                                <td key={colIdx}>
                                                    <span style={{
                                                        ...style,
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
                                            <td key={colIdx}>
                                                {value}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
