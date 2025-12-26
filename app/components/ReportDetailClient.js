'use client';

import { useState, useMemo } from 'react';
// import PeerComparison from './PeerComparison'; // Defined below to prevent import errors
// import BrokerComparison from './BrokerComparison'; // Defined below to prevent import errors

// Embedded components to resolve ReferenceError in Next.js build
function BrokerComparison({ currentReport, allReports }) {
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

function PeerComparison({ currentReport, allReports }) {
    // Find peer companies in the same sector from the same broker
    const peerData = useMemo(() => {
        if (!currentReport || !allReports) return null;

        const currentSector = currentReport.info_of_report?.sector;
        const currentBroker = currentReport.info_of_report?.issued_company;

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
                        {peerData.peers.map(peer => (
                            <th key={peer.info_of_report.ticker} className="text-center p-3 font-semibold min-w-[120px]">
                                <div className="text-[#00ff7f]">{peer.info_of_report?.ticker}</div>
                                <div className="text-xs text-gray-500 font-normal">
                                    {peer.info_of_report?.stock_name || peer.info_of_report?.ticker}
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
                            {peerData.peers.map(peer => {
                                const value = metric.accessor(peer);
                                const isRec = metric.key === 'recommendation';
                                const style = isRec ? getRecommendationStyle(value) : {};

                                let cellContent = value;
                                let cellClass = "p-3 text-center";

                                if (isRec) {
                                    return (
                                        <td key={peer.info_of_report.ticker} className={cellClass}>
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
    );
}


// Helper to safely render list items (string or object)
const renderListItem = (item, i) => {
    if (typeof item === 'string') return <li key={i}>{item}</li>;
    if (typeof item === 'object' && item !== null) {
        // Handle table data structure
        if (item.data && Array.isArray(item.data)) {
            return (
                <li key={i} className="block mt-2">
                    {item.title && <div className="font-bold mb-1 text-green-400">{item.title}</div>}
                    <div className="overflow-x-auto">
                        <table className="mini-table w-full text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-gray-700">
                                    {Object.keys(item.data[0]).map(k => <th key={k} className="p-1 text-left text-gray-400">{k.replace(/_/g, ' ')}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {item.data.map((row, rI) => (
                                    <tr key={rI} className="border-b border-gray-800 last:border-0 hover:bg-white/5">
                                        {Object.values(row).map((val, cI) => <td key={cI} className="p-1">{val}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </li>
            );
        }
        // Handle plain {title, details}
        return (
            <li key={i}>
                {item.title && <strong className="text-gray-200">{item.title}: </strong>}
                {item.details || item.content || JSON.stringify(item)}
            </li>
        );
    }
    return <li key={i}>-</li>;
};

export default function ReportDetailClient({ report, allReports }) {
    console.log("VERSION: Embedded Components Fix Applied (v2)");
    const [activeTab, setActiveTab] = useState('details');

    return (
        <div className="pb-20">
            {/* Header */}
            <div className="card mb-8">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-4 mb-2">
                            <h1 className="title">
                                {report.info_of_report.stock_name || report.info_of_report.covered_stock || report.info_of_report.ticker}
                                {report.info_of_report.exchange && ` (${report.info_of_report.exchange}: ${report.info_of_report.ticker})`}
                            </h1>
                        </div>
                        <div className="text-base mt-2 text-gray-300">
                            {report.info_of_report.sector && (
                                <>
                                    <span className="text-gray-400">{report.info_of_report.sector}</span>
                                    <span className="text-gray-600 mx-2">|</span>
                                </>
                            )}
                            <span className={`badge ${['Outperform', 'Buy'].includes(report.recommendation?.recommendation) ? 'badge-outperform' :
                                ['Underperform', 'Sell'].includes(report.recommendation?.recommendation) ? 'badge-underperform' :
                                    ['Neutral', 'Hold'].includes(report.recommendation?.recommendation) ? 'badge-neutral' :
                                        'badge-no-rating'
                                }`}>
                                {report.recommendation?.recommendation || 'No Rating'}
                            </span>
                            {report.recommendation?.target_price && (
                                <>
                                    <span className="mx-2 font-mono text-green-400">{report.recommendation.target_price.toLocaleString()}</span>
                                    {report.recommendation?.upside && (
                                        <span className={`font-mono ${report.recommendation.upside > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            ({report.recommendation.upside > 0 ? '+' : ''}{report.recommendation.upside}%)
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="text-xs mt-2 text-gray-500">
                            <span className="text-gray-500">Date:</span> {(() => {
                                const d = report.info_of_report.date_of_issue;
                                if (!d || d.length !== 6) return d;
                                return `${d.substring(4, 6)}/${d.substring(2, 4)}/20${d.substring(0, 2)}`;
                            })()}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-500">Target Price</div>
                        <div className="text-3xl font-mono font-bold text-primary">{report.recommendation?.target_price?.toLocaleString() ?? '-'}</div>
                        <div className={`text-lg font-mono ${report.recommendation?.upside > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {report.recommendation?.upside}% Upside
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="mt-6 pt-6 border-t border-gray-700 flex gap-4">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'details'
                            ? 'bg-primary text-gray-900'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        Historicals
                    </button>
                    <button
                        onClick={() => setActiveTab('broker')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'broker'
                            ? 'bg-primary text-gray-900'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        Brokers
                    </button>
                    <button
                        onClick={() => setActiveTab('peers')}
                        className={`px-4 py-2 rounded-lg font-semibold transition-colors ${activeTab === 'peers'
                            ? 'bg-primary text-gray-900'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        Peers
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'details' && (
                <>
                    <div className="card mb-8">
                        <h3 className="text-lg font-semibold mb-2">Recommendation Logic</h3>
                        <p className="text-gray-400 leading-relaxed">{report.recommendation?.justification}</p>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
                        <div className="flex flex-col gap-8">
                            {/* Investment Thesis */}
                            <section className="card">
                                <h3 className="text-xl font-semibold mb-4 text-blue-400">Investment Thesis</h3>
                                <ul className="list-disc pl-5 space-y-3 text-gray-300">
                                    {report.investment_thesis && report.investment_thesis.slice(0, 7).map((point, i) => renderListItem(point, i))}
                                </ul>
                            </section>

                            {/* Company Update */}
                            <section className="card">
                                <h3 className="text-xl font-semibold mb-4 text-purple-400">Company Update</h3>
                                <ul className="list-disc pl-5 space-y-3 text-gray-300">
                                    {report.company_update && report.company_update.slice(0, 15).map((point, i) => renderListItem(point, i))}
                                </ul>
                            </section>

                            {/* Risks */}
                            {report.risk_assessment && (
                                <section className="card">
                                    <h3 className="text-xl font-semibold mb-4 text-red-400">Risk Assessment</h3>
                                    <div className="space-y-4">
                                        {report.risk_assessment.map((risk, i) => (
                                            <div key={i} className="bg-gray-800/50 p-4 rounded-lg">
                                                <div className="font-semibold text-red-300 mb-1">{risk.risk || risk.title || 'Risk'}</div>
                                                {risk.impact && <div className="text-sm text-gray-400 mb-2">{risk.impact}</div>}
                                                {risk.mitigation && <div className="text-sm text-green-400"><span className="font-semibold">Mitigation:</span> {risk.mitigation}</div>}
                                                {risk.details && <div className="text-sm text-gray-400">{risk.details}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>

                        <div className="flex flex-col gap-8">
                            {/* Forecast Summary */}
                            <section className="card">
                                <h3 className="text-xl font-semibold mb-4 text-green-400">Forecast Summary</h3>
                                <div className="space-y-3">
                                    {report.forecast_summary && Object.entries(report.forecast_summary).map(([key, value]) => (
                                        <div key={key} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                                            <span className="text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                                            <span className="font-mono font-semibold">
                                                {typeof value === 'number' ? value.toLocaleString() : (typeof value === 'object' && value !== null ? JSON.stringify(value) : value || '-')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Performance Tracking */}
                            <section className="card">
                                <h3 className="text-xl font-semibold mb-4 text-pink-400">Performance Tracking</h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                        <span className="text-gray-400">Upside at Call</span>
                                        <span className={`font-mono font-semibold ${(report.recommendation?.upside_at_call || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {report.recommendation?.upside_at_call ? `${report.recommendation.upside_at_call}%` : '-'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                        <span className="text-gray-400">Target Price Change</span>
                                        <span className={`font-mono font-semibold ${(report.recommendation?.target_price_change || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {report.recommendation?.target_price_change ? `${report.recommendation.target_price_change}%` : '-'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2 pt-2">
                                        {['1m', '3m', '6m', '1y'].map(p => (
                                            <div key={p} className="text-center bg-gray-800 p-2 rounded">
                                                <div className="text-xs text-gray-500 uppercase">{p}</div>
                                                <div className={`text-sm font-mono font-bold ${(report.recommendation?.[`return_${p}`] || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {report.recommendation?.[`return_${p}`] ? `${report.recommendation[`return_${p}`] > 0 ? '+' : ''}${report.recommendation[`return_${p}`]}%` : '-'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>

                            {/* Analyst Viewpoints */}
                            {report.analyst_viewpoints && (
                                <section className="card">
                                    <h3 className="text-xl font-semibold mb-4 text-yellow-400">Analyst Viewpoints</h3>
                                    <ul className="space-y-3 text-sm text-gray-300">
                                        {report.analyst_viewpoints.map((point, i) => {
                                            if (typeof point === 'string') return <li key={i} className="bg-gray-800/30 p-3 rounded border-l-2 border-yellow-500">{point}</li>;
                                            return (
                                                <li key={i} className="bg-gray-800/30 p-3 rounded border-l-2 border-yellow-500">
                                                    {point.title && <strong>{point.title}: </strong>}
                                                    {point.details || point.content || '-'}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            )}
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'peers' && (
                <PeerComparison currentReport={report} allReports={allReports} />
            )}

            {activeTab === 'broker' && (
                <BrokerComparison currentReport={report} allReports={allReports} />
            )}
        </div>
    );
}
