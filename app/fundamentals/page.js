'use client';

import React, { useState, useEffect, useMemo } from 'react';
import IndustryHeatmap from '@/app/components/IndustryHeatmap';
import IndustryTrendlines from '@/app/components/IndustryTrendlines';
import CompanyFinancials from '@/app/components/CompanyFinancials';
import Sidebar from '@/app/components/Sidebar';

export default function FundamentalsPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('Industry');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/industry-analysis');
                if (!res.ok) throw new Error(`Failed to fetch data: ${res.statusText}`);
                const result = await res.json();
                setData(result.data);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const tabStyle = (t) => ({
        padding: '10px 24px',
        borderBottom: activeTab === t ? `2px solid #00a884` : '2px solid transparent',
        color: activeTab === t ? '#00a884' : '#888',
        fontWeight: activeTab === t ? 600 : 500,
        fontSize: '14px', cursor: 'pointer', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none',
        transition: 'all 0.2s'
    });

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: '#888', fontSize: '14px' }}>
                Loading...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-[60vh] text-red-500">
                <p>Error: {error}</p>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0a' }}>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <header className="header-bar" style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 24px', borderBottom: '1px solid #222' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                            onClick={() => setSidebarOpen(true)}
                            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}
                        >
                            ☰
                        </button>
                        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>
                            Fundamentals
                        </h1>
                    </div>
                </header>

                <div style={{ padding: '1.5rem', background: '#0a0a0a', minHeight: 'calc(100vh - 61px)' }}>
                    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Tabs */}
                        <div style={{ padding: '0 1.5rem', borderBottom: '1px solid #222', background: '#0a0a0a', display: 'flex', gap: '2rem', margin: '-1.5rem -1.5rem 1.5rem -1.5rem' }}>
                            {['Industry', 'Company'].map(t => (
                                <button key={t} style={tabStyle(t)} onClick={() => setActiveTab(t)}>{t}</button>
                            ))}
                        </div>

                        {/* Industry Tab View */}
                        {activeTab === 'Industry' && (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <p style={{ color: '#aaa', fontSize: '13px', margin: 0 }}>
                                    Compare sector rotation and identify market-leading industries. Data parsed up to: <b>{new Date(data?.scraped_at).toLocaleString()}</b>
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px' }}>
                                    {/* Heatmap Section */}
                                    <div className="card" style={{ padding: '1.5rem', background: '#111', border: '1px solid #222' }}>
                                        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', margin: '0 0 4px 0' }}>Performance Overview</h2>
                                        <p style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>Compare Level 2 Industries by 1-Month Price Change or P/E Ratio</p>
                                        <IndustryHeatmap data={data?.heatmapData} />
                                    </div>

                                    {/* Trendlines Section */}
                                    <div className="card" style={{ padding: '1.5rem', background: '#111', border: '1px solid #222' }}>
                                        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', margin: '0 0 4px 0' }}>Sector Rotation & Trendlines</h2>
                                        <p style={{ fontSize: '12px', color: '#888', marginBottom: '20px' }}>Track Relative Strength (RS) Momentum of specific industries against the VN-Index over time.</p>
                                        <IndustryTrendlines data={data?.trendlineData} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Company Tab View */}
                        {activeTab === 'Company' && (
                            <div className="animate-fade-in">
                                <CompanyFinancials />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
