'use client';

import { useState, useMemo, useCallback } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
    teal: '#00a884', blue: '#3b82f6', yellow: '#f59e0b',
    red: '#e55353', green: '#10b981', purple: '#a855f7',
    card: '#111111', border: '#222222', text: '#888888', white: '#ffffff'
};

// ─── Financial helpers ────────────────────────────────────────────────────────
const IS_KW = ['revenue', 'net revenue', 'gross profit', 'operating profit', 'ebit',
    'profit before tax', 'net profit', 'profit after tax', 'interest income',
    'net interest income', 'non-interest income', 'operating expense', 'provision'];
const BS_KW = ['total asset', 'total liabilit', 'equity', 'cash', 'receivable',
    'inventory', 'fixed asset', 'loan', 'deposit', 'charter capital'];
const CF_KW = ['operating activit', 'investing activit', 'financing activit',
    'free cash', 'capex', 'dividend', 'net cash', 'depreciation'];

function classifyItems(items) {
    const is = [], bs = [], cf = [];
    for (const item of items) {
        const en = (item.nameEn || item.name || '').toLowerCase();
        if (CF_KW.some(kw => en.includes(kw))) cf.push(item);
        else if (BS_KW.some(kw => en.includes(kw))) bs.push(item);
        else is.push(item);
    }
    return { IS: is, BS: bs, CF: cf };
}

const fmtBn = (v) => {
    if (v == null || isNaN(v)) return '—';
    const bn = v / 1000;
    if (Math.abs(bn) >= 1000) return `${(bn / 1000).toFixed(1)}T`;
    if (Math.abs(bn) >= 1) return `${bn.toFixed(1)}B`;
    return `${v.toFixed(0)}M`;
};

// ─── Trend mini-chart ─────────────────────────────────────────────────────────
function TrendChart({ periods, data, stmtType }) {
    const displayPeriods = [...periods].reverse().slice(-8);
    const firstItems = data[periods[0]] || [];
    const rows = classifyItems(firstItems)[stmtType].slice(0, 4);
    if (!rows.length) return null;

    const chartData = displayPeriods.map(p => {
        const obj = { period: p };
        for (const row of rows) {
            const match = (data[p] || []).find(x => x.code === row.code);
            obj[row.name] = match ? Math.round(match.value / 1000) : null;
        }
        return obj;
    });

    const lineColors = [C.teal, C.blue, C.yellow, C.purple];

    return (
        <div style={{ height: '200px', marginTop: '1rem' }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid stroke="#222" vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="period" stroke={C.text} fontSize={10} minTickGap={20} />
                    <YAxis stroke={C.text} fontSize={10} tickFormatter={v => `${v.toLocaleString()}B`}
                        domain={[d => Math.floor(d * 0.9), d => Math.ceil(d * 1.1)]} width={55} />
                    <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, fontSize: '11px' }}
                        formatter={v => v != null ? [`${v.toLocaleString()}B VND`, ''] : ['—', '']} />
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

// ─── Financial Table ──────────────────────────────────────────────────────────
function FinancialTable({ periods, data, stmtType }) {
    if (!periods.length) return <div style={{ color: C.text, fontSize: '13px', padding: '2rem' }}>No data.</div>;

    const firstItems = data[periods[0]] || [];
    const rows = classifyItems(firstItems)[stmtType];
    if (!rows.length) return <div style={{ color: C.text, fontSize: '13px', padding: '2rem' }}>No {stmtType} items found.</div>;

    const displayPeriods = periods.slice(0, 8);
    const lookup = {};
    for (const p of displayPeriods) {
        lookup[p] = {};
        for (const item of (data[p] || [])) lookup[p][item.code] = item.value;
    }

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left', padding: '10px 12px', color: C.text, borderBottom: `1px solid ${C.border}`, fontWeight: 500, position: 'sticky', left: 0, background: C.card, minWidth: '200px' }}>
                            Item (Billion VND)
                        </th>
                        {displayPeriods.map(p => (
                            <th key={p} style={{ textAlign: 'right', padding: '10px 12px', color: C.white, borderBottom: `1px solid ${C.border}`, fontWeight: 600, whiteSpace: 'nowrap', minWidth: '85px' }}>{p}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((item, i) => {
                        const vals = displayPeriods.map(p => lookup[p][item.code]);
                        return (
                            <tr key={item.code} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                                <td style={{ padding: '8px 12px', color: C.text, borderBottom: `1px solid ${C.border}`, position: 'sticky', left: 0, background: i % 2 === 0 ? C.card : '#131313', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.nameEn || item.name}>
                                    {item.name || item.nameEn}
                                </td>
                                {vals.map((v, j) => (
                                    <td key={j} style={{ padding: '8px 12px', textAlign: 'right', color: v != null && v < 0 ? C.red : C.teal, borderBottom: `1px solid ${C.border}`, fontVariantNumeric: 'tabular-nums' }}>
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

// ─── Company Financials panel ─────────────────────────────────────────────────
const HOT_TICKERS = ['VCB', 'VPB', 'TCB', 'MBB', 'BID', 'HPG', 'VHM', 'FPT', 'VNM', 'MSN'];
const STMT_LABELS = { IS: 'Income Statement', BS: 'Balance Sheet', CF: 'Cash Flow' };

function CompanyFinancials() {
    const [tickerInput, setTickerInput] = useState('');
    const [ticker, setTicker] = useState('');
    const [financials, setFinancials] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [view, setView] = useState('Quarterly');
    const [stmtTab, setStmtTab] = useState('IS');

    const doSearch = useCallback(async (t) => {
        const tk = (t || tickerInput).trim().toUpperCase();
        if (!tk) return;
        setTicker(tk);
        setLoading(true);
        setError('');
        setFinancials(null);
        try {
            const res = await fetch(`/api/financials?ticker=${tk}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Failed to load');
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
            const pk = k => k.startsWith('FY') ? parseInt(k.slice(2)) * 10 + 5 : parseInt(k.slice(-4)) * 10 + parseInt(k[1]);
            return pk(b) - pk(a);
        });
    }, [financials, view]);

    const data = useMemo(() => financials ? (view === 'Annual' ? financials.annual : financials.quarterly) : {}, [financials, view]);

    const btnStyle = (v, active) => ({
        background: active ? C.teal : 'transparent',
        color: active ? '#fff' : C.text,
        border: `1px solid ${active ? C.teal : '#333'}`,
        padding: '5px 14px', borderRadius: '20px', fontSize: '11px',
        fontWeight: active ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s'
    });
    const tabStyle = (t) => ({
        padding: '8px 18px',
        borderBottom: stmtTab === t ? `2px solid ${C.teal}` : '2px solid transparent',
        color: stmtTab === t ? C.teal : C.text,
        fontWeight: stmtTab === t ? 600 : 400,
        fontSize: '12px', cursor: 'pointer', background: 'transparent', border: 'none'
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Search */}
            <div className="card" style={{ padding: '1.25rem', background: C.card, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input
                        value={tickerInput}
                        onChange={e => setTickerInput(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && doSearch()}
                        placeholder="Ticker (e.g. VCB)"
                        style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, color: C.white, borderRadius: '7px', padding: '8px 14px', fontSize: '13px', width: '160px', colorScheme: 'dark', outline: 'none' }}
                    />
                    <button onClick={() => doSearch()} style={{ background: C.teal, color: '#fff', border: 'none', borderRadius: '7px', padding: '8px 20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        Search
                    </button>
                    {HOT_TICKERS.map(t => (
                        <button key={t} onClick={() => { setTickerInput(t); doSearch(t); }}
                            style={{ background: ticker === t ? '#1a2e27' : '#1a1a1a', border: `1px solid ${ticker === t ? C.teal : '#333'}`, color: ticker === t ? C.teal : C.text, borderRadius: '6px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer' }}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div style={{ background: '#1a0a0a', border: `1px solid ${C.red}`, borderRadius: '8px', padding: '0.875rem 1rem', color: C.red, fontSize: '12px' }}>⚠ {error}</div>}
            {loading && <div style={{ color: C.text, fontSize: '13px', padding: '2rem', textAlign: 'center' }}>Loading financials for {ticker}...</div>}

            {financials && !loading && (
                <>
                    {/* Ticker header + toggle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: C.white }}>{financials.ticker}</h2>
                            <p style={{ margin: '3px 0 0', fontSize: '11px', color: C.text }}>
                                Updated: {financials.lastUpdated ? new Date(financials.lastUpdated).toLocaleDateString('en-GB') : '—'} · Billion VND
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button style={btnStyle('Quarterly', view === 'Quarterly')} onClick={() => setView('Quarterly')}>Quarterly</button>
                            <button style={btnStyle('Annual', view === 'Annual')} onClick={() => setView('Annual')}>Annual</button>
                        </div>
                    </div>

                    {/* Trend chart */}
                    <div className="card" style={{ padding: '1.25rem', background: C.card, border: `1px solid ${C.border}` }}>
                        <h3 style={{ margin: 0, fontSize: '13px', color: C.white }}>Key Trends — {STMT_LABELS[stmtTab]}</h3>
                        <p style={{ margin: '3px 0 0', fontSize: '11px', color: C.text }}>Top line items over time (Billion VND)</p>
                        <TrendChart periods={periods} data={data} stmtType={stmtTab} />
                    </div>

                    {/* Statement tabs */}
                    <div className="card" style={{ padding: 0, background: C.card, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 1rem', alignItems: 'center' }}>
                            {Object.entries(STMT_LABELS).map(([key, label]) => (
                                <button key={key} style={tabStyle(key)} onClick={() => setStmtTab(key)}>{label}</button>
                            ))}
                            <span style={{ marginLeft: 'auto', fontSize: '11px', color: C.text }}>{periods.length} periods · {view}</span>
                        </div>
                        <FinancialTable periods={periods} data={data} stmtType={stmtTab} />
                    </div>
                </>
            )}

            {!financials && !loading && !error && (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: C.text }}>
                    <div style={{ fontSize: '40px', marginBottom: '0.75rem' }}>📊</div>
                    <div style={{ fontSize: '14px', color: C.white }}>Search for a company above</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Financial statements sourced from VNDirect</div>
                </div>
            )}
        </div>
    );
}

// ─── Main FundamentalsTab ─────────────────────────────────────────────────────
export default function FundamentalsTab({ data }) {
    const [subTab, setSubTab] = useState('Sector');

    const { sector_overview = [] } = data || {};

    const subTabs = ['Sector', 'Company'];
    const tabStyle = (t) => ({
        padding: '7px 18px',
        background: subTab === t ? '#1a2e27' : 'transparent',
        color: subTab === t ? C.teal : C.text,
        border: `1px solid ${subTab === t ? C.teal : '#2a2a2a'}`,
        borderRadius: '20px', fontSize: '12px',
        fontWeight: subTab === t ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.2s'
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Sub-tab pills */}
            <div style={{ display: 'flex', gap: '8px' }}>
                {subTabs.map(t => <button key={t} style={tabStyle(t)} onClick={() => setSubTab(t)}>{t}</button>)}
            </div>

            {/* Sector Overview */}
            {subTab === 'Sector' && (
                <div className="card" style={{ padding: '1.25rem', background: C.card, border: `1px solid ${C.border}` }}>
                    <h3 style={{ margin: '0 0 1rem', fontSize: '14px', color: C.white }}>Sector Overview</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.text, textAlign: 'left' }}>
                                    <th style={{ padding: '10px 8px', fontWeight: 500 }}>Sector</th>
                                    <th style={{ padding: '10px 8px', fontWeight: 500, textAlign: 'right' }}>Tickers</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sector_overview.map((row, idx) => (
                                    <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                                        <td style={{ padding: '10px 8px', color: '#eee' }}>{row.sector}</td>
                                        <td style={{ padding: '10px 8px', textAlign: 'right', color: C.teal, fontWeight: 600 }}>{row.ticker_count}</td>
                                    </tr>
                                ))}
                                {!sector_overview.length && (
                                    <tr><td colSpan={2} style={{ padding: '20px', textAlign: 'center', color: C.text }}>No sector data</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Company Financials */}
            {subTab === 'Company' && <CompanyFinancials />}
        </div>
    );
}
