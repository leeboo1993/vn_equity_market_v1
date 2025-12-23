'use client';

import { useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function ResearchStats({ reportCount, avgUpside, topCalls, selectedReportId, onSelectReport, reports }) {

    const [rankingMode, setRankingMode] = useState('buy'); // 'buy' | 'sell'

    const validReports = reports || [];

    const stats = {
        buy: validReports.filter(r => r.recommendation?.recommendation === 'Outperform').length,
        hold: validReports.filter(r => r.recommendation?.recommendation === 'Neutral').length,
        sell: validReports.filter(r => r.recommendation?.recommendation === 'Underperform').length,
    };

    // Calculate top stocks based on mode
    const getTopStocks = () => {
        const reportsWithUpside = validReports.filter(r =>
            r.recommendation?.upside_at_call != null &&
            r.recommendation?.target_price != null
        );

        if (rankingMode === 'buy') {
            // Top 10 by highest upside (buy calls)
            return reportsWithUpside
                .filter(r => r.recommendation?.upside_at_call > 0)
                .sort((a, b) => (b.recommendation?.upside_at_call || 0) - (a.recommendation?.upside_at_call || 0))
                .slice(0, 10);
        } else {
            // Top 10 by lowest upside (sell calls / most downside)
            return reportsWithUpside
                .filter(r => r.recommendation?.upside_at_call < 0)
                .sort((a, b) => (a.recommendation?.upside_at_call || 0) - (b.recommendation?.upside_at_call || 0))
                .slice(0, 10);
        }
    };

    const displayCalls = getTopStocks();

    const data = {
        labels: ['Buy', 'Hold', 'Sell'],
        datasets: [
            {
                data: [stats.buy, stats.hold, stats.sell],
                backgroundColor: [
                    '#4ade80', // Green (Buy)
                    '#facc15', // Yellow (Hold)
                    '#f87171', // Red (Sell)
                ],
                borderWidth: 0,
                hoverOffset: 4,
            },
        ],
    };

    const options = {
        cutout: '75%',
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#18181b',
                titleColor: '#a1a1aa',
                bodyColor: '#e4e4e7',
                borderColor: '#27272a',
                borderWidth: 1,
                padding: 10,
                callbacks: {
                    label: (item) => ` ${item.label}: ${item.raw}`
                }
            },
        },
        responsive: true,
        maintainAspectRatio: false,
    };

    return (
        <div className="flex flex-col gap-6" style={{ minHeight: 0 }}>

            {/* Recommendation Overview */}
            <section className="panel p-0">
                <div className="panel-content flex flex-col items-center text-center justify-center p-6">
                    <h3 className="text-green font-semibold mb-6 uppercase tracking-wider text-[10px]">Market Consensus</h3>
                    <div className="relative mb-6" style={{ width: '140px', height: '140px' }}>
                        <Doughnut data={data} options={options} />
                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                            <span className="text-2xl font-bold text-white">+{avgUpside.toFixed(0)}%</span>
                            <span className="text-[9px] text-gray uppercase">Avg Upside</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', width: '100%', marginBottom: '0.5rem', fontSize: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4ade80', display: 'inline-block' }}></span> {stats.buy} Buy
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#facc15', display: 'inline-block' }}></span> {stats.hold} Hold
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f87171', display: 'inline-block' }}></span> {stats.sell} Sell
                        </div>
                    </div>
                </div>
            </section>

            {/* Top 10 Stock Calls */}
            <section className="panel flex-1">
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Rankings</span>
                    <div style={{
                        backgroundColor: '#2C2C2E',
                        borderRadius: '10px',
                        padding: '3px',
                        display: 'inline-flex',
                        gap: '0',
                        border: '1px solid #3A3A3C'
                    }}>
                        <button
                            onClick={() => setRankingMode('buy')}
                            style={{
                                backgroundColor: rankingMode === 'buy' ? '#00ff7f' : 'transparent',
                                color: rankingMode === 'buy' ? 'black' : 'white',
                                padding: '4px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                outline: 'none',
                                fontSize: '10px',
                                fontWeight: '400',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Top Buy
                        </button>
                        <button
                            onClick={() => setRankingMode('sell')}
                            style={{
                                backgroundColor: rankingMode === 'sell' ? '#ff6666' : 'transparent',
                                color: rankingMode === 'sell' ? 'white' : 'white',
                                padding: '4px 12px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                outline: 'none',
                                fontSize: '10px',
                                fontWeight: '400',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            Top Sell
                        </button>
                    </div>
                </div>
                <div className="panel-content-no-padding">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Ticker</th>
                                <th>Call</th>
                                <th className="text-right">Target</th>
                                <th className="text-right">Upside</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayCalls.map((report) => {
                                const rec = report.recommendation?.recommendation;
                                const upside = report.recommendation?.upside_at_call;
                                const target = report.recommendation?.target_price;
                                const isPositive = upside >= 0;

                                return (
                                    <tr
                                        key={report.id}
                                        onClick={() => onSelectReport(report.id)}
                                        className={selectedReportId === report.id ? 'selected' : ''}
                                    >
                                        <td className="font-bold text-white">{report.info_of_report.ticker}</td>
                                        <td className={
                                            rec === 'Outperform' ? 'text-green font-medium text-[11px]' :
                                                rec === 'Underperform' ? 'text-red font-medium text-[11px]' : 'text-yellow font-medium text-[11px]'
                                        }>
                                            {rec === 'Outperform' ? 'Buy' :
                                                rec === 'Neutral' ? 'Hold' : 'Sell'}
                                        </td>
                                        <td className="text-right text-gray-300 font-mono">{target?.toLocaleString() || '-'}</td>
                                        <td className={`text-right font-mono font-medium ${isPositive ? 'text-green' : 'text-red'}`}>
                                            {isPositive ? '+' : ''}{upside?.toFixed(1)}%
                                        </td>
                                    </tr>
                                );
                            })}
                            {displayCalls.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="text-center text-gray py-4">
                                        No {rankingMode === 'buy' ? 'buy' : 'sell'} recommendations found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
}
