'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

// Exact Colors from dl-equity.com scrape
const COLORS = {
    teal: '#027368',
    blue: '#2563EB',
    purple: '#7C3AED',
    gold: '#C2850C',
    red: '#DC2626',
    gray: '#555555'
};

const BANK_COLORS = {
    'VPB': '#008466',
    'TCB': '#2962FF',
    'MBB': '#7B1FA2',
    'BID': '#D4A82F',
    'VCB': '#00B8D4',
    'CTG': '#C62828',
    'ACB': '#1565C0',
    'HDB': '#E65100',
    'VIB': '#F9A825',
    'MSB': '#EF6C00',
    'STB': '#2E7D32',
    'LPB': '#D32F2F',
    'TPB': '#7B1FA2',
    'SHB': '#F57C00',
    'EIB': '#1976D2',
    'OCB': '#388E3C',
    'SSB': '#C2185B',
    'ABB': '#0097A7'
};

const ALL_BANKS = ['VPB', 'TCB', 'MBB', 'BID', 'VCB', 'CTG', 'ACB', 'HDB', 'VIB', 'MSB', 'STB'];

const dtFormatter = (v) => v ? v.substring(5).replace('-', '/') : '';

export default function EconomicsTab({ data, timeFilter }) {
    const [dataSource, setDataSource] = useState('Quote');
    const [depositTenor, setDepositTenor] = useState('12M');
    const [selectedBanks, setSelectedBanks] = useState(['VPB', 'TCB', 'MBB', 'BID']);
    const [quoteData, setQuoteData] = useState([]);
    const [loadingQuote, setLoadingQuote] = useState(false);

    useEffect(() => {
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
    }, []);

    const toggleBank = (bank) => {
        setSelectedBanks(prev =>
            prev.includes(bank) ? prev.filter(b => b !== bank) : [...prev, bank]
        );
    };

    if (!data) return <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>No economics data available.</div>;

    // Filter by general time window
    const getFilteredData = (arr) => {
        if (!arr || !arr.length) return [];
        let days = 3650; // max default
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
    };

    // 1. BANK DEPOSIT RATES: Unified Trend Data
    const depositChartData = useMemo(() => {
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
    }, [dataSource, quoteData, data.deposit, depositTenor, selectedBanks, timeFilter]);

    // 2. STATE TREASURY & OMO: Group by Date
    const treasuryChartData = useMemo(() => {
        const raw = getFilteredData(data.treasury);
        const grouped = {};
        raw.forEach(d => {
            if (!grouped[d.date]) grouped[d.date] = { date: d.date };
            // Map keys
            let key = 'State Treasury';
            if (d.instrument.toLowerCase().includes('omo')) key = 'OMO';
            if (d.instrument.toLowerCase().includes('citad')) key = 'CITAD';
            grouped[d.date][key] = d.rate;
        });
        return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [data.treasury, timeFilter]);

    // 3. INTERBANK RATES: Group by Date
    const interbankChartData = useMemo(() => {
        const raw = getFilteredData(data.interbank);
        const grouped = {};
        raw.forEach(d => {
            if (!grouped[d.date]) grouped[d.date] = { date: d.date };
            let key = d.tenor;
            if (d.tenor === 'overnight') key = 'O/N';
            if (d.tenor === '1_week') key = '1W';
            if (d.tenor === '1_month') key = '1M';
            if (d.tenor === '1_year') key = '1Y';
            grouped[d.date][key] = d.rate;
        });
        return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [data.interbank, timeFilter]);

    // Reusable Custom Tooltip styling
    const customTooltipStyle = {
        backgroundColor: 'rgba(17, 17, 17, 0.95)',
        border: '1px solid #333',
        borderRadius: '8px',
        color: '#fff',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem' }}>

            {/* CARD 1: Bank Deposit Rates */}
            <div className="card" style={{ padding: '1.5rem', height: 'auto', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Bank Deposit Rates</h3>
                </div>

                {/* Toggles Row 1: Source & Tenor */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {['Retail', 'Institution', 'Quote'].map(s => (
                            <button
                                key={s}
                                onClick={() => setDataSource(s)}
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: '16px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    background: dataSource === s ? COLORS.teal : 'transparent',
                                    color: dataSource === s ? '#fff' : '#888',
                                    border: `1px solid ${dataSource === s ? COLORS.teal : '#333'}`,
                                    transition: 'all 0.2s ease'
                                }}>
                                {s}
                            </button>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {['1M', '3M', '6M', '12M'].map(t => (
                            <button
                                key={t}
                                onClick={() => setDepositTenor(t)}
                                style={{
                                    padding: '4px 12px',
                                    borderRadius: '16px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    background: depositTenor === t ? COLORS.teal : 'transparent',
                                    color: depositTenor === t ? '#fff' : '#888',
                                    border: `1px solid ${depositTenor === t ? COLORS.teal : '#333'}`,
                                    transition: 'all 0.2s ease'
                                }}>
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Toggles Row 2: Banks */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {ALL_BANKS.map(bank => {
                        const isActive = selectedBanks.includes(bank);
                        const bankColor = BANK_COLORS[bank] || COLORS.blue;
                        return (
                            <button
                                key={bank}
                                onClick={() => toggleBank(bank)}
                                style={{
                                    padding: '4px 10px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    background: isActive ? bankColor : '#222',
                                    color: isActive ? '#fff' : '#888',
                                    border: 'none',
                                    transition: 'background 0.2s ease'
                                }}>
                                {bank}
                            </button>
                        );
                    })}
                </div>

                <div style={{ flex: 1, minHeight: '300px' }}>
                    {loadingQuote && dataSource === 'Quote' ? (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '13px' }}>
                            Loading quotes...
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={depositChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                                <XAxis dataKey="date" stroke="#888" fontSize={11} tickFormatter={dtFormatter} tickMargin={10} axisLine={false} tickLine={false} />
                                <YAxis stroke="#888" fontSize={11} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={customTooltipStyle} itemStyle={{ fontSize: '12px' }} />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
                                {selectedBanks.map(bank => (
                                    <Line
                                        key={bank}
                                        type="monotone"
                                        dataKey={bank}
                                        stroke={BANK_COLORS[bank] || COLORS.blue}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                        connectNulls
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>


            {/* CARD 2: State Treasury, OMO & CITAD */}
            <div className="card" style={{ padding: '1.5rem', height: '400px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>State Treasury, OMO & CITAD</h3>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={treasuryChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                            <XAxis dataKey="date" stroke="#888" fontSize={11} tickFormatter={dtFormatter} tickMargin={10} axisLine={false} tickLine={false} />
                            <YAxis stroke="#888" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={customTooltipStyle} itemStyle={{ fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
                            {/* State Treasury uses an Area, OMO/CITAD use pure lines (Area with no fill) */}
                            <Area type="monotone" dataKey="State Treasury" stroke={COLORS.teal} fill={`${COLORS.teal}22`} strokeWidth={2} activeDot={{ r: 4 }} connectNulls />
                            <Area type="monotone" dataKey="OMO" stroke={COLORS.gold} fill="transparent" strokeWidth={2} activeDot={{ r: 4 }} connectNulls />
                            <Area type="monotone" dataKey="CITAD" stroke={COLORS.blue} fill="transparent" strokeWidth={2} activeDot={{ r: 4 }} connectNulls />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* CARD 3: Interbank Rates */}
            <div className="card" style={{ padding: '1.5rem', height: '400px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Interbank Rates</h3>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={interbankChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                            <XAxis dataKey="date" stroke="#888" fontSize={11} tickFormatter={dtFormatter} tickMargin={10} axisLine={false} tickLine={false} />
                            <YAxis stroke="#888" fontSize={11} tickFormatter={v => `${Number(v).toFixed(1)}%`} domain={['auto', 'auto']} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={customTooltipStyle} itemStyle={{ fontSize: '12px' }} />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
                            <Line type="monotone" dataKey="O/N" stroke={COLORS.red} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                            <Line type="monotone" dataKey="1W" stroke={COLORS.teal} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                            <Line type="monotone" dataKey="1M" stroke={COLORS.blue} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                            <Line type="monotone" dataKey="1Y" stroke={COLORS.purple} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* CARD 4: TradingView Economic Calendar */}
            <div className="card" style={{ padding: '0', height: '400px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div id="tradingview-economic-calendar" style={{ width: '100%', height: '100%' }}>
                    {/* The TradingView script will be injected here via a client component or effect, 
                        but Next.js App Router (Server Components by default) often requires a dedicated wrapper component for external scripts.
                        Since this is already 'use client', we can use useEffect. */}
                    <TradingViewCalendarWidget />
                </div>
            </div>

            {/* CARD 5: Global Equities Mini Chart (Like the SPX500 user screenshot) */}
            <div className="card" style={{ padding: '0', height: '400px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div id="tradingview-mini-chart" style={{ width: '100%', height: '100%' }}>
                    <TradingViewMiniChartWidget />
                </div>
            </div>

        </div>
    );
}

// Sub-components to handle external script injection safely in React without hydration errors

function TradingViewCalendarWidget() {
    const containerRef = useRef(null);

    useEffect(() => {
        if (containerRef.current && !containerRef.current.querySelector('script')) {
            const script = document.createElement('script');
            script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
            script.type = "text/javascript";
            script.async = true;
            script.innerHTML = JSON.stringify({
                "width": "100%",
                "height": "100%",
                "colorTheme": "dark",
                "isTransparent": true,
                "locale": "en",
                "importanceFilter": "-1,0,1",
                "currencyFilter": "USD,VND"
            });
            containerRef.current.appendChild(script);
        }
    }, []);

    return (
        <div className="tradingview-widget-container" ref={containerRef} style={{ height: '100%', width: '100%' }}>
            <div className="tradingview-widget-container__widget" style={{ height: 'calc(100% - 32px)', width: '100%' }}></div>
        </div>
    );
}

function TradingViewMiniChartWidget() {
    const containerRef = useRef(null);

    useEffect(() => {
        if (containerRef.current && !containerRef.current.querySelector('script')) {
            const script = document.createElement('script');
            script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
            script.type = "text/javascript";
            script.async = true;
            script.innerHTML = JSON.stringify({
                "symbol": "SP:SPX",
                "width": "100%",
                "height": "100%",
                "locale": "en",
                "dateRange": "12M",
                "colorTheme": "dark",
                "isTransparent": true,
                "autosize": true,
                "largeChartUrl": ""
            });
            containerRef.current.appendChild(script);
        }
    }, []);

    return (
        <div className="tradingview-widget-container" ref={containerRef} style={{ height: '100%', width: '100%' }}>
            <div className="tradingview-widget-container__widget" style={{ height: 'calc(100% - 32px)', width: '100%' }}></div>
        </div>
    );
}
