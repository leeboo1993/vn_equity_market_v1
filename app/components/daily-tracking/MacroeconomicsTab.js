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

// Initial Mock Data (Fallback if API fails)
const INITIAL_INDICES = [
    { id: 'VNINDEX', name: 'VN-Index', region: 'Vietnam', close: 1813.14, turnover: 473.5, d1: 0.15, ytd: 13.6, pe: 14.97, pb: 1.7, resistance: 1850, support: 1780, rsi: 64, ma20: 1810, macd: '+1.2' },
    { id: 'HNXINDEX', name: 'HNX-Index', region: 'Vietnam', close: 240.15, turnover: 43.5, d1: 0.72, ytd: 4.4, pe: 16.1, pb: 1.3, resistance: 255, support: 235, rsi: 60, ma20: 238, macd: '+0.4' },
    { id: 'SPX', name: 'S&P 500', region: 'USA', close: 5892.40, turnover: 70955, d1: -0.92, ytd: 17.5, pe: 26.1, pb: 5.0, resistance: 6000, support: 5800, rsi: 58, ma20: 5850, macd: '+12.5' },
    { id: 'DJI', name: 'Dow Jones', region: 'USA', close: 40713, turnover: 13837, d1: -0.45, ytd: 7.9, pe: 22.7, pb: 5.2, resistance: 41200, support: 39950, rsi: 59, ma20: 40450, macd: '+15.2' },
    { id: 'FTSE', name: 'FTSE 100', region: 'UK', close: 8288.65, turnover: 2879, d1: 0.12, ytd: 7.3, pe: 14.4, pb: 1.9, resistance: 8400, support: 8150, rsi: 54, ma20: 8210, macd: '-2.1' },
    { id: 'N225', name: 'Nikkei 225', region: 'Japan', close: 38364.2, turnover: 18869, d1: 0.44, ytd: 14.6, pe: 23.4, pb: 2.1, resistance: 39500, support: 37200, rsi: 54, ma20: 38100, macd: '+22.1' },
    { id: 'HSI', name: 'Hang Seng', region: 'Hong Kong', close: 17612.4, turnover: 6997, d1: -0.23, ytd: 4.9, pe: 9.8, pb: 1.0, resistance: 18200, support: 16950, rsi: 56, ma20: 17420, macd: '+3.2' },
];

export default function MacroeconomicsTab({ data, timeFilter, timeFilterControl }) {
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
                        setIndices(Object.values(d.indices));
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
                    <div style={{ flex: '1 1 62%', minWidth: '750px' }}>
                        <div className="card" style={{ padding: '0', overflow: 'hidden', border: `1px solid ${COLORS.border}`, borderRadius: '12px', background: COLORS.cardBg }}>
                            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 41, 59, 0.4)' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>Market Pulse: Global Indicators</h3>
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
                    <div style={{ flex: '0 0 35%', minWidth: '420px', height: '680px' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.25rem' }}>
                    {[
                        { label: 'US 10Y Treasury Yield', symbol: 'TVC:US10Y' },
                        { label: 'DXY - US Dollar Index', symbol: 'CAPITALCOM:DXY' },
                        { label: 'Vietnam 10Y Bond Yield', symbol: 'TVC:VN10Y' },
                        { label: 'USD/VND', symbol: 'FX_IDC:USDVND' }
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

            {subTab === 'Money market' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <MoneyMarketTab timeFilter={timeFilter} />
                </div>
            )}

            {subTab === 'Commodity' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.25rem' }}>
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
        <div style={{ overflowX: 'auto', background: COLORS.cardBg }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', color: '#94a3b8' }}>
                <thead>
                    <tr style={{ background: 'rgba(30, 41, 59, 0.2)', textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1' }}>Index</th>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1' }}>Region</th>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'right' }}>Price</th>
                        <th style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'right' }}>Turnover (M USD)</th>
                        <th colSpan="2" style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>Pulse Δ</th>
                        <th colSpan="2" style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>Valuation</th>
                        <th colSpan="5" style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}` }}>Technical Benchmarks</th>
                    </tr>
                    <tr style={{ background: 'rgba(30, 41, 59, 0.1)', textAlign: 'center', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: `1px solid ${COLORS.border}` }}>
                        <th colSpan="4"></th>
                        <th style={{ padding: '6px', borderLeft: `1px solid ${COLORS.border}` }}>1 Day</th>
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
                            <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: '#f8fafc', fontSize: '12px' }}>{typeof row.close === 'number' ? row.close.toLocaleString(undefined, { minimumFractionDigits: 2 }) : row.close}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', color: '#94a3b8' }}>{row.turnover ? `$${row.turnover.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'N/A'}</td>

                            <td style={{ padding: '8px 16px', textAlign: 'right', borderLeft: `1px solid ${COLORS.border}` }}>
                                {getValueWithIcon(row.d1, true)}
                            </td>
                            <td style={{ padding: '8px 16px', textAlign: 'right' }}>
                                {getValueWithIcon(row.ytd, true)}
                            </td>

                            <td style={{ padding: '8px 16px', textAlign: 'right', borderLeft: `1px solid ${COLORS.border}`, color: '#cbd5e1', fontWeight: 600 }}>{row.pe}x</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', color: '#cbd5e1', fontWeight: 600 }}>{row.pb}x</td>

                            <td style={{ padding: '8px 16px', textAlign: 'right', borderLeft: `1px solid ${COLORS.border}`, color: '#f1f5f9' }}>{row.resistance.toLocaleString()}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', color: '#f1f5f9' }}>{row.support.toLocaleString()}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: row.rsi > 70 ? COLORS.red : (row.rsi < 30 ? COLORS.green : '#cbd5e1') }}>{row.rsi}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', color: '#94a3b8' }}>{row.ma20.toLocaleString()}</td>
                            <td style={{ padding: '8px 16px', textAlign: 'right', color: String(row.macd).startsWith('+') ? COLORS.green : COLORS.red, fontWeight: 600 }}>{row.macd}</td>
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
