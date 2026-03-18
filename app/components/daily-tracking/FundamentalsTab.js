import React, { useState, useEffect } from 'react';
import HistoricalFlowChart from './HistoricalFlowChart';
import SectorTreemap from './SectorTreemap';
import ValuationBoxPlot from './ValuationBoxPlot';
import ValuationScatterChart from '../model/ValuationScatterChart';

export default function FundamentalsTab() {
    const [fundamentalsData, setFundamentalsData] = useState([]);
    const [sectorAnalytics, setSectorAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/data_fundamentals_sample.json').then(res => {
                if (!res.ok) throw new Error(`Fundamentals 404: ${res.status}`);
                return res.json();
            }),
            fetch('/sector_analytics_payload.json').then(res => {
                if (!res.ok) throw new Error(`Analytics 404: ${res.status}`);
                return res.json();
            })
        ])
        .then(([fund, sector]) => {
            console.log("FundamentalsTab Data Loaded:", fund.length);
            console.log("Sector Analytics Payload:", sector);
            setFundamentalsData(fund || []);
            setSectorAnalytics(sector || {});
            setLoading(false);
        })
        .catch(err => {
            console.error("FundamentalsTab Fetch Error:", err);
            setLoading(false);
        });
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <div className="w-8 h-8 border-t-2 border-emerald-500 rounded-full animate-spin"></div>
                <span className="text-[10px] text-gray-700 font-bold tracking-widest">Loading Analytics...</span>
            </div>
        );
    }

    return (
        <div className="daily-tracking-grid" style={{ overflow: 'auto', background: '#0a0a0a' }}>
            {/* LEFT COLUMN (35%) */}
            <div className="daily-left-column" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <section className="card daily-card" style={{ height: '450px' }}>
                    <div className="daily-card-header" style={{ marginBottom: '1.5rem' }}>
                        <h3 className="daily-card-title" style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '800', textTransform: 'none', letterSpacing: '0.5px' }}>
                            Valuation Distribution
                        </h3>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <ValuationScatterChart data={fundamentalsData} />
                    </div>
                </section>

                <section className="card daily-card" style={{ flex: 1 }}>
                    <div className="daily-card-header" style={{ marginBottom: '1.5rem' }}>
                        <h3 className="daily-card-title" style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '800', textTransform: 'none', letterSpacing: '0.5px' }}>
                            Deep Sector Breakdown
                        </h3>
                    </div>
                    <div className="table-wrapper" style={{ overflowY: 'auto' }}>
                        <table className="mini-table" style={{ width: '100%', fontSize: '11px' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', color: 'var(--accent)', fontWeight: '700', textTransform: 'none' }}>Industry</th>
                                    <th style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: '700', textTransform: 'none' }}>P/E</th>
                                    <th style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: '700', textTransform: 'none' }}>Tickers</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fundamentalsData.slice(0, 50).map((row, idx) => (
                                    <tr key={idx}>
                                        <td style={{ textAlign: 'left', color: '#fff', fontWeight: '600' }}>{row.industry}</td>
                                        <td style={{ textAlign: 'right', color: '#00ff7f', fontWeight: '700' }}>{row.pe?.toFixed(2)}x</td>
                                        <td style={{ textAlign: 'right', color: '#666' }}>{row.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {/* RIGHT COLUMN (65%) */}
            <div className="daily-right-column" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <section className="card daily-card" style={{ height: '400px' }}>
                    <div className="daily-card-header" style={{ marginBottom: '1.5rem' }}>
                        <h3 className="daily-card-title" style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '800', textTransform: 'none', letterSpacing: '0.5px' }}>
                            Smart Money Flow History
                        </h3>
                    </div>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <HistoricalFlowChart data={sectorAnalytics?.flowHistory || []} />
                    </div>
                </section>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flex: 1 }}>
                    <section className="card daily-card">
                        <div className="daily-card-header" style={{ marginBottom: '1.5rem' }}>
                            <h3 className="daily-card-title" style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '800', textTransform: 'none', letterSpacing: '0.5px' }}>
                                Performance Matrix
                            </h3>
                        </div>
                        <div style={{ flex: 1, minHeight: 0 }}>
                            <SectorTreemap data={sectorAnalytics?.treemapData || []} />
                        </div>
                    </section>

                    <section className="card daily-card">
                        <div className="daily-card-header" style={{ marginBottom: '1.5rem' }}>
                            <h3 className="daily-card-title" style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '800', textTransform: 'none', letterSpacing: '0.5px' }}>
                                Historical P/E Variance
                            </h3>
                        </div>
                        <div style={{ flex: 1, minHeight: 0 }}>
                            <ValuationBoxPlot data={sectorAnalytics?.boxplotData || []} />
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
