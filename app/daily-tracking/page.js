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

import MacroeconomicsTab from '../components/daily-tracking/MacroeconomicsTab';

import MarketTab from '../components/daily-tracking/MarketTab';

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
                    // Ensure Market is always first if available
                    if (settings['Daily Tracking - Market']?.includes(role)) tabs.push('Market');
                    if (settings['Daily Tracking - Macroeconomics']?.includes(role)) tabs.push('Macroeconomics');
                    if (settings['Daily Tracking - Economics']?.includes(role)) tabs.push('Economics');
                    if (settings['Daily Tracking - Research']?.includes(role)) tabs.push('Research');
                    if (settings['Daily Tracking - Fundamentals']?.includes(role)) tabs.push('Fundamentals');

                    setAvailableTabs(tabs);
                    // If current activeTab not in allowed list, reset to first allowed
                    setActiveTab(prev => (tabs.length > 0 && !tabs.includes(prev)) ? tabs[0] : prev);
                    setLoadingFeatures(false);
                })
                .catch(err => {
                    console.error("Failed to fetch features", err);
                    setLoadingFeatures(false);
                });
        } else if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, role, router]);

    const marketData = tabData['market'];
    const currentData = tabData[activeTab.toLowerCase() === 'macroeconomics' ? 'economics' : activeTab.toLowerCase()];

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Time filter: 1M, 3M, 6M, YTD, 1Y, ALL, CUSTOM
    const [timeFilter, setTimeFilter] = useState('3M');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const handlePreset = (t) => {
        setTimeFilter(t);
        setCustomFrom('');
        setCustomTo('');
    };

    const handleCustomFrom = (val) => {
        setCustomFrom(val);
        setTimeFilter('CUSTOM');
    };

    const handleCustomTo = (val) => {
        setCustomTo(val);
        setTimeFilter('CUSTOM');
    };


    useEffect(() => {
        async function fetchTabData(tabName) {
            const type = tabName.toLowerCase() === 'macroeconomics' ? 'economics' : tabName.toLowerCase();
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

        let cutoffStr;
        if (timeFilter === 'CUSTOM') {
            cutoffStr = customFrom || '1900-01-01';
        } else {
            let days = 3650; // ALL
            if (timeFilter === '1M') days = 30;
            else if (timeFilter === '3M') days = 90;
            else if (timeFilter === '6M') days = 180;
            else if (timeFilter === '1Y') days = 365;
            else if (timeFilter === 'YTD') {
                const now = new Date();
                const start = new Date(now.getFullYear(), 0, 1);
                days = Math.floor((now - start) / (1000 * 60 * 60 * 24));
            }
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            cutoffStr = cutoffDate.toISOString().split('T')[0];
        }

        const toStr = (timeFilter === 'CUSTOM' && customTo) ? customTo : '9999-12-31';
        const filterFn = (arr) => arr ? arr.filter(d => d.date >= cutoffStr && d.date <= toStr) : [];

        return {
            ...marketData,
            vn_index: filterFn(marketData.vn_index),
            derivatives_prop: filterFn(marketData.derivatives_prop),
            dc_cash_ratio: filterFn(marketData.dc_cash_ratio),
            sector_leadership: filterFn(marketData.sector_leadership),
            put_through: marketData.put_through
        };
    }, [marketData, timeFilter, customFrom, customTo]);

    if (status === 'loading' || loadingFeatures || loading) {
        return (
            <div style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#888', fontSize: '14px' }}>Loading Market Data...</div>
            </div>
        );
    }

    const customRange = timeFilter === 'CUSTOM' ? { from: customFrom, to: customTo } : null;

    const timeFilterControl = (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            {['1M', '3M', '6M', 'YTD', '1Y', 'ALL'].map(t => (
                <button
                    key={t}
                    onClick={() => handlePreset(t)}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                <span style={{ fontSize: '11px', color: '#666' }}>From</span>
                <input
                    type="date"
                    value={customFrom}
                    onChange={e => handleCustomFrom(e.target.value)}
                    style={{
                        background: '#1a1a1a',
                        border: `1px solid ${timeFilter === 'CUSTOM' && customFrom ? '#00a884' : '#333'}`,
                        color: '#ccc',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        colorScheme: 'dark'
                    }}
                />
                <span style={{ fontSize: '11px', color: '#666' }}>To</span>
                <input
                    type="date"
                    value={customTo}
                    onChange={e => handleCustomTo(e.target.value)}
                    style={{
                        background: '#1a1a1a',
                        border: `1px solid ${timeFilter === 'CUSTOM' && customTo ? '#00a884' : '#333'}`,
                        color: '#ccc',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        colorScheme: 'dark'
                    }}
                />
            </div>
        </div>
    );

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


                        {/* Tab Content Render */}
                        {activeTab === 'Market' && (
                            <>
                                {timeFilterControl}
                                {/* Top Cards Row */}


                                <MarketTab data={filteredMarketData} timeFilter={timeFilter} />
                            </>
                        )}

                        {activeTab === 'Macroeconomics' && <MacroeconomicsTab data={currentData} timeFilter={timeFilter} customRange={customRange} timeFilterControl={timeFilterControl} />}
                        {activeTab === 'Economics' && (
                            <>
                                {timeFilterControl}
                                <EconomicsTab data={currentData} timeFilter={timeFilter} />
                            </>
                        )}
                        {activeTab === 'Research' && <ResearchTab data={currentData} />}
                        {activeTab === 'Fundamentals' && <FundamentalsTab data={currentData} />}

                    </div>
                ) : null}
            </div>
        </>
    );
}

