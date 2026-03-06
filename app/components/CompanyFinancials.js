'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useSession } from 'next-auth/react';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
    teal: '#00a884', blue: '#3b82f6', yellow: '#f59e0b',
    red: '#e55353', green: '#10b981', purple: '#a855f7',
    card: '#111111', border: '#222222', text: '#888888', white: '#ffffff'
};

// ─── Financial helpers ────────────────────────────────────────────────────────
const IS_KW = ['net revenue', 'gross profit', 'net interest income', 'operating profit', 'profit before tax', 'profit after tax', 'net profit'];
const BS_KW = ['total asset', 'total liabilit', 'equity', 'cash', 'inventory', 'receivable', 'charter capital'];
const CF_KW = ['operating activit', 'investing activit', 'financing activit', 'net cash'];

function classifyItems(items) {
    const is = [], bs = [], cf = [];
    for (const item of items) {
        const en = (item.nameEn || item.name || '').toLowerCase();
        const vn = (item.name || '').toLowerCase();
        // Capitalize for display
        item.displayName = item.nameEn ? item.nameEn.charAt(0).toUpperCase() + item.nameEn.slice(1) : item.name;

        if (item.stmtType === 'IS') {
            is.push(item);
        } else if (item.stmtType === 'BS') {
            bs.push(item);
        } else if (item.stmtType === 'CF') {
            cf.push(item);
        } else {
            // Fallback for older JSONs or missing stmtType
            if (CF_KW.some(kw => en.includes(kw) || vn.includes(kw))) cf.push(item);
            else if (BS_KW.some(kw => en.includes(kw) || vn.includes(kw))) bs.push(item);
            else is.push(item); // Default to Income Statement if unknown
        }
    }
    return { IS: is, BS: bs, CF: cf, Ratio: [] };
}

const fmtVND = (v, unit) => {
    if (v == null || isNaN(v)) return '—';
    let num = v;
    if (unit === 'T') num = v / 1_000_000_000_000;
    else if (unit === 'M') num = v / 1_000_000;
    else if (unit === 'raw') num = v;
    else num = v / 1_000_000_000; // default to Billions

    return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
};

// ─── Trend mini-chart ─────────────────────────────────────────────────────────
function TrendChart({ periods, data, stmtType, fromPeriod, toPeriod }) {
    const sortedPeriods = [...periods].reverse();

    // Determine default bounds if no explicit filter
    // periods are already sorted descending when passed in, so reverse() makes them chronological.
    let startIndex = 0;
    let endIndex = sortedPeriods.length - 1;

    if (fromPeriod) {
        const fromIdx = sortedPeriods.indexOf(fromPeriod);
        if (fromIdx !== -1) startIndex = fromIdx;
    } else {
        // Default to last 8 periods if no filter
        startIndex = Math.max(0, sortedPeriods.length - 8);
    }

    if (toPeriod) {
        const toIdx = sortedPeriods.indexOf(toPeriod);
        if (toIdx !== -1) endIndex = toIdx;
    }

    // Ensure valid slice bounds
    if (startIndex > endIndex) {
        const temp = startIndex;
        startIndex = endIndex;
        endIndex = temp;
    }

    const displayPeriods = sortedPeriods.slice(startIndex, endIndex + 1);
    const firstItems = data[periods[0]] || [];
    const rows = classifyItems(firstItems)[stmtType].slice(0, 4);
    if (!rows.length) return null;

    const chartData = displayPeriods.map(p => {
        const obj = { period: p };
        for (const row of rows) {
            const match = (data[p] || []).find(x => x.code === row.code);
            obj[row.displayName] = match ? Math.round(match.value / 1000) : null;
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
                        <Line key={row.code} type="monotone" dataKey={row.displayName}
                            stroke={lineColors[i % lineColors.length]} dot={false}
                            strokeWidth={2} connectNulls />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── Financial Table ──────────────────────────────────────────────────────────
function FinancialTable({ periods, data, stmtType, fromPeriod, toPeriod, isAdmin, isEditing, rowPrefs, onPrefChange, globalUnit }) {
    if (!periods.length) return <div style={{ color: C.text, fontSize: '13px', padding: '2rem' }}>No data.</div>;

    const firstItems = data[periods[0]] || [];
    let rows = classifyItems(firstItems)[stmtType];

    // Filter out hidden rows if not in edit mode
    if (!isEditing) {
        rows = rows.filter(r => {
            const code = r.itemCode || r.code;
            return !(rowPrefs[code] && rowPrefs[code].hidden);
        });
    }

    // Sort rows by displayOrder to match VNDirect standard ordering
    rows.sort((a, b) => (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999));

    if (!rows || !rows.length) return <div style={{ color: C.text, fontSize: '13px', padding: '2rem' }}>No {stmtType} items found. Ratios will be added soon.</div>;

    const sortedPeriods = [...periods].reverse();

    let startIndex = 0;
    let endIndex = sortedPeriods.length - 1;

    if (fromPeriod) {
        const fromIdx = sortedPeriods.indexOf(fromPeriod);
        if (fromIdx !== -1) startIndex = fromIdx;
    } else {
        startIndex = Math.max(0, sortedPeriods.length - 8);
    }

    if (toPeriod) {
        const toIdx = sortedPeriods.indexOf(toPeriod);
        if (toIdx !== -1) endIndex = toIdx;
    }

    if (startIndex > endIndex) {
        const temp = startIndex;
        startIndex = endIndex;
        endIndex = temp;
    }

    // Ensure display is chronological (oldest to newest from left to right)
    const displayPeriods = sortedPeriods.slice(startIndex, endIndex + 1);
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
                        const code = item.itemCode || item.code;
                        const pref = rowPrefs[code] || {};
                        const isHidden = pref.hidden;
                        const customName = pref.name || item.displayName;

                        const vals = displayPeriods.map(p => lookup[p][code]);
                        return (
                            <tr key={code} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)', opacity: isEditing && isHidden ? 0.4 : 1 }}>
                                <td style={{ padding: '8px 12px', color: C.text, borderBottom: `1px solid ${C.border}`, position: 'sticky', left: 0, background: i % 2 === 0 ? C.card : '#131313', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={customName}>
                                    {isEditing ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={!isHidden}
                                                    onChange={(e) => onPrefChange(code, 'hidden', !e.target.checked)}
                                                    style={{ marginRight: '8px', cursor: 'pointer', accentColor: C.teal }}
                                                />
                                                <input
                                                    type="text"
                                                    value={pref.name !== undefined ? pref.name : item.displayName}
                                                    onChange={(e) => onPrefChange(code, 'name', e.target.value)}
                                                    style={{ background: '#222', border: '1px solid #444', color: '#fff', fontSize: '11px', padding: '2px 4px', width: '220px' }}
                                                    placeholder="Custom Row Name"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <>{customName}</>
                                    )}
                                </td>
                                {vals.map((v, j) => (
                                    <td key={j} style={{ padding: '8px 12px', textAlign: 'right', color: v != null && v < 0 ? C.red : C.teal, borderBottom: `1px solid ${C.border}`, fontVariantNumeric: 'tabular-nums' }}>
                                        {fmtVND(v, globalUnit)}
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
const STMT_LABELS = { IS: 'Income Statement', BS: 'Balance Sheet', CF: 'Cash Flow', Ratio: 'Key Ratios' };

export default function CompanyFinancials() {
    const { data: session } = useSession();
    const isAdmin = session?.user?.role === 'admin';

    const [tickerInput, setTickerInput] = useState('');
    const [ticker, setTicker] = useState('');
    const [financials, setFinancials] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [view, setView] = useState('Quarterly');
    const [stmtTab, setStmtTab] = useState('IS');
    const [stockInfo, setStockInfo] = useState({});
    const [fromPeriod, setFromPeriod] = useState('');
    const [toPeriod, setToPeriod] = useState('');
    const [globalUnit, setGlobalUnit] = useState('B');

    const [rowPrefs, setRowPrefs] = useState({});
    const [availableTickers, setAvailableTickers] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [savingPrefs, setSavingPrefs] = useState(false);

    useEffect(() => {
        let mounted = true;
        fetch('/api/stock-info')
            .then(res => res.json())
            .then(data => { if (mounted) setStockInfo(data); })
            .catch(console.error);

        fetch('/api/financial-prefs')
            .then(res => res.json())
            .then(data => { if (mounted && data.rows) setRowPrefs(data.rows); })
            .catch(console.error);

        fetch('/api/financials/available')
            .then(res => res.json())
            .then(data => { if (mounted && Array.isArray(data)) setAvailableTickers(data); })
            .catch(console.error);

        // Auto-load initial ticker on mount
        setTickerInput('VCB');
        doSearch('VCB');

        return () => { mounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    // Automatically set default from/to periods when periods array changes
    useEffect(() => {
        if (periods.length > 0) {
            // Periods are sorted descending (newest first).
            // We want 'From' to be 8 periods ago (or oldest if < 8), and 'To' to be the newest.
            setFromPeriod(periods[Math.min(7, periods.length - 1)]);
            setToPeriod(periods[0]);
        } else {
            setFromPeriod('');
            setToPeriod('');
        }
    }, [periods]);

    const data = useMemo(() => financials ? (view === 'Annual' ? financials.annual : financials.quarterly) : {}, [financials, view]);

    const handlePrefChange = (code, key, val) => {
        setRowPrefs(prev => {
            const newPrefs = { ...prev };
            if (!newPrefs[code]) newPrefs[code] = {};
            newPrefs[code] = { ...newPrefs[code], [key]: val };
            return newPrefs;
        });
    };

    const handleSavePrefs = async () => {
        setSavingPrefs(true);
        try {
            const payload = { rows: rowPrefs };
            const res = await fetch('/api/financial-prefs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setIsEditing(false);
            } else {
                alert("Failed to save preferences");
            }
        } catch (e) {
            console.error(e);
            alert("Error saving preferences");
        } finally {
            setSavingPrefs(false);
        }
    };

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
            {/* Control Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: C.text, fontWeight: 500 }}>Select Company:</span>
                    <select
                        value={tickerInput}
                        onChange={e => {
                            const val = e.target.value;
                            setTickerInput(val);
                            doSearch(val);
                        }}
                        style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, color: C.white, borderRadius: '6px', padding: '6px 10px', fontSize: '12px', outline: 'none', cursor: 'pointer', width: 'auto', minWidth: '80px' }}
                    >
                        {Object.entries(stockInfo)
                            .filter(([tk]) => availableTickers.length === 0 || availableTickers.includes(tk))
                            .map(([tk, info]) => (
                                <option key={tk} value={tk}>{tk}</option>
                            ))}
                    </select>
                </div>

                {isAdmin && (
                    <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                        {isEditing ? (
                            <>
                                <button style={{ ...btnStyle('Cancel', true), background: C.red, borderColor: C.red }} onClick={() => setIsEditing(false)}>Cancel</button>
                                <button style={{ ...btnStyle('Save', true), background: C.green, borderColor: C.green }} onClick={handleSavePrefs} disabled={savingPrefs}>
                                    {savingPrefs ? 'Saving...' : '💾 Save Preferences'}
                                </button>
                            </>
                        ) : (
                            <button style={btnStyle('Edit', false)} onClick={() => setIsEditing(true)}>
                                👁️ Edit Visible Rows
                            </button>
                        )}
                    </div>
                )}

                {financials && !loading && (
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '13px', color: C.text, fontWeight: 500 }}>Period:</span>
                            <select
                                value={fromPeriod}
                                onChange={(e) => setFromPeriod(e.target.value)}
                                style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, color: C.white, borderRadius: '6px', padding: '6px 10px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
                            >
                                {[...periods].reverse().map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <span style={{ fontSize: '12px', color: C.text, margin: '0 4px' }}>to</span>
                            <select
                                value={toPeriod}
                                onChange={(e) => setToPeriod(e.target.value)}
                                style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, color: C.white, borderRadius: '6px', padding: '6px 10px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
                            >
                                {[...periods].reverse().map(p => <option key={p} value={p}>{p}</option>)}
                            </select>

                            <span style={{ fontSize: '13px', color: C.text, fontWeight: 500, marginLeft: '12px' }}>Unit:</span>
                            <select
                                value={globalUnit}
                                onChange={(e) => setGlobalUnit(e.target.value)}
                                style={{ background: '#1a1a1a', border: `1px solid ${C.border}`, color: C.white, borderRadius: '6px', padding: '6px 10px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
                            >
                                <option value="raw">Raw (VND)</option>
                                <option value="M">Million</option>
                                <option value="B">Billion</option>
                                <option value="T">Trillion</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', paddingLeft: '20px', borderLeft: `1px solid ${C.border}` }}>
                            <button style={btnStyle('Quarterly', view === 'Quarterly')} onClick={() => setView('Quarterly')}>Quarterly</button>
                            <button style={btnStyle('Annual', view === 'Annual')} onClick={() => setView('Annual')}>Annual</button>
                        </div>
                    </div>
                )}
            </div>

            {error && <div style={{ background: '#1a0a0a', border: `1px solid ${C.red}`, borderRadius: '8px', padding: '0.875rem 1rem', color: C.red, fontSize: '12px' }}>⚠ {error}</div>}
            {loading && <div style={{ color: C.text, fontSize: '13px', padding: '2rem', textAlign: 'center' }}>Loading financials for {ticker}...</div>}

            {financials && !loading && (
                <>
                    {/* Ticker header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: C.green }}>
                                {stockInfo[financials.ticker] ? stockInfo[financials.ticker].organ_short : financials.ticker} (Ticker: {financials.ticker})
                            </h2>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: C.text }}>
                                Updated: {financials.lastUpdated ? new Date(financials.lastUpdated).toLocaleDateString('en-GB') : '—'} · Values in {globalUnit === 'raw' ? 'VND' : `${globalUnit} VND`}
                            </p>
                        </div>
                    </div>

                    {/* Trend chart */}
                    <div className="card" style={{ padding: '1.25rem', background: C.card, border: `1px solid ${C.border}` }}>
                        <h3 style={{ margin: 0, fontSize: '13px', color: C.white }}>Key Trends — {STMT_LABELS[stmtTab]}</h3>
                        <p style={{ margin: '3px 0 0', fontSize: '11px', color: C.text }}>Top line items over time ({globalUnit === 'raw' ? 'VND' : `${globalUnit} VND`})</p>
                        <TrendChart periods={periods} data={data} stmtType={stmtTab} fromPeriod={fromPeriod} toPeriod={toPeriod} globalUnit={globalUnit} />
                    </div>

                    {/* Statement tabs */}
                    <div className="card" style={{ padding: 0, background: C.card, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 1rem', alignItems: 'center' }}>
                            {Object.entries(STMT_LABELS).map(([key, label]) => (
                                <button key={key} style={tabStyle(key)} onClick={() => setStmtTab(key)}>{label}</button>
                            ))}
                            <span style={{ marginLeft: 'auto', fontSize: '11px', color: C.text }}>{periods.length} total periods</span>
                        </div>
                        <FinancialTable
                            periods={periods}
                            data={data}
                            stmtType={stmtTab}
                            fromPeriod={fromPeriod}
                            toPeriod={toPeriod}
                            isAdmin={isAdmin}
                            isEditing={isEditing}
                            rowPrefs={rowPrefs}
                            onPrefChange={handlePrefChange}
                            globalUnit={globalUnit}
                        />
                    </div>
                </>
            )}

            {!financials && !loading && !error && (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: C.text }}>
                    <div style={{ fontSize: '40px', marginBottom: '0.75rem' }}>📊</div>
                    <div style={{ fontSize: '14px', color: C.white }}>Search for a company above</div>
                    <div style={{ fontSize: '12px', marginTop: '4px' }}>Analyze financial statements in detail</div>
                </div>
            )}
        </div>
    );
}
