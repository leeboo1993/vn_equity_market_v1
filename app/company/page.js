'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = {
    teal: '#00a884', blue: '#3b82f6', yellow: '#f59e0b',
    red: '#e55353', green: '#10b981', purple: '#a855f7',
    card: '#111111', border: '#222222', text: '#888888',
    white: '#ffffff', bg: '#0a0a0a'
};

// Key line items by English keyword matching — maps to a display group
const IS_KEYWORDS = ['revenue', 'net revenue', 'gross profit', 'operating profit', 'ebit', 'ebitda',
    'profit before tax', 'net profit', 'profit after tax', 'minority interest', 'interest income',
    'net interest income', 'non-interest income', 'operating expense', 'provision'];
const BS_KEYWORDS = ['total asset', 'total liabilit', 'equity', 'cash', 'short-term', 'long-term',
    'receivable', 'inventory', 'fixed asset', 'loan', 'deposit', 'investment', 'charter capital'];
const CF_KEYWORDS = ['operating activit', 'investing activit', 'financing activit', 'free cash', 'capex',
    'dividend', 'net cash', 'depreciation'];

function matchesGroup(nameEn, keywords) {
    const lower = (nameEn || '').toLowerCase();
    return keywords.some(kw => lower.includes(kw));
}

function classifyItems(items) {
    const is = [], bs = [], cf = [], other = [];
    for (const item of items) {
        const en = (item.nameEn || '').toLowerCase();
        if (CF_KEYWORDS.some(kw => en.includes(kw))) cf.push(item);
        else if (BS_KEYWORDS.some(kw => en.includes(kw))) bs.push(item);
        else if (IS_KEYWORDS.some(kw => en.includes(kw))) is.push(item);
        else is.push(item); // default to IS
    }
    return { IS: is, BS: bs, CF: cf };
}

// ─── Format helpers ────────────────────────────────────────────────────────────
const fmtBn = (v) => {
    if (v == null || isNaN(v)) return '—';
    const bn = v / 1000; // values in millions → billions
    if (Math.abs(bn) >= 1000) return `${(bn / 1000).toFixed(1)}T`;
    if (Math.abs(bn) >= 1) return `${bn.toFixed(1)}B`;
    return `${v.toFixed(0)}M`;
};

const fmtColor = (v) => {
    if (v == null || isNaN(v)) return COLORS.text;
    return v >= 0 ? COLORS.teal : COLORS.red;
};

// ─── Sub-components ────────────────────────────────────────────────────────────
function FinancialTable({ periods, data, stmtType }) {
    // periods: sorted array of period labels (latest first)
    // data: { [period]: [{code, name, nameEn, value}] }

    if (!periods.length) return <div style={{ color: COLORS.text, fontSize: '13px', padding: '2rem' }}>No data available.</div>;

    // Build unique row list from first period's items
    const firstItems = data[periods[0]] || [];
    const classified = classifyItems(firstItems);
    const rows = classified[stmtType] || classified.IS || [];

    if (!rows.length) return <div style={{ color: COLORS.text, fontSize: '13px', padding: '2rem' }}>No {stmtType} items found.</div>;

    // Show latest 8 periods
    const displayPeriods = periods.slice(0, 8);

    // Build lookup: period → code → value
    const lookup = {};
    for (const p of displayPeriods) {
        lookup[p] = {};
        for (const item of (data[p] || [])) {
            lookup[p][item.code] = item.value;
        }
    }

    return (
        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                    <tr>
                        <th style={{
                            textAlign: 'left', padding: '10px 12px', color: COLORS.text,
                            borderBottom: `1px solid ${COLORS.border}`, fontWeight: 500,
                            position: 'sticky', left: 0, background: COLORS.card, minWidth: '220px'
                        }}>
                            Item (Billion VND)
                        </th>
                        {displayPeriods.map(p => (
                            <th key={p} style={{
                                textAlign: 'right', padding: '10px 12px', color: COLORS.white,
                                borderBottom: `1px solid ${COLORS.border}`, fontWeight: 600,
                                whiteSpace: 'nowrap', minWidth: '90px'
                            }}>{p}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((item, i) => {
                        const vals = displayPeriods.map(p => lookup[p][item.code]);
                        return (
                            <tr key={item.code} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                                <td style={{
                                    padding: '8px 12px', color: COLORS.text,
                                    borderBottom: `1px solid ${COLORS.border}`,
                                    position: 'sticky', left: 0, background: i % 2 === 0 ? COLORS.card : '#131313',
                                    maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                }} title={item.nameEn || item.name}>
                                    {item.name || item.nameEn}
                                </td>
                                {vals.map((v, j) => (
                                    <td key={j} style={{
                                        padding: '8px 12px', textAlign: 'right',
                                        color: fmtColor(v),
                                        borderBottom: `1px solid ${COLORS.border}`,
                                        fontVariantNumeric: 'tabular-nums'
                                    }}>
                                        {fmtBn(v)}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function TrendChart({ periods, data, stmtType }) {
    // Pick top 5 revenue-like items and chart them
    const displayPeriods = [...periods].reverse().slice(-8); // oldest to newest
    const firstItems = data[periods[0]] || [];
    const classified = classifyItems(firstItems);
    const rows = (classified[stmtType] || []).slice(0, 5);

    if (!rows.length) return null;

    const chartData = displayPeriods.map(p => {
        const obj = { period: p };
        for (const row of rows) {
            const match = (data[p] || []).find(x => x.code === row.code);
            obj[row.name] = match ? Math.round(match.value / 1000) : null; // billions
        }
        return obj;
    });

    const lineColors = [COLORS.teal, COLORS.blue, COLORS.yellow, COLORS.purple, COLORS.green];

    return (
        <div style={{ height: '220px', marginTop: '1rem' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid stroke="#222" vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="period" stroke={COLORS.text} fontSize={10} minTickGap={20} />
                    <YAxis stroke={COLORS.text} fontSize={10} tickFormatter={v => `${v.toLocaleString()}B`}
                        domain={[d => Math.floor(d * 0.9), d => Math.ceil(d * 1.1)]} width={55} />
                    <Tooltip
                        contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontSize: '11px' }}
                        formatter={v => v != null ? [`${v.toLocaleString()}B VND`, ''] : ['—', '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }} />
                    {rows.map((row, i) => (
                        <Line key={row.code} type="monotone" dataKey={row.name}
                            stroke={lineColors[i % lineColors.length]} dot={false}
                            strokeWidth={2} connectNulls />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CompanyPage() {
    const { status } = useSession();
    const router = useRouter();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [tickerInput, setTickerInput] = useState('');
    const [ticker, setTicker] = useState('');
    const [financials, setFinancials] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [view, setView] = useState('Quarterly'); // 'Annual' | 'Quarterly'
    const [stmtTab, setStmtTab] = useState('IS'); // 'IS' | 'BS' | 'CF'

    if (status === 'unauthenticated') {
        router.push('/login');
        return null;
    }

    const handleSearch = useCallback(async (t) => {
        const tk = (t || tickerInput).trim().toUpperCase();
        if (!tk) return;
        setTicker(tk);
        setLoading(true);
        setError('');
        setFinancials(null);
        try {
            const res = await fetch(`/api/financials?ticker=${tk}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load data');
            setFinancials(json);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [tickerInput]);

    const periods = useMemo(() => {
        if (!financials) return [];
        const src = view === 'Annual' ? financials.annual : financials.quarterly;
        return Object.keys(src).sort((a, b) => {
            // Sort: FY2024 > FY2023, Q4/2024 > Q3/2024 etc.
            const parseKey = k => {
                if (k.startsWith('FY')) return parseInt(k.slice(2)) * 10 + 5;
                const [q, y] = k.slice(1).split('/');
                return parseInt(y) * 10 + parseInt(q);
            };
            return parseKey(b) - parseKey(a);
        });
    }, [financials, view]);

    const data = useMemo(() => {
        if (!financials) return {};
        return view === 'Annual' ? financials.annual : financials.quarterly;
    }, [financials, view]);

    const stmtLabels = { IS: 'Income Statement', BS: 'Balance Sheet', CF: 'Cash Flow' };
    const viewBtnStyle = (v) => ({
        background: view === v ? COLORS.teal : 'transparent',
        color: view === v ? '#fff' : '#aaa',
        border: `1px solid ${view === v ? COLORS.teal : '#333'}`,
        padding: '6px 18px', borderRadius: '20px',
        fontSize: '12px', fontWeight: view === v ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.2s'
    });
    const tabStyle = (t) => ({
        padding: '8px 20px',
        borderBottom: stmtTab === t ? `2px solid ${COLORS.teal}` : '2px solid transparent',
        color: stmtTab === t ? COLORS.teal : COLORS.text,
        fontWeight: stmtTab === t ? 600 : 400,
        fontSize: '13px', cursor: 'pointer', background: 'transparent',
        border: 'none', transition: 'all 0.2s'
    });

    // Popular tickers quick-access
    const hotTickers = ['VCB', 'VPB', 'TCB', 'MBB', 'BID', 'HPG', 'VHM', 'FPT', 'VNM', 'MSN'];

    return (
        <>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <header className="header-bar" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button onClick={() => setSidebarOpen(true)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>
                        ☰
                    </button>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Company Financials</span>
                </div>
            </header>

            <main style={{ background: COLORS.bg, minHeight: '100vh', padding: '80px 1.5rem 2rem' }}>
                <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Search Box */}
                    <div className="card" style={{ padding: '1.5rem', background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                        <h2 style={{ margin: '0 0 1rem', fontSize: '15px', color: COLORS.white, fontWeight: 600 }}>Search Company</h2>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <input
                                value={tickerInput}
                                onChange={e => setTickerInput(e.target.value.toUpperCase())}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                                placeholder="Enter ticker (e.g. VCB)"
                                style={{
                                    background: '#1a1a1a', border: `1px solid ${COLORS.border}`,
                                    color: COLORS.white, borderRadius: '8px', padding: '10px 16px',
                                    fontSize: '14px', width: '200px', colorScheme: 'dark',
                                    outline: 'none'
                                }}
                            />
                            <button onClick={() => handleSearch()}
                                style={{
                                    background: COLORS.teal, color: '#fff', border: 'none',
                                    borderRadius: '8px', padding: '10px 24px',
                                    fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                                }}>
                                Search
                            </button>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {hotTickers.map(t => (
                                    <button key={t} onClick={() => { setTickerInput(t); handleSearch(t); }}
                                        style={{
                                            background: ticker === t ? '#1a2e27' : '#1a1a1a',
                                            border: `1px solid ${ticker === t ? COLORS.teal : '#333'}`,
                                            color: ticker === t ? COLORS.teal : COLORS.text,
                                            borderRadius: '6px', padding: '6px 12px',
                                            fontSize: '12px', cursor: 'pointer'
                                        }}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{ background: '#1a0a0a', border: `1px solid ${COLORS.red}`, borderRadius: '8px', padding: '1rem', color: COLORS.red, fontSize: '13px' }}>
                            ⚠ {error}
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div style={{ color: COLORS.text, fontSize: '14px', padding: '2rem', textAlign: 'center' }}>
                            Loading financials for {ticker}...
                        </div>
                    )}

                    {/* Financials */}
                    {financials && !loading && (
                        <>
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                <div>
                                    <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: COLORS.white }}>{financials.ticker}</h1>
                                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: COLORS.text }}>
                                        Last updated: {financials.lastUpdated ? new Date(financials.lastUpdated).toLocaleDateString('en-GB') : '—'}
                                        {' · '}Values in Billion VND
                                    </p>
                                </div>
                                {/* Annual / Quarterly toggle */}
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button style={viewBtnStyle('Quarterly')} onClick={() => setView('Quarterly')}>Quarterly</button>
                                    <button style={viewBtnStyle('Annual')} onClick={() => setView('Annual')}>Annual</button>
                                </div>
                            </div>

                            {/* Trend Chart */}
                            <div className="card" style={{ padding: '1.5rem', background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '14px', color: COLORS.white }}>Key Trends — {stmtLabels[stmtTab]}</h3>
                                        <p style={{ margin: '4px 0 0', fontSize: '11px', color: COLORS.text }}>Top line items over time (Billion VND)</p>
                                    </div>
                                </div>
                                <TrendChart periods={periods} data={data} stmtType={stmtTab} />
                            </div>

                            {/* Statement Tabs + Table */}
                            <div className="card" style={{ padding: 0, background: COLORS.card, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', borderBottom: `1px solid ${COLORS.border}`, padding: '0 1rem' }}>
                                    {Object.entries(stmtLabels).map(([key, label]) => (
                                        <button key={key} style={tabStyle(key)} onClick={() => setStmtTab(key)}>
                                            {label}
                                        </button>
                                    ))}
                                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', fontSize: '11px', color: COLORS.text }}>
                                        {periods.length} periods · {view}
                                    </div>
                                </div>
                                <div style={{ padding: '0 0 1rem' }}>
                                    <FinancialTable periods={periods} data={data} stmtType={stmtTab} />
                                </div>
                            </div>
                        </>
                    )}

                    {/* Empty state */}
                    {!financials && !loading && !error && (
                        <div style={{ textAlign: 'center', padding: '4rem 0', color: COLORS.text }}>
                            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>📊</div>
                            <div style={{ fontSize: '15px', fontWeight: 500, color: COLORS.white }}>Search for a company</div>
                            <div style={{ fontSize: '13px', marginTop: '6px' }}>Enter a ticker symbol above to view financial statements</div>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
