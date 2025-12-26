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

    // Define metrics to display
    const metrics = [
        { key: 'recommendation', label: 'Recommendation', accessor: r => r.recommendation?.recommendation || '-' },
        { key: 'target_price', label: 'Target Price', accessor: r => r.recommendation?.target_price?.toLocaleString() || '-' },
        {
            key: 'upside_at_call', label: 'Upside at call', accessor: r => {
                const val = r.recommendation?.upside_at_call;
                return val != null ? `${val >= 0 ? '+' : ''}${val.toFixed(1)}%` : '-';
            }
        },
        {
            key: 'perf_since_call', label: 'Perf since call', accessor: r => {
                const val = r.recommendation?.performance_since_call;
                return val != null ? `${val >= 0 ? '+' : ''}${val.toFixed(1)}%` : '-';
            }
        },
        {
            key: 'revenue', label: 'Revenue', accessor: r => {
                const forecast = r.forecast_summary;
                return forecast?.revenue?.toLocaleString() || forecast?.['Revenue (bn VND)']?.toLocaleString() || '-';
            }
        },
        {
            key: 'npat', label: 'NPAT', accessor: r => {
                const forecast = r.forecast_summary;
                return forecast?.npat?.toLocaleString() || forecast?.['NPAT (bn VND)']?.toLocaleString() || '-';
            }
        },
        {
            key: 'eps', label: 'EPS', accessor: r => {
                const forecast = r.forecast_summary;
                return forecast?.eps?.toLocaleString() || forecast?.['EPS (VND)']?.toLocaleString() || '-';
            }
        },
        {
            key: 'bvps', label: 'BVPS', accessor: r => {
                const forecast = r.forecast_summary;
                return forecast?.bvps?.toLocaleString() || forecast?.['BVPS (VND)']?.toLocaleString() || '-';
            }
        },
        {
            key: 'pe', label: 'PE', accessor: r => {
                const forecast = r.forecast_summary;
                return forecast?.pe?.toFixed(1) || forecast?.['P/E']?.toFixed(1) || '-';
            }
        },
        {
            key: 'pb', label: 'PB', accessor: r => {
                const forecast = r.forecast_summary;
                return forecast?.pb?.toFixed(2) || forecast?.['P/B']?.toFixed(2) || '-';
            }
        }
    ];

    return (
        <div className="card">
            <h3 className="text-xl font-semibold mb-4 text-purple-400">
                Broker Forecasts: {brokerData.stockName}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
                Comparing forecasts from {brokerData.brokers.length} broker{brokerData.brokers.length > 1 ? 's' : ''}
            </p>

            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b border-gray-700">
                            <th className="text-left p-3 text-gray-400 font-semibold sticky left-0 bg-gray-900">Metric</th>
                            {brokerData.brokers.map(broker => (
                                <th key={broker.id} className="text-center p-3 text-green-400 font-semibold min-w-[120px]">
                                    <div>{broker.info_of_report?.issued_company}</div>
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
                            <tr key={metric.key} className={`border-b border-gray-800 ${idx % 2 === 0 ? 'bg-gray-900/30' : ''}`}>
                                <td className="p-3 font-medium text-gray-300 sticky left-0 bg-gray-900">
                                    {metric.label}
                                </td>
                                {brokerData.brokers.map(broker => {
                                    const value = metric.accessor(broker);
                                    const isRecommendation = metric.key === 'recommendation';
                                    const isPositive = typeof value === 'string' && value.includes('+');
                                    const isNegative = typeof value === 'string' && value.includes('-') && !value.includes('+-');

                                    let cellClass = 'p-3 text-center';
                                    if (isRecommendation) {
                                        if (value === 'Buy') cellClass += ' text-green-400 font-bold';
                                        else if (value === 'Sell') cellClass += ' text-red-400 font-bold';
                                        else if (value === 'Neutral') cellClass += ' text-yellow-400 font-bold';
                                        else cellClass += ' text-gray-500';
                                    } else if (isPositive) {
                                        cellClass += ' text-green-400';
                                    } else if (isNegative) {
                                        cellClass += ' text-red-400';
                                    }

                                    return (
                                        <td key={broker.id} className={cellClass}>
                                            {value}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
