'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';
import MoneyMarketTab from './MoneyMarketTab';

const COLORS = {
    teal: '#027368',
    blue: '#3B82F6',
    purple: '#8B5CF6',
    gold: '#F59E0B',
    red: '#EF4444',
    green: '#10B981',
    gray: '#64748B',
    darkBg: '#020617',
    cardBg: '#0f172a',
    border: '#1e293b'
};

const BANK_COLORS = {
    'VPB': '#008466', 'TCB': '#2962FF', 'MBB': '#7B1FA2', 'BID': '#D4A82F',
    'VCB': '#00B8D4', 'CTG': '#C62828', 'ACB': '#1565C0', 'HDB': '#E65100',
    'VIB': '#F9A825', 'MSB': '#EF6C00', 'STB': '#2E7D32', 'LPB': '#D32F2F',
    'TPB': '#7B1FA2', 'SHB': '#F57C00', 'EIB': '#1976D2', 'OCB': '#388E3C',
    'SSB': '#C2185B', 'ABB': '#0097A7'
};

const ALL_BANKS = ['VPB', 'TCB', 'MBB', 'BID', 'VCB', 'CTG', 'ACB', 'HDB', 'VIB', 'MSB', 'STB'];

const dtFormatter = (v) => v ? v.substring(5).replace('-', '/') : '';

// Trend Icon Component
const TrendIcon = ({ trend }) => {
    if (trend === 'up') return (
        <svg width="10" height="10" viewBox="0 0 24 24" style={{ color: COLORS.green }}>
            <path d="M12 4l10 16H2z" fill="currentColor" />
        </svg>
    );
    if (trend === 'down') return (
        <svg width="10" height="10" viewBox="0 0 24 24" style={{ color: COLORS.red }}>
            <path d="M12 20L2 4h20z" fill="currentColor" />
        </svg>
    );
    return (
        <svg width="10" height="10" viewBox="0 0 24 24" style={{ color: COLORS.gray }}>
            <rect x="4" y="10" width="16" height="4" fill="currentColor" />
        </svg>
    );
};

// Initial Mock Data (Fallback if API fails) — grouped by region
const INITIAL_INDICES = [
    // Vietnam
    { id: 'VNINDEX', name: 'VN-Index', region: 'Vietnam', close: 1176.84, turnover: 474, turnoverChgYest: -2.5, turnoverChg10d: 5.2, d1: -2.25, d1m: 1.2, d3m: 3.5, d6m: 5.0, d12m: 10.0, ytd: 10.0, pe: 14.9, pb: 1.7, resistance: 1200, support: 1150, rsi: 52, ma20: 1160, macd: 5.2, date: 'N/A' },
    { id: 'HNXINDEX', name: 'HNX-Index', region: 'Vietnam', close: 253.64, turnover: 44, turnoverChgYest: -1.2, turnoverChg10d: 3.0, d1: -0.5, d1m: 0.8, d3m: 2.1, d6m: 3.5, d12m: 8.0, ytd: 3.0, pe: 16.1, pb: 1.3, resistance: 260, support: 245, rsi: 50, ma20: 250, macd: 1.2, date: 'N/A' },
    { id: 'VN30', name: 'VN30', region: 'Vietnam', close: 1904.19, turnover: 250, turnoverChgYest: -3.0, turnoverChg10d: 4.5, d1: -2.0, d1m: 1.0, d3m: 3.2, d6m: 4.8, d12m: 9.0, ytd: 8.0, pe: 14.9, pb: 1.7, resistance: 1950, support: 1850, rsi: 52, ma20: 1880, macd: 4.5, date: 'N/A' },
    // USA
    { id: 'SPX', name: 'S&P 500', region: 'USA', close: 5700, turnover: 65000, turnoverChgYest: 0.5, turnoverChg10d: 1.2, d1: -0.9, d1m: 2.1, d3m: 5.2, d6m: 10.5, d12m: 15.0, ytd: 8.0, pe: 26.0, pb: 5.0, resistance: 6000, support: 5600, rsi: 55, ma20: 5650, macd: 12.5, date: 'N/A' },
    { id: 'NASDAQ', name: 'Nasdaq', region: 'USA', close: 18000, turnover: 50000, turnoverChgYest: 0.2, turnoverChg10d: 0.8, d1: -1.2, d1m: 1.5, d3m: 4.8, d6m: 9.5, d12m: 14.0, ytd: 6.0, pe: 32.0, pb: 7.0, resistance: 19000, support: 17500, rsi: 52, ma20: 17800, macd: 25.0, date: 'N/A' },
    { id: 'DJI', name: 'Dow Jones', region: 'USA', close: 43000, turnover: 14000, d1: -0.5, ytd: 5.0, pe: 22.0, pb: 5.0, resistance: 45000, support: 42000, rsi: 54, ma20: null, macd: null, date: 'N/A' },
    // Europe
    { id: 'FTSE', name: 'FTSE 100', region: 'UK', close: 8288, turnover: 2800, d1: 0.1, ytd: 5.0, pe: 14.0, pb: 1.9, resistance: 8500, support: 8100, rsi: 53, ma20: null, macd: null, date: 'N/A' },
    { id: 'DAX', name: 'DAX', region: 'Germany', close: 22000, turnover: 5000, d1: 0.4, ytd: 14.0, pe: 17.0, pb: 1.8, resistance: 23000, support: 21000, rsi: 60, ma20: null, macd: null, date: 'N/A' },
    { id: 'CAC40', name: 'CAC 40', region: 'France', close: 8200, turnover: 3500, d1: 0.2, ytd: 8.0, pe: 16.0, pb: 1.7, resistance: 8500, support: 8000, rsi: 55, ma20: null, macd: null, date: 'N/A' },
    // China
    { id: 'SSE', name: 'Shanghai (SSE)', region: 'China', close: 3300, turnover: 40000, d1: 0.3, ytd: 2.0, pe: 13.0, pb: 1.3, resistance: 3500, support: 3100, rsi: 51, ma20: null, macd: null, date: 'N/A' },
    { id: 'CSI300', name: 'CSI 300', region: 'China', close: 3900, turnover: 35000, d1: 0.5, ytd: 3.0, pe: 14.0, pb: 1.5, resistance: 4100, support: 3700, rsi: 53, ma20: null, macd: null, date: 'N/A' },
    { id: 'HSI', name: 'Hang Seng', region: 'Hong Kong', close: 25000, turnover: 7000, d1: 1.0, ytd: 12.0, pe: 10.0, pb: 1.0, resistance: 27000, support: 24000, rsi: 58, ma20: null, macd: null, date: 'N/A' },
    // Asia
    { id: 'N225', name: 'Nikkei 225', region: 'Japan', close: 38000, turnover: 18000, d1: 0.4, ytd: 10.0, pe: 23.0, pb: 2.1, resistance: 40000, support: 36000, rsi: 54, ma20: null, macd: null, date: 'N/A' },
    { id: 'KOSPI', name: 'KOSPI', region: 'Korea', close: 2600, turnover: 8000, d1: 0.2, ytd: 3.0, pe: 12.0, pb: 1.0, resistance: 2800, support: 2500, rsi: 50, ma20: null, macd: null, date: 'N/A' },
    { id: 'ASX200', name: 'ASX 200', region: 'Australia', close: 8200, turnover: 5000, d1: 0.1, ytd: 4.0, pe: 18.0, pb: 2.2, resistance: 8500, support: 8000, rsi: 52, ma20: null, macd: null, date: 'N/A' },
    { id: 'STI', name: 'STI', region: 'Singapore', close: 3900, turnover: 1200, d1: 0.3, ytd: 5.0, pe: 14.0, pb: 1.3, resistance: 4000, support: 3700, rsi: 53, ma20: null, macd: null, date: 'N/A' },
];

export default function MacroeconomicsTab({ data, timeFilter, customRange, timeFilterControl }) {
    const [subTab, setSubTab] = useState('Global');
    const [indices, setIndices] = useState(INITIAL_INDICES);
    const [loadingIndices, setLoadingIndices] = useState(false);

    // Fetch Live Indices
    useEffect(() => {
        const fetchLiveIndices = async () => {
            setLoadingIndices(true);
            try {
                const res = await fetch('/api/daily-indices');
                if (res.ok) {
                    const d = await res.json();
                    if (d.indices) {
                        const live = Object.values(d.indices);
                        if (live.length > 0) {
                            const liveMap = Object.fromEntries(live.map(x => [x.id, x]));
                            setIndices(prev => {
                                // Merge: update matched rows with live data, keep others as fallback
                                const merged = prev.map(idx =>
                                    liveMap[idx.id] ? { ...idx, ...liveMap[idx.id] } : idx
                                );
                                // Append any live indices not yet in state
                                live.forEach(liveIdx => {
                                    if (!merged.find(m => m.id === liveIdx.id)) merged.push(liveIdx);
                                });
                                return merged;
                            });
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch live indices", e);
            } finally {
                setLoadingIndices(false);
            }
        };

        if (subTab === 'Global') {
            fetchLiveIndices();
        }
    }, [subTab]);

    // Money Market States
    const [dataSource, setDataSource] = useState('Quote');
    const [depositTenor, setDepositTenor] = useState('12M');
    const [selectedBanks, setSelectedBanks] = useState(['VPB', 'TCB', 'MBB', 'BID']);
    const [quoteData, setQuoteData] = useState([]);
    const [loadingQuote, setLoadingQuote] = useState(false);

    useEffect(() => {
        if (subTab === 'Money market') {
            const fetchQuotes = async () => {
                setLoadingQuote(true);
                try {
                    const res = await fetch('/api/daily-tracking?type=deposit_quote');
                    if (res.ok) {
                        const d = await res.json();
                        setQuoteData(d.deposit_quote || []);
                    }
                } catch (e) {
                    console.error("Failed to load quote data", e);
                } finally {
                    setLoadingQuote(false);
                }
            };
            fetchQuotes();
        }
    }, [subTab]);

    const toggleBank = (bank) => {
        setSelectedBanks(prev =>
            prev.includes(bank) ? prev.filter(b => b !== bank) : [...prev, bank]
        );
    };

    const getFilteredData = useCallback((arr) => {
        if (!arr || !arr.length) return [];
        let days = 3650;
        if (timeFilter === '1M') days = 30;
        else if (timeFilter === '3M') days = 90;
        else if (timeFilter === '6M') days = 180;
        else if (timeFilter === '1Y') days = 365;
        else if (timeFilter === 'YTD') {
            const now = new Date();
            days = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24));
        }
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];
        return arr.filter(d => d.date >= cutoffStr).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [timeFilter]);

    // Money Market Calculations (reusing from previous work)
    const depositChartData = useMemo(() => {
        if (!data) return [];
        let rawSource = [];
        if (dataSource === 'Quote') {
            rawSource = getFilteredData(quoteData);
            return rawSource.map(day => {
                const row = { date: day.date };
                selectedBanks.forEach(b => {
                    if (day.banks && day.banks[b] && day.banks[b][depositTenor]) {
                        row[b] = day.banks[b][depositTenor];
                    }
                });
                return row;
            });
        } else {
            const baseData = (dataSource === 'Retail' ? data.deposit : data.deposit_institution) || data.deposit || [];
            rawSource = getFilteredData(baseData).filter(d =>
                (d.tenor === depositTenor || d.tenor === depositTenor.toLowerCase()) && selectedBanks.includes(d.bank)
            );
            const grouped = {};
            rawSource.forEach(d => {
                if (!grouped[d.date]) grouped[d.date] = { date: d.date };
                grouped[d.date][d.bank] = d.rate;
            });
            return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
        }
    }, [dataSource, quoteData, data, depositTenor, selectedBanks, getFilteredData]);

    const treasuryChartData = useMemo(() => {
        if (!data || !data.treasury) return [];
        const raw = getFilteredData(data.treasury);
        const grouped = {};
        raw.forEach(d => {
            if (!grouped[d.date]) grouped[d.date] = { date: d.date };
            let key = 'State Treasury';
            if (d.instrument.toLowerCase().includes('omo')) key = 'OMO';
            if (d.instrument.toLowerCase().includes('citad')) key = 'CITAD';
            grouped[d.date][key] = d.rate;
        });
        return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [data, getFilteredData]);

    const customTooltipStyle = {
        backgroundColor: COLORS.cardBg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '8px',
        color: '#f8fafc',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
    };

    const renderSubTabs = () => (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '10px' }}>
            {['Global', 'Macro', 'Money market', 'Commodity'].map(t => (
                <button
                    key={t}
                    onClick={() => setSubTab(t)}
                    style={{
                        background: subTab === t ? COLORS.teal : 'transparent',
                        color: subTab === t ? '#fff' : '#94a3b8',
                        border: `1px solid ${subTab === t ? COLORS.teal : '#1e293b'}`,
                        padding: '6px 16px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.1s'
                    }}
                >
                    {t}
                </button>
            ))}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {renderSubTabs()}

            {(subTab === 'Macro' || subTab === 'Money market' || subTab === 'Commodity') && timeFilterControl}

            {subTab === 'Global' && (
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'start', flexWrap: 'wrap' }}>
                    {/* Main Indicators Table */}
                    <div style={{ flex: '1 1 500px', minWidth: '0', maxWidth: '100%' }}>
                        <div className="card" style={{ padding: '0', overflow: 'hidden', border: `1px solid ${COLORS.border}`, borderRadius: '12px', background: COLORS.cardBg }}>
                            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 41, 59, 0.4)' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>Global Indices</h3>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b' }}>Live Technical & Fundamental Benchmarks</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: COLORS.green, boxShadow: `0 0 8px ${COLORS.green}`, opacity: loadingIndices ? 0.4 : 1 }}></span>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: COLORS.green, letterSpacing: '0.05em' }}>{loadingIndices ? 'SYNCING...' : 'LIVE'}</span>
                                </div>
                            </div>
                            <GlobalIndicatorsTable indices={indices} />
                        </div>
                    </div>

                    {/* Economic Calendar Sidebar */}
                    <div style={{ flex: '1 1 350px', minWidth: '0', maxWidth: '100%', height: '600px' }}>
                        <div className="card" style={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column', border: `1px solid ${COLORS.border}`, borderRadius: '12px', background: COLORS.cardBg }}>
                            <div style={{ padding: '1rem', borderBottom: `1px solid ${COLORS.border}`, background: 'rgba(30, 41, 59, 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>Economic Calendar</h3>
                                <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: '#64748b' }}>
                                    <span title="Actual"><strong>A:</strong> Actual</span>
                                    <span title="Forecast"><strong>F:</strong> Forecast</span>
                                    <span title="Previous"><strong>P:</strong> Previous</span>
                                </div>
                            </div>
                            <TradingViewCalendarWidget />
                        </div>
                    </div>
                </div>
            )}

            {subTab === 'Macro' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                    {[
                        { label: 'US 10Y Treasury Yield', symbol: 'TVC:US10Y' },
                        { label: 'DXY - US Dollar Index', symbol: 'CAPITALCOM:DXY' },
                        { label: 'Vietnam 10Y Bond Yield', symbol: 'TVC:VN10Y' },
                        { label: 'USD/VND', symbol: 'FX_IDC:USDVND' }
                    ].map(card => (
                        <div key={card.label} className="card" style={{ padding: '0', height: '350px', border: `1px solid ${COLORS.border}`, borderRadius: '12px' }}>
                            <div style={{ padding: '0.875rem 1rem', borderBottom: `1px solid ${COLORS.border}`, background: 'rgba(30, 41, 59, 0.4)' }}>
                                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{card.label}</h3>
                            </div>
                            <TradingViewMiniChartWidget symbol={card.symbol} timeFilter={timeFilter} />
                        </div>
                    ))}
                </div>
            )}

            {subTab === 'Money market' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <MoneyMarketTab timeFilter={timeFilter} customRange={customRange} />
                </div>
            )}

            {subTab === 'Commodity' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                    {[
                        { label: 'Gold', symbol: 'TVC:GOLD' },
                        { label: 'Crude Oil WTI', symbol: 'TVC:USOIL' },
                        { label: 'Copper', symbol: 'COMEX:HG1!' },
                        { label: 'Natural Gas', symbol: 'NYMEX:NG1!' }
                    ].map(card => (
                        <div key={card.label} className="card" style={{ padding: '0', height: '400px', border: `1px solid ${COLORS.border}`, borderRadius: '12px' }}>
                            <div style={{ padding: '0.875rem 1rem', borderBottom: `1px solid ${COLORS.border}`, background: 'rgba(30, 41, 59, 0.4)' }}>
                                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{card.label}</h3>
                            </div>
                            <TradingViewMiniChartWidget symbol={card.symbol} timeFilter={timeFilter} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// PREMIUM INDICATORS TABLE
function GlobalIndicatorsTable({ indices }) {
    const getValueWithIcon = (val, isPercent = false) => {
        const isPositive = val > 0;
        const isZero = val === 0;
        const trend = isPositive ? 'up' : (isZero ? 'neutral' : 'down');
        const color = isPositive ? COLORS.green : (isZero ? COLORS.gray : COLORS.red);

        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '12px', color }}>
                    {isPositive && '+'}{val.toFixed(2)}{isPercent && '%'}
                </span>
                <TrendIcon trend={trend} />
            </div>
        );
    };

    return (
        <div style={{ overflowX: 'auto', background: COLORS.cardBg, maxWidth: '100%' }} className="hidden-scrollbar">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', color: '#94a3b8' }}>
                <thead>
                    <tr style={{ background: 'rgba(30, 41, 59, 0.2)', textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1' }}>Index</th>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1' }}>Region</th>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'right' }}>Date</th>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'right' }}>Price</th>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'right' }}>Turnover<br />(USD mn)</th>
                        <th colSpan="6" style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>Performance</th>
                        <th colSpan="2" style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>Valuation</th>
                        <th colSpan="5" style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>Technical Benchmarks</th>
                    </tr>
                    <tr style={{ background: 'rgba(30, 41, 59, 0.1)', textAlign: 'center', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: `1px solid ${COLORS.border}` }}>
                        <th colSpan="5"></th>
                        <th style={{ padding: '6px', borderLeft: `1px solid ${COLORS.border}` }}>1D</th>
                        <th style={{ padding: '6px' }}>1M</th>
                        <th style={{ padding: '6px' }}>3M</th>
                        <th style={{ padding: '6px' }}>6M</th>
                        <th style={{ padding: '6px' }}>12M</th>
                        <th style={{ padding: '6px' }}>YTD</th>
                        <th style={{ padding: '6px', borderLeft: `1px solid ${COLORS.border}` }}>P/E</th>
                        <th style={{ padding: '6px' }}>P/B</th>
                        <th style={{ padding: '6px', borderLeft: `1px solid ${COLORS.border}` }}>Resistance</th>
                        <th style={{ padding: '6px' }}>Support</th>
                        <th style={{ padding: '6px' }}>RSI</th>
                        <th style={{ padding: '6px' }}>MA(20)</th>
                        <th style={{ padding: '6px' }}>MACD</th>
                    </tr>
                </thead>
                <tbody>
                    {indices.map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${COLORS.border}`, transition: 'background 0.2s' }}>
                            <td style={{ padding: '8px 16px', fontWeight: 700, color: '#f1f5f9', fontSize: '13px' }}>{row.name}</td>
                            <td style={{ padding: '8px 16px', color: '#64748b', fontWeight: 500 }}>{row.region}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', color: '#94a3b8', fontSize: '11px' }}>{row.date || 'N/A'}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: '#f8fafc', fontSize: '12px' }}>{typeof row.close === 'number' ? row.close.toLocaleString(undefined, { minimumFractionDigits: 2 }) : row.close}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}` }}>
                                {row.turnover != null ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end', minHeight: '44px', justifyContent: 'center' }}>
                                        <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: '13px' }}>
                                            ${row.turnover.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </div>
                                        <div style={{ fontSize: '9px', fontWeight: 500 }}>
                                            {row.turnoverChgYest != null ? (
                                                <span style={{ color: row.turnoverChgYest >= 0 ? COLORS.green : COLORS.red }}>
                                                    {row.turnoverChgYest >= 0 ? '+' : ''}{row.turnoverChgYest.toFixed(2)}% vs D-1
                                                </span>
                                            ) : (
                                                <span style={{ color: '#4b5563' }}>N/A vs D-1</span>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '9px', fontWeight: 500 }}>
                                            {row.turnoverChg10d != null ? (
                                                <span style={{ color: row.turnoverChg10d >= 0 ? COLORS.green : COLORS.red }}>
                                                    {row.turnoverChg10d >= 0 ? '+' : ''}{row.turnoverChg10d.toFixed(2)}% vs 10d
                                                </span>
                                            ) : (
                                                <span style={{ color: '#4b5563' }}>N/A vs 10d</span>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ color: '#4b5563', fontWeight: 500, fontSize: '12px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>N/A</div>
                                )}
                            </td>

                            <td style={{ padding: '8px 16px', textAlign: 'right', borderLeft: `1px solid ${COLORS.border}` }}>
                                {getValueWithIcon(row.d1, true)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.d1m != null ? getValueWithIcon(row.d1m, true) : '–'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.d3m != null ? getValueWithIcon(row.d3m, true) : '–'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.d6m != null ? getValueWithIcon(row.d6m, true) : '–'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.d12m != null ? getValueWithIcon(row.d12m, true) : '–'}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.ytd != null ? getValueWithIcon(row.ytd, true) : '–'}</td>

                            <td style={{ padding: '8px 16px', textAlign: 'right', borderLeft: `1px solid ${COLORS.border}`, color: '#cbd5e1', fontWeight: 600 }}>{row.pe != null ? `${row.pe}x` : '–'}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', color: '#cbd5e1', fontWeight: 600 }}>{row.pb != null ? `${row.pb}x` : '–'}</td>

                            <td style={{ padding: '8px 16px', textAlign: 'right', borderLeft: `1px solid ${COLORS.border}`, color: '#f1f5f9' }}>{row.resistance != null ? row.resistance.toLocaleString() : '–'}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', color: '#f1f5f9' }}>{row.support != null ? row.support.toLocaleString() : '–'}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: row.rsi > 70 ? COLORS.red : (row.rsi < 30 ? COLORS.green : '#cbd5e1') }}>{row.rsi ?? '–'}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', color: '#94a3b8' }}>{row.ma20 != null ? row.ma20.toLocaleString() : '–'}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', color: row.macd != null ? (String(row.macd).startsWith('-') ? COLORS.red : COLORS.green) : '#94a3b8', fontWeight: 600 }}>{row.macd ?? '–'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <style jsx>{`
                tr:hover { background-color: rgba(30, 41, 59, 0.6); }
                td, th { white-space: nowrap; }
            `}</style>
        </div>
    );
}

// TradingView Widgets
function TradingViewCalendarWidget() {
    const containerRef = useRef(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Cleanup existing content
        container.innerHTML = '';

        const script = document.createElement('script');
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "width": "100%", "height": "100%", "colorTheme": "dark", "isTransparent": true, "locale": "en",
            "importanceFilter": "-1,0,1", "currencyFilter": "USD,VND,EUR,JPY,GBP,CNY"
        });
        container.appendChild(script);

        return () => {
            if (container) container.innerHTML = '';
        };
    }, []);
    return <div ref={containerRef} style={{ height: '100%', width: '100%', overflow: 'hidden' }} />;
}

function TradingViewMiniChartWidget({ symbol, timeFilter }) {
    const containerRef = useRef(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.innerHTML = '';

        let dateRange = "12M";
        if (timeFilter === '1M') dateRange = "1M";
        else if (timeFilter === '3M') dateRange = "3M";
        else if (timeFilter === '6M') dateRange = "6M";
        else if (timeFilter === 'YTD') dateRange = "YTD";
        else if (timeFilter === '1Y') dateRange = "12M";
        else if (timeFilter === 'ALL') dateRange = "ALL";

        const script = document.createElement('script');
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "symbol": symbol, "width": "100%", "height": "100%", "locale": "en", "dateRange": dateRange,
            "colorTheme": "dark", "isTransparent": true, "autosize": true, "largeChartUrl": ""
        });
        container.appendChild(script);

        return () => {
            if (container) container.innerHTML = '';
        };
    }, [symbol, timeFilter]);
    return <div ref={containerRef} style={{ height: '100%', width: '100%', overflow: 'hidden' }} />;
}
