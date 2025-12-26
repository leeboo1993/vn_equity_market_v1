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

export default function BrokerComparison({ currentReport, allReports }) {
    // Find different brokers' reports for the same ticker
    const brokerData = useMemo(() => {
        if (!currentReport || !allReports) return null;

        const currentTicker = currentReport.info_of_report?.ticker;
        if (!currentTicker) return null;

        // Filter reports: same ticker, different brokers
        const brokerReports = allReports.filter(r => {
            return r.info_of_report?.ticker === currentTicker;
        });

        // Group by broker and get latest report for each
        const brokerMap = new Map();
        brokerReports.forEach(report => {
            const broker = report.info_of_report?.issued_company;
            if (!broker) return;

            const existing = brokerMap.get(broker);
            if (!existing) {
                brokerMap.set(broker, report);
            } else {
                // Compare dates and keep the latest
                const existingDate = existing.info_of_report?.date_of_issue || '000000';
                const currentDate = report.info_of_report?.date_of_issue || '000000';
                if (currentDate > existingDate) {
                    brokerMap.set(broker, report);
                }
            }
        });

        // Convert to array and sort by broker name
        const brokers = Array.from(brokerMap.values()).sort((a, b) => {
            const brokerA = a.info_of_report?.issued_company || '';
            const brokerB = b.info_of_report?.issued_company || '';
            return brokerA.localeCompare(brokerB);
        });

        return {
            ticker: currentTicker,
            stockName: currentReport.info_of_report?.stock_name || currentTicker,
            brokers
        };
    }, [currentReport, allReports]);

    if (!brokerData || brokerData.brokers.length === 0) {
        return (
            <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#888',
                fontStyle: 'italic'
            }}>
                No broker forecasts found for {brokerData?.stockName || 'this stock'}
            </div>
        );
    }

    // Helper to get recommendation style (matching ForecastTable.js style)
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

    // Get value for a metric from a broker report
    const getValue = (broker, metricKey) => {
        switch (metricKey) {
            case 'date':
                return formatDate(broker.info_of_report?.date_of_issue);
            case 'recommendation':
                return broker.recommendation?.recommendation || 'No Rating';
            case 'target_price':
                return formatNumber(broker.recommendation?.target_price);
            case 'upside_at_call':
                return formatPercentage(broker.recommendation?.upside_at_call);
            case 'perf_since_call':
                return formatPercentage(broker.recommendation?.performance_since_call);
            case 'revenue':
                const forecast = broker.forecast_summary;
                return formatNumber(forecast?.revenue ?? forecast?.['Revenue (bn VND)']);
            case 'npat':
                return formatNumber(broker.forecast_summary?.npat ?? broker.forecast_summary?.['NPAT (bn VND)']);
            case 'eps':
                return formatNumber(broker.forecast_summary?.eps ?? broker.forecast_summary?.['EPS (VND)']);
            case 'bvps':
                return formatNumber(broker.forecast_summary?.bvps ?? broker.forecast_summary?.['BVPS (VND)']);
            case 'pe':
                const peVal = broker.forecast_summary?.pe ?? broker.forecast_summary?.['P/E'];
                return peVal != null ? peVal.toFixed(1) : '-';
            case 'pb':
                const pbVal = broker.forecast_summary?.pb ?? broker.forecast_summary?.['P/B'];
                return pbVal != null ? pbVal.toFixed(2) : '-';
            default:
                return '-';
        }
    };

    return (
        <div style={{ marginTop: '20px' }}>
            {/* Table container with horizontal scroll */}
            <div style={{
                overflowX: 'auto',
                border: '1px solid #333',
                borderRadius: '8px'
            }}>
                <table className="mini-table w-full relative border-collapse">
                    {/* Header row */}
                    <thead>
                        <tr style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 10,
                            backgroundColor: '#1E1E1E'
                        }}>
                            <th>Metric</th>
                            {brokerData.brokers.map((broker, idx) => {
                                const brokerName = broker.info_of_report?.issued_company;
                                return (
                                    <th key={idx}>
                                        {brokerName}
                                    </th>
                                );
                            })}
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
                                    {brokerData.brokers.map((broker, brokerIdx) => {
                                        const value = getValue(broker, metric.key);

                                        if (isRec) {
                                            const style = getRecommendationStyle(value);
                                            return (
                                                <td key={brokerIdx} style={{
                                                    padding: '6px 10px',
                                                    textAlign: 'right',
                                                    color: '#ccc',
                                                    borderLeft: '1px solid #1a1a1a',
                                                    borderBottom: '1px solid #1a1a1a',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    <span style={{
                                                        backgroundColor: style.bg,
                                                        color: style.color,
                                                        border: style.border,
                                                        padding: '4px 12px',
                                                        borderRadius: '6px',
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
                                            <td key={brokerIdx}>
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
