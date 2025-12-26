'use client';

import { useMemo } from 'react';

export default function PeerComparison({ currentReport, allReports }) {
    // Find peer companies in the same sector from the same broker
    const peerData = useMemo(() => {
        if (!currentReport || !allReports) return null;

        const currentSector = currentReport.info_of_report?.sector;
        const currentBroker = currentReport.info_of_report?.issued_company;
        const currentTicker = currentReport.info_of_report?.ticker;

        if (!currentSector || !currentBroker) return null;

        // Filter reports: same sector + same broker
        const peerReports = allReports.filter(r => {
            const matchesSector = r.info_of_report?.sector === currentSector;
            const matchesBroker = r.info_of_report?.issued_company === currentBroker;
            return matchesSector && matchesBroker;
        });

        // Group by ticker and get latest report for each
        const tickerMap = new Map();
        peerReports.forEach(report => {
            const ticker = report.info_of_report?.ticker;
            if (!ticker) return;

            const existing = tickerMap.get(ticker);
            if (!existing) {
                tickerMap.set(ticker, report);
            } else {
                // Compare dates and keep the latest
                const existingDate = existing.info_of_report?.date_of_issue || '000000';
                const currentDate = report.info_of_report?.date_of_issue || '000000';
                if (currentDate > existingDate) {
                    tickerMap.set(ticker, report);
                }
            }
        });

        // Convert to array and sort by ticker
        const peers = Array.from(tickerMap.values()).sort((a, b) => {
            const tickerA = a.info_of_report?.ticker || '';
            const tickerB = b.info_of_report?.ticker || '';
            return tickerA.localeCompare(tickerB);
        });

        return {
            sector: currentSector,
            broker: currentBroker,
            peers
        };
    }, [currentReport, allReports]);

    if (!peerData || peerData.peers.length === 0) {
        return (
            <div className="text-center text-gray-500 py-8">
                No peer companies found in {peerData?.sector} sector from {peerData?.broker}
            </div>
        );
    }

    // Helper functions for safe formatting (copied from BrokerComparison for consistency)
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
                return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
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
        <div className="card">
            <h3 className="text-xl font-semibold mb-4 text-purple-400">
                Peers: {peerData.sector} ({peerData.broker})
            </h3>
            <p className="text-sm text-gray-500 mb-4">
                Comparing {peerData.peers.length} companies in the same sector from the same broker
            </p>

            <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                    <thead>
                        <tr className="border-b border-gray-700">
                            <th className="text-left p-3 text-gray-400 font-semibold sticky left-0 bg-gray-900">Metric</th>
                            {peerData.peers.map(peer => (
                                <th key={peer.info_of_report.ticker} className="text-center p-3 text-green-400 font-semibold min-w-[120px]">
                                    <div>{peer.info_of_report?.stock_name || peer.info_of_report?.ticker}</div>
                                    <div className="text-xs text-gray-500 font-normal">
                                        {peer.info_of_report?.ticker}
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
                                {peerData.peers.map(peer => {
                                    const value = metric.accessor(peer);
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
                                        <td key={peer.info_of_report.ticker} className={cellClass}>
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
