'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/app/components/Header';
import ValuationScatterChart from '@/app/components/model/ValuationScatterChart';
import SectorNetFlowChart from '@/app/components/SectorNetFlowChart';
import SectorTreemap from '@/app/components/daily-tracking/SectorTreemap';
import SectorValuationBoxplot from '@/app/components/SectorValuationBoxplot';

export default function FundamentalsPage() {
    const [fundamentalsData, setFundamentalsData] = useState([]);
    const [sectorAnalytics, setSectorAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Industry');

    useEffect(() => {
        Promise.all([
            fetch('/industry_valuation_summary.json').then(res => {
                if (!res.ok) throw new Error(`Fundamentals fetch failed: ${res.status}`);
                return res.json();
            }),
            fetch('/sector_analytics_payload.json').then(res => {
                if (!res.ok) throw new Error(`Analytics fetch failed: ${res.status}`);
                return res.json();
            })
        ])
        .then(([fund, sector]) => {
            setFundamentalsData(fund);
            setSectorAnalytics(sector);
            setLoading(false);
        })
        .catch(err => {
            console.error("Critical Data Fetch Error:", err);
            setLoading(false);
        });
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] gap-4">
                <div className="w-10 h-10 border-t-2 border-emerald-500 rounded-full animate-spin"></div>
                <span className="text-[10px] text-zinc-600 font-bold tracking-[0.2em] uppercase animate-pulse">Synchronizing Intelligence...</span>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: '#050505', minHeight: '100vh', color: '#ccc', fontFamily: 'Inter, sans-serif' }}>
            <Header title="Market Fundamentals" />

            {/* Top Tabs */}
            <div style={{ padding: '0 2rem', borderBottom: '1px solid #111', background: '#050505', position: 'sticky', top: '56px', zIndex: 40 }}>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    {['Industry', 'Company'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                borderBottom: activeTab === tab ? '2px solid #00ff7f' : '2px solid transparent',
                                color: activeTab === tab ? '#00ff7f' : '#555',
                                padding: '16px 4px',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                marginBottom: '-1px',
                                textTransform: 'none',
                                letterSpacing: '0.2px'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            <main style={{ 
                padding: '1.5rem 2rem', 
                maxWidth: '1440px',
                margin: '0 auto',
                display: 'grid',
                gridTemplateColumns: '300px 1fr',
                gap: '2rem',
                minHeight: 'calc(100vh - 120px)'
            }}>
                {activeTab === 'Industry' ? (
                    <>
                        {/* Left Column: Focused on the List/Table */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            <section className="card" style={{ flex: 1, padding: '1.25rem', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', minHeight: '800px' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: '800' }}>
                                        Sector Breakdown
                                    </h3>
                                    <div style={{ fontSize: '11px', color: '#555' }}>Constituent Count & PE</div>
                                </div>
                                <div className="table-wrapper" style={{ overflowY: 'auto', flex: 1 }}>
                                    <table className="mini-table" style={{ width: '100%', fontSize: '11px' }}>
                                        <thead style={{ position: 'sticky', top: 0, background: '#0a0a0a', zIndex: 10 }}>
                                            <tr style={{ borderBottom: '1px solid #222' }}>
                                                <th style={{ textAlign: 'left', color: '#666', fontWeight: '700', padding: '12px 4px' }}>Industry</th>
                                                <th style={{ textAlign: 'right', color: '#666', fontWeight: '700', padding: '12px 4px' }}>P/E</th>
                                                <th style={{ textAlign: 'right', color: '#666', fontWeight: '700', padding: '12px 4px' }}>#</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {fundamentalsData.slice(0, 50).map((row, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #111' }}>
                                                    <td style={{ textAlign: 'left', color: '#fff', fontWeight: '600', padding: '10px 4px' }}>{row.industry}</td>
                                                    <td style={{ textAlign: 'right', color: '#00ff7f', fontWeight: '800', padding: '10px 4px' }}>{row.pe?.toFixed(2)}x</td>
                                                    <td style={{ textAlign: 'right', color: '#444', padding: '10px 4px' }}>{row.count}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>

                        {/* Right Column: High-Res Visualizations */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', minWidth: 0 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                <section className="card" style={{ height: '400px', padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                                    <SectorNetFlowChart data={sectorAnalytics?.flowHistory || []} />
                                </section>
                                <section className="card" style={{ height: '400px', padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                                    <ValuationScatterChart data={fundamentalsData} />
                                </section>
                            </div>

                            <section className="card" style={{ minHeight: '520px', padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                                <SectorValuationBoxplot />
                            </section>

                            <section className="card" style={{ height: '380px', padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <h3 style={{ color: '#fff', fontSize: '14px', fontWeight: '800' }}>
                                        Yield Heatmap
                                    </h3>
                                    <div style={{ fontSize: '11px', color: '#555' }}>Relative Performance & Yield Matrix</div>
                                </div>
                                <div style={{ flex: 1, minHeight: 0 }}>
                                    <SectorTreemap data={sectorAnalytics?.treemapData || []} />
                                </div>
                            </section>
                        </div>
                    </>
                ) : (
                    <div className="col-span-2 flex flex-col items-center justify-center p-20 text-center">
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-4">Under Synchronization</h2>
                        <p className="text-zinc-500 max-w-md text-sm">Company-level financial interrogation is being ported to the new grid-based analytical engine.</p>
                    </div>
                )}
            </main>
        </div>
    );
}
