'use client';

import { useMemo } from 'react';

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
            <div className="text-center text-gray-500 py-8">
                No broker forecasts found for {brokerData?.stockName || 'this stock'}
            </div>
        );
    }

    // Helper functions for safe formatting
    const safeToFixed = (val, digits = 1) => {
        if (val === null || val === undefined || val === '') return '-';
        const num = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(num)) return '-';
        return num.toFixed(digits);
    };

    const safeLocaleString = (val) => {
        if (val === null || val === undefined || val === '') return '-';
        const num = typeof val === 'number' ? val : parseFloat(val);
        if (isNaN(num)) return '-';
        return num.toLocaleString();
    };

    const getRecommendationStyle = (rec) => {
        const r = (rec || '').toLowerCase();
        if (['buy', 'outperform', 'add', 'accumulate', 'overweight'].some(k => r.includes(k))) return { bg: '#00ff7f', color: 'black' };
        if (['sell', 'underperform', 'reduce', 'underweight'].some(k => r.includes(k))) return { bg: '#ff4444', color: 'white' };
        if (['neutral', 'hold', 'market perform'].some(k => r.includes(k))) return { bg: '#4A5568', color: 'white' };
        return { bg: 'transparent', color: 'gray', border: '1px solid #3A3A3C' };
    };

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr.length !== 6) return dateStr;
        return `${dateStr.substring(4, 6)}/${dateStr.substring(2, 4)}/20${dateStr.substring(0, 2)}`;
    };

    // Define metrics to display - Date is now first
    const metrics = [
        { key: 'date', label: 'Date', accessor: r => formatDate(r.info_of_report?.date_of_issue) },
        { key: 'recommendation', label: 'Recommendation', accessor: r => r.recommendation?.recommendation || 'No Rating' },
        { key: 'target_price', label: 'Target Price', accessor: r => safeLocaleString(r.recommendation?.target_price) },
        {
            key: 'upside_at_call', label: 'Upside at call', accessor: r => {
                const val = r.recommendation?.upside_at_call;
                if (val === null || val === undefined) return '-';
                const num = parseFloat(val);
                if (isNaN(num)) return '-';
                return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
            }
        },
        {
            key: 'perf_since_call', label: 'Perf since call', accessor: r => {
                const val = r.recommendation?.performance_since_call;
                if (val === null || val === undefined) return '-';
                const num = parseFloat(val);
                if (isNaN(num)) return '-';
                return num.toFixed(1) + '%';
            }
        },
        {
            key: 'revenue', label: 'Revenue', accessor: r => {
                const forecast = r.forecast_summary;
                return safeLocaleString(forecast?.revenue ?? forecast?.['Revenue (bn VND)']);
            }
        },
        {
            key: 'npat', label: 'NPAT', accessor: r => {
                const forecast = r.forecast_summary;
                return safeLocaleString(forecast?.npat ?? forecast?.['NPAT (bn VND)']);
            }
        },
        {
            key: 'eps', label: 'EPS', accessor: r => {
                const forecast = r.forecast_summary;
                return safeLocaleString(forecast?.eps ?? forecast?.['EPS (VND)']);
            }
        },
        {
            key: 'bvps', label: 'BVPS', accessor: r => {
                const forecast = r.forecast_summary;
                return safeLocaleString(forecast?.bvps ?? forecast?.['BVPS (VND)']);
            }
        },
        {
            key: 'pe', label: 'PE', accessor: r => {
                const forecast = r.forecast_summary;
                return safeToFixed(forecast?.pe ?? forecast?.['P/E'], 1);
            }
        },
        {
            key: 'pb', label: 'PB', accessor: r => {
                const forecast = r.forecast_summary;
                return safeToFixed(forecast?.pb ?? forecast?.['P/B'], 2);
            }
        }
    ];

    return (
        <div style={{ marginTop: '20px', overflowX: 'auto', border: '1px solid #333', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                    <tr style={{ backgroundColor: '#1a1a1a', position: 'sticky', top: '104px', zIndex: 20 }}>
                        <th style={{
                            padding: '8px 10px',
                            textAlign: 'left',
                            borderBottom: '2px solid #333',
                            borderRight: '1px solid #333',
                            fontWeight: 'bold',
                            color: '#fff',
                            position: 'sticky',
                            left: 0,
                            top: '104px',
                            backgroundColor: '#1a1a1a',
                            zIndex: 30
                        }}>
                            Metric
                        </th>
                        {brokerData.brokers.map(broker => (
                            <th key={broker.info_of_report.issued_company} style={{
                                padding: '8px 10px',
                                textAlign: 'center',
                                borderLeft: '1px solid #333',
                                borderBottom: '2px solid #333',
                                fontWeight: 'bold',
                                color: '#00ff7f',
                                minWidth: '120px',
                                backgroundColor: '#1a1a1a'
                            }}>
                                {broker.info_of_report?.issued_company}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {metrics.map((metric, idx) => (
                        <tr key={metric.key} style={{ backgroundColor: idx % 2 === 0 ? '#0a0a0a' : '#121212' }}>
                            <td style={{
                                padding: '6px 10px',
                                fontWeight: '500',
                                color: '#ddd',
                                borderBottom: '1px solid #1a1a1a',
                                position: 'sticky',
                                left: 0,
                                backgroundColor: idx % 2 === 0 ? '#0a0a0a' : '#121212',
                                zIndex: 10
                            }}>
                                {metric.label}
                            </td>
                            {brokerData.brokers.map(broker => {
                                const value = metric.accessor(broker);
                                const isRec = metric.key === 'recommendation';
                                const style = isRec ? getRecommendationStyle(value) : {};

                                if (isRec) {
                                    return (
                                        <td key={broker.info_of_report.issued_company} style={{
                                            padding: '8px 10px',
                                            textAlign: 'center',
                                            borderBottom: '1px solid #1a1a1a',
                                            borderLeft: '1px solid #1a1a1a',
                                        }}>
                                            <span style={{
                                                backgroundColor: style.bg,
                                                color: style.color,
                                                border: style.border,
                                                padding: '4px 12px',
                                                borderRadius: '6px',
                                                fontWeight: 'bold',
                                                fontSize: '11px',
                                                display: 'inline-block',
                                                minWidth: '80px'
                                            }}>
                                                {value}
                                            </span>
                                        </td>
                                    );
                                }

                                return (
                                    <td key={broker.info_of_report.issued_company} style={{
                                        padding: '8px 10px',
                                        textAlign: 'center',
                                        borderLeft: '1px solid #1a1a1a',
                                        borderBottom: '1px solid #1a1a1a',
                                        color: metric.key === 'date' ? '#00ff7f' : '#ccc',
                                        fontFamily: 'monospace',
                                        fontSize: '11px'
                                    }}>
                                        {value}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
