'use client';

import { useState, useMemo } from 'react';
import PeerComparison from './PeerComparison';
import BrokerComparison from './BrokerComparison';

import ForecastTable from './ForecastTable';

// ... (existing imports)

export default function ReportDetailClient({ report, allReports }) {
    console.log("VERSION: UI Standardization Fix Applied (v3) + Financials & Key Tracking");

    // Helper to format date for ForecastTable
    const formattedDate = useMemo(() => {
        const d = report.info_of_report?.date_of_issue;
        if (!d || String(d).length !== 6) return null;
        const str = String(d);
        return `${str.substring(4, 6)}/${str.substring(2, 4)}/20${str.substring(0, 2)}`;
    }, [report.info_of_report?.date_of_issue]);

    const [activeTab, setActiveTab] = useState('details');

    return (
        <div className="pb-20">
            {/* ... (Header stays same) ... */}

            {/* Header copy for reference to make sure we don't break it */}
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
                            <span className="text-gray-500">Date:</span> {formattedDate || report.info_of_report.date_of_issue}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-gray-500">Target Price</div>
                        <div className="text-3xl font-mono font-bold text-[#00ff7f]">{report.recommendation?.target_price?.toLocaleString() ?? '-'}</div>
                        <div className={`text-lg font-mono ${report.recommendation?.upside > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {report.recommendation?.upside}% Upside
                        </div>
                    </div>
                </div>

            </div>

            {/* Sticky Tab Navigation */}
            <div className="sticky top-[52px] z-50 bg-[#0c0c0c] border-b border-gray-800 py-3 mb-0 pl-4 shadow-lg">
                <div className="inline-flex bg-[#1a1a1a] p-1 rounded-lg border border-gray-800">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={`px-6 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'details'
                            ? 'bg-[#00ff7f] text-black shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Report Details
                    </button>
                    <button
                        onClick={() => setActiveTab('financials')}
                        className={`px-6 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'financials'
                            ? 'bg-[#00ff7f] text-black shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Financials
                    </button>
                    <button
                        onClick={() => setActiveTab('broker')}
                        className={`px-6 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'broker'
                            ? 'bg-[#00ff7f] text-black shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Brokers
                    </button>
                    <button
                        onClick={() => setActiveTab('peers')}
                        className={`px-6 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === 'peers'
                            ? 'bg-[#00ff7f] text-black shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Peers
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            {
                activeTab === 'details' && (
                    <>
                        <div className="card mb-8">
                            <h3 className="text-lg font-semibold mb-2">Recommendation Logic</h3>
                            <p className="text-gray-400 leading-relaxed">{report.recommendation?.justification}</p>
                        </div>

                        {/* Key To Watch (Key Tracking) */}
                        {report.key_tracking && (
                            <div className="card mb-8 border-l-4 border-yellow-500 bg-yellow-900/10">
                                <h3 className="text-xl font-semibold mb-3 text-yellow-400">Key to Watch</h3>
                                <div className="text-gray-200">
                                    {/* Handle both string and array formats */}
                                    {Array.isArray(report.key_tracking) ? (
                                        <ul className="list-disc pl-5 space-y-2">
                                            {report.key_tracking.map((k, i) => renderListItem(k, i))}
                                        </ul>
                                    ) : (typeof report.key_tracking === 'object' ? (
                                        <div className="space-y-4">
                                            {Object.entries(report.key_tracking).map(([k, v], i) => (
                                                <div key={i}>
                                                    <strong>{k.replace(/_/g, ' ')}: </strong>
                                                    <span>{String(v)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p>{report.key_tracking}</p>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
                            <div className="flex flex-col gap-8">
                                {/* Investment Thesis */}
                                <section className="card">
                                    <h3 className="text-xl font-semibold mb-4 text-blue-400">Investment Thesis</h3>
                                    <ul className="list-disc pl-5 space-y-3 text-gray-300">
                                        {report.investment_thesis && report.investment_thesis.slice(0, 10).map((point, i) => renderListItem(point, i))}
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
                                    <button
                                        onClick={() => setActiveTab('financials')}
                                        className="w-full mt-4 py-2 bg-green-900/20 text-green-400 text-sm font-semibold rounded hover:bg-green-900/30 transition-colors"
                                    >
                                        View Full Financials →
                                    </button>
                                </section>

                                {/* Performance Tracking */}
                                <section className="card">
                                    <h3 className="text-xl font-semibold mb-4 text-pink-400">Performance Tracking</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                            <span className="text-gray-400">Upside at Call</span>
                                            <span className={`font-mono font-semibold ${(report.recommendation?.upside_at_call || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {report.recommendation?.upside_at_call ? `${report.recommendation.upside_at_call.toFixed(1)}%` : '-'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center py-2 border-b border-gray-700">
                                            <span className="text-gray-400">Target Price Change</span>
                                            <span className={`font-mono font-semibold ${(report.recommendation?.target_price_change || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {report.recommendation?.target_price_change ? `${report.recommendation.target_price_change.toFixed(1)}%` : '-'}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 pt-2">
                                            {['1m', '3m', '6m', '1y'].map(p => (
                                                <div key={p} className="text-center bg-gray-800 p-2 rounded">
                                                    <div className="text-xs text-gray-500 uppercase">{p}</div>
                                                    <div className={`text-sm font-mono font-bold ${(report.recommendation?.[`return_${p}`] || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {report.recommendation?.[`return_${p}`] ? `${report.recommendation[`return_${p}`] > 0 ? '+' : ''}${report.recommendation[`return_${p}`].toFixed(1)}%` : '-'}
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
                )
            }

            {
                activeTab === 'financials' && (
                    <div className="card mb-8">
                        <h2 className="title mb-6 text-green-400">Financial Forecasts & History</h2>
                        <ForecastTable forecastData={report.forecast_table} reportDate={formattedDate} />
                    </div>
                )
            }

            {
                activeTab === 'peers' && (
                    <PeerComparison currentReport={report} allReports={allReports} />
                )
            }

            {
                activeTab === 'broker' && (
                    <BrokerComparison currentReport={report} allReports={allReports} />
                )
            }
        </div >
    );
}
