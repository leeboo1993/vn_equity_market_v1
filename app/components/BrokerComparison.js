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

    const getPerfColorClass = (value) => {
        if (value == null || value === '-' || value === '') return 'text-white';
        const num = parseFloat(value);
        if (isNaN(num)) return 'text-white';
        if (num > 0.5) return 'text-[#00ff7f]'; // Green
        if (num < -0.5) return 'text-[#ff6666]'; // Red
        return 'text-gray-500';
    };

    const getRecommendationStyle = (rec) => {
        const r = (rec || '').toLowerCase();
        if (['buy', 'outperform', 'add', 'accumulate', 'overweight'].some(k => r.includes(k))) return { bg: '#00ff7f', color: 'black' };
        if (['sell', 'underperform', 'reduce', 'underweight'].some(k => r.includes(k))) return { bg: '#ff4444', color: 'white' };
        if (['neutral', 'hold', 'market perform'].some(k => r.includes(k))) return { bg: '#4A5568', color: 'white' };
        return { bg: 'transparent', color: 'gray', border: '1px solid #3A3A3C' };
    };

    // Define metrics to display
    const metrics = [
        { key: 'recommendation', label: 'Recommendation', accessor: r => r.recommendation?.recommendation || '-' },
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
        <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="border-b border-gray-800">
                        <th className="text-left p-3 text-gray-400 font-semibold sticky left-0 bg-[#000000]">Metric</th>
                        {brokerData.brokers.map(broker => (
                            <th key={broker.info_of_report.issued_company} className="text-center p-3 font-semibold min-w-[120px]">
                                <div className="text-[#00ff7f]">{broker.info_of_report?.issued_company}</div>
                                <div className="text-xs text-gray-500 font-normal">
                                    {(() => {
                                        const d = broker.info_of_report?.date_of_issue;
                                        if (!d || d.length !== 6) return d;
                                        return `${d.substring(4, 6)}/${d.substring(2, 4)}/20${d.substring(0, 2)}`;
                                    })()}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {metrics.map((metric, idx) => (
                        <tr key={metric.key} className="border-b border-gray-800 h-[45px]">
                            <td className="p-3 font-medium text-gray-300 sticky left-0 bg-[#000000]">
                                {metric.label}
                            </td>
                            {brokerData.brokers.map(broker => {
                                const value = metric.accessor(broker);
                                const isRec = metric.key === 'recommendation';
                                const style = isRec ? getRecommendationStyle(value) : {};

                                let cellContent = value;
                                let cellClass = "p-3 text-center";

                                if (isRec) {
                                    return (
                                        <td key={broker.info_of_report.issued_company} className={cellClass}>
                                            <span style={{
                                                backgroundColor: style.bg,
                                                color: style.color,
                                                border: style.border,
                                                padding: '4px 12px',
                                                borderRadius: '16px',
                                                fontWeight: '600',
                                                fontSize: '0.75rem',
                                                display: 'inline-block',
                                                minWidth: '80px'
                                            }}>
                                                {value}
                                            </span>
                                        </td>
                                    );
                                }

                                const isPerf = metric.key === 'upside_at_call' || metric.key === 'perf_since_call';
                                if (isPerf) {
                                    const numVal = parseFloat(value);
                                    const colorClass = getPerfColorClass(numVal);
                                    cellClass += ` ${colorClass}`;
                                } else {
                                    cellClass += " text-white";
                                }

                                return (
                                    <td key={broker.info_of_report.issued_company} className={cellClass}>
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
