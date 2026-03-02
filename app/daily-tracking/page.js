'use client';

import { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import MarketBreadthChart from '../components/daily-tracking/MarketBreadthChart';
import PropArbitrageChart from '../components/daily-tracking/PropArbitrageChart';
import SectorLeadershipChart from '../components/daily-tracking/SectorLeadershipChart';
import PutThroughTable from '../components/daily-tracking/PutThroughTable';
import DCCashRatioChart from '../components/daily-tracking/DCCashRatioChart';

import EconomicsTab from '../components/daily-tracking/EconomicsTab';
import ResearchTab from '../components/daily-tracking/ResearchTab';
import FundamentalsTab from '../components/daily-tracking/FundamentalsTab';

export default function DLEquityPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const role = session?.user?.role;

    const [availableTabs, setAvailableTabs] = useState([]);
    const [activeTab, setActiveTab] = useState('Market');
    const [tabData, setTabData] = useState({});
    const [loadingFeatures, setLoadingFeatures] = useState(true);

    // Fetch feature settings to determine available tabs
    useEffect(() => {
        if (status === 'authenticated' && role) {
            fetch('/api/admin/features')
                .then(res => res.json())
                .then(settings => {
                    const tabs = [];
                    if (settings['Daily Tracking - Market']?.includes(role)) tabs.push('Market');
                    if (settings['Daily Tracking - Economics']?.includes(role)) tabs.push('Economics');
                    if (settings['Daily Tracking - Research']?.includes(role)) tabs.push('Research');
                    if (settings['Daily Tracking - Fundamentals']?.includes(role)) tabs.push('Fundamentals');

                    setAvailableTabs(tabs);
                    if (tabs.length > 0 && !tabs.includes(activeTab)) {
                        setActiveTab(tabs[0]);
                    }
                    setLoadingFeatures(false);
                })
                .catch(err => {
                    console.error("Failed to fetch features", err);
                    setLoadingFeatures(false);
                });
        } else if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, role]);

    const marketData = tabData['market'];
    const currentData = tabData[activeTab.toLowerCase()];

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Time filter: 1M, 3M, 6M, YTD, 1Y, ALL
    const [timeFilter, setTimeFilter] = useState('3M');


    useEffect(() => {
        async function fetchTabData(tabName) {
            const type = tabName.toLowerCase();
            if (tabData[type]) {
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const res = await fetch(`/api/daily-tracking?type=${type}`);
                if (!res.ok) throw new Error('Failed to load data.');
                const data = await res.json();
                setTabData(prev => ({ ...prev, [type]: data }));
            } catch (e) {
                setError('Connection error or data unavailable.');
            } finally {
                setLoading(false);
            }
        }
        if (status === 'authenticated') {
            fetchTabData(activeTab);
        }
    }, [status, activeTab, tabData]);

    // Formatters
    const fmtPct = (v) => v != null ? `${v > 0 ? '+' : ''}${(v * 100).toFixed(2)}%` : '-';
    const fmtValue = (v) => v != null ? v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-';
    const fmtVol = (v) => {
        if (!v) return '-';
        if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(0)}B`;
        if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
        return v.toLocaleString();
    };

    // Derived top-level metrics
    const topMetrics = useMemo(() => {
        if (!marketData?.vn_index?.length) return null;
        const sorted = marketData.vn_index.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        const latest = sorted[sorted.length - 1];
        return {
            vnindex: latest.vnindex,
            vnindex_change: latest.vnindex_change_pct,
            breadth: latest.breadth_above_ma50, // Assuming breadth is normally fractional, checking format later
            outperform: latest.pct_outperform_vni_7d, // Should be 15D
            netForeign: latest.foreign_net_value
        };
    }, [marketData]);

    // Filtered data based on time selector (only applying to time series)
    const filteredMarketData = useMemo(() => {
        if (!marketData) return null;

        let days = 3650; // ALL
        if (timeFilter === '1M') days = 30;
        else if (timeFilter === '3M') days = 90;
        else if (timeFilter === '6M') days = 180;
        else if (timeFilter === '1Y') days = 365;
        // YTD requires calculating days since Jan 1st
        else if (timeFilter === 'YTD') {
            const now = new Date();
            const start = new Date(now.getFullYear(), 0, 1);
            days = Math.floor((now - start) / (1000 * 60 * 60 * 24));
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        const filterFn = (arr) => arr ? arr.filter(d => d.date >= cutoffStr) : [];

        return {
            ...marketData,
            vn_index: filterFn(marketData.vn_index),
            derivatives_prop: filterFn(marketData.derivatives_prop),
            dc_cash_ratio: filterFn(marketData.dc_cash_ratio),
            // Sector leadership is scatter point in time, usually just latest date but can keep history
            sector_leadership: filterFn(marketData.sector_leadership),
            // put_through uses crawl_date not date
            put_through: marketData.put_through
        };
    }, [marketData, timeFilter]);

    if (status === 'loading' || loadingFeatures || loading) {
        return (
            <div style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#888', fontSize: '14px' }}>Loading Market Data...</div>
            </div>
        );
    }

    return (
        <>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            <header className="header-bar" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}
                    >
                        ☰
                    </button>
                    <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>
                        Daily Market Tracking
                    </h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={() => window.location.reload()} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}>
                        ↻
                    </button>
                </div>
            </header>

            <div style={{ padding: '0 1.5rem', borderBottom: '1px solid #222', background: '#0a0a0a', display: 'flex', gap: '2rem' }}>
                {availableTabs.map(tab => (

                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab ? '2px solid #00a884' : '2px solid transparent',
                            color: activeTab === tab ? '#00a884' : '#888',
                            padding: '12px 4px',
                            fontSize: '14px',
                            fontWeight: activeTab === tab ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            marginBottom: '-1px'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div style={{ padding: '1.5rem', background: '#0a0a0a', minHeight: 'calc(100vh - 105px)' }}>
                {error ? (
                    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
                        <div style={{ color: '#888', fontSize: '13px' }}>{error}</div>
                    </div>
                ) : !loadingFeatures && !loading ? (
                    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>


                        {/* Time Filters (Only for Market and Economics) */}
                        {(activeTab === 'Market' || activeTab === 'Economics') && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {['1M', '3M', '6M', 'YTD', '1Y', 'ALL'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setTimeFilter(t)}
                                        style={{
                                            background: timeFilter === t ? '#00a884' : 'transparent',
                                            color: timeFilter === t ? '#fff' : '#aaa',
                                            border: `1px solid ${timeFilter === t ? '#00a884' : '#333'}`,
                                            padding: '6px 16px',
                                            borderRadius: '20px',
                                            fontSize: '12px',
                                            fontWeight: timeFilter === t ? 600 : 400,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Tab Content Render */}
                        {activeTab === 'Market' && (
                            <>
                                {/* Top Cards Row */}
                                {topMetrics && (
                                    <div className="card" style={{ padding: '0', minHeight: 'auto' }}>
                                        <div style={{ padding: '12px 20px', borderBottom: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>Vietnam Market</span>
                                            <span style={{ color: '#00a884' }}>↗</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0' }}>
                                            <div style={{ padding: '20px', borderRight: '1px solid #222', textAlign: 'center' }}>
                                                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>VN-Index</div>
                                                <div style={{ fontSize: '24px', fontWeight: 700, color: '#00a884', marginBottom: '4px' }}>
                                                    {fmtValue(topMetrics.vnindex)}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#aaa' }}>{fmtPct(topMetrics.vnindex_change)}</div>
                                            </div>
                                            <div style={{ padding: '20px', borderRight: '1px solid #222', textAlign: 'center' }}>
                                                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Breadth {'>'}MA50</div>
                                                <div style={{ fontSize: '24px', fontWeight: 700, color: '#fff' }}>
                                                    {topMetrics.breadth != null ? `${(topMetrics.breadth * 1).toFixed(1)}%` : '-'}
                                                </div>
                                            </div>
                                            <div style={{ padding: '20px', borderRight: '1px solid #222', textAlign: 'center' }}>
                                                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>15D O/P VNI</div>
                                                <div style={{ fontSize: '24px', fontWeight: 700, color: '#e55353' }}>
                                                    {topMetrics.outperform != null ? `${(topMetrics.outperform * 1).toFixed(1)}%` : '-'}
                                                </div>
                                            </div>
                                            <div style={{ padding: '20px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Net Foreign ex-DC</div>
                                                <div style={{ fontSize: '24px', fontWeight: 700, color: '#00a884' }}>
                                                    {fmtVol(topMetrics.netForeign)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Main Grid: Left Column (2/3) and Right Column (1/3) */}
                                {filteredMarketData && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem', alignItems: 'start' }}>
                                        {/* Left Column */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                            <MarketBreadthChart data={filteredMarketData.vn_index} />
                                            <SectorLeadershipChart data={filteredMarketData.sector_leadership} />
                                        </div>

                                        {/* Right Column */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                            <PropArbitrageChart data={filteredMarketData.derivatives_prop} />
                                            <DCCashRatioChart data={filteredMarketData.dc_cash_ratio} />
                                            <PutThroughTable data={filteredMarketData.put_through} />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'Economics' && <EconomicsTab data={currentData} timeFilter={timeFilter} />}
                        {activeTab === 'Research' && <ResearchTab data={currentData} />}
                        {activeTab === 'Fundamentals' && <FundamentalsTab data={currentData} />}

                    </div>
                ) : null}
            </div>
        </>
    );
}
