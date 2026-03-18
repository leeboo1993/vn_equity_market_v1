'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useSession } from 'next-auth/react';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
    teal: '#00a884', blue: '#3b82f6', yellow: '#f59e0b',
    red: '#e55353', green: '#10b981', purple: '#a855f7',
    card: '#0d1117', border: '#1f2937', text: '#9ca3af', white: '#ffffff',
    bg: '#0a0a0a'
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

// ─── Premium Metric Card ────────────────────────────────────────────────────
function MetricCard({ label, value, subValue, trend, icon, color = C.teal }) {
    return (
        <div className="flex-1 min-w-[200px] p-6 rounded-2xl border border-gray-900 bg-[#0d1016]/40 backdrop-blur-sm flex flex-col gap-4 group hover:border-gray-800 transition-all duration-300">
            <div className="flex justify-between items-start">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</span>
                <div className={`p-2 rounded-lg bg-${color}/10 text-${color}`}>
                    {icon}
                </div>
            </div>
            <div>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-gray-100 tracking-tighter">{value}</span>
                    {trend !== undefined && (
                        <span className={`text-[10px] font-bold ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
                        </span>
                    )}
                </div>
                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-tight">{subValue}</span>
            </div>
            <div className={`h-1 w-full bg-gray-900 rounded-full overflow-hidden mt-auto`}>
                <div className={`h-full bg-${color}`} style={{ width: '60%', backgroundColor: color }}></div>
            </div>
        </div>
    );
}

// ─── Premium Area Chart ─────────────────────────────────────────────────────
function PremiumTrendChart({ periods, data, stmtType, fromPeriod, toPeriod }) {
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

    const displayPeriods = sortedPeriods.slice(startIndex, endIndex + 1);
    const firstItems = data[periods[0]] || [];
    const rows = classifyItems(firstItems)[stmtType].slice(0, 3);
    if (!rows.length) return null;

    const chartData = displayPeriods.map(p => {
        const obj = { period: p };
        for (const row of rows) {
            const match = (data[p] || []).find(x => x.code === row.code);
            obj[row.displayName] = match ? Math.round(match.value / 1000000000) : null;
        }
        return obj;
    });

    const colors = [C.teal, C.blue, C.yellow];

    return (
        <div style={{ height: '350px', width: '100%' }} className="mt-4">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        {rows.map((row, i) => (
                            <linearGradient key={`grad-${i}`} id={`color-${i}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={colors[i]} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={colors[i]} stopOpacity={0} />
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#111" />
                    <XAxis
                        dataKey="period"
                        stroke="#333"
                        fontSize={9}
                        tick={{ fill: '#444' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        stroke="#333"
                        fontSize={9}
                        tick={{ fill: '#444' }}
                        tickFormatter={v => `${v}B`}
                        axisLine={false}
                        tickLine={false}
                        width={40}
                    />
                    <Tooltip
                        contentStyle={{ background: '#111', border: '1px solid #222', borderRadius: '12px', fontSize: '10px' }}
                        itemStyle={{ padding: '0px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                    {rows.map((row, i) => (
                        <Area
                            key={row.code}
                            type="monotone"
                            dataKey={row.displayName}
                            stroke={colors[i]}
                            fillOpacity={1}
                            fill={`url(#color-${i})`}
                            strokeWidth={2}
                            connectNulls
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// ─── Financial Table ──────────────────────────────────────────────────────────
function FinancialTable({ periods, data, stmtType, fromPeriod, toPeriod, isAdmin, isEditing, rowPrefs, onPrefChange, globalUnit }) {
    if (!periods.length) return <div className="p-12 text-center text-gray-700 font-black uppercase tracking-widest text-[10px]">Awaiting Dataset Verification...</div>;

    const firstItems = data[periods[0]] || [];
    let rows = classifyItems(firstItems)[stmtType];

    if (!isEditing) {
        rows = rows.filter(r => {
            const code = r.itemCode || r.code;
            return !(rowPrefs[code] && rowPrefs[code].hidden);
        });
    }

    rows.sort((a, b) => (a.displayOrder ?? 9999) - (b.displayOrder ?? 9999));

    if (!rows || !rows.length) return <div className="p-12 text-center text-gray-700 font-black uppercase tracking-widest text-[10px]">No {stmtType} Architecture Found</div>;

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

    const displayPeriods = sortedPeriods.slice(startIndex, endIndex + 1);
    const lookup = {};
    for (const p of displayPeriods) {
        lookup[p] = {};
        for (const item of (data[p] || [])) lookup[p][item.code] = item.value;
    }

    return (
        <div className="overflow-x-auto relative">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-gray-900 sticky top-0 z-30 bg-[#0d1117]">
                        <th className="sticky left-0 top-0 z-40 bg-[#0d1117] text-left p-4 text-[10px] font-black text-gray-600 uppercase tracking-widest min-w-[240px] border-b border-gray-900">
                            Strategic Metrics ({globalUnit === 'raw' ? 'VND' : `${globalUnit} VND`})
                        </th>
                        {displayPeriods.map(p => (
                            <th key={p} className="sticky top-0 p-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[100px] border-l border-gray-900/30 bg-[#0d1117] border-b border-gray-900">{p}</th>
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

                        // Conditional highlight for key metrics
                        const isKeyMetric = ['net revenue', 'profit before tax', 'profit after tax', 'net profit'].some(kw => customName.toLowerCase().includes(kw));

                        return (
                            <tr key={code} className={`group hover:bg-white/[0.02] transition-colors border-b border-gray-900/50 ${isKeyMetric ? 'bg-emerald-500/[0.02]' : ''}`}>
                                <td className={`sticky left-0 z-10 p-4 text-[11px] font-bold text-gray-400 border-r border-gray-900/50 backdrop-blur-md bg-[#0d1117]/80 group-hover:text-gray-100 transition-colors`}>
                                    {isEditing ? (
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={!isHidden}
                                                onChange={(e) => onPrefChange(code, 'hidden', !e.target.checked)}
                                                className="w-3 h-3 accent-emerald-500 rounded border-gray-800 bg-black"
                                            />
                                            <input
                                                type="text"
                                                value={pref.name !== undefined ? pref.name : item.displayName}
                                                onChange={(e) => onPrefChange(code, 'name', e.target.value)}
                                                className="bg-black border border-gray-800 text-emerald-500 px-2 py-1 flex-1 text-[10px] font-bold outline-none focus:border-emerald-500"
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            {isKeyMetric && <div className="w-1 h-3 rounded-full bg-emerald-500/50"></div>}
                                            {customName}
                                        </div>
                                    )}
                                </td>
                                {vals.map((v, j) => (
                                    <td key={j} className={`p-4 text-right text-[11px] font-black tabular-nums transition-all ${v < 0 ? 'text-rose-500' : 'text-gray-300 group-hover:text-emerald-400'}`}>
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
const STMT_LABELS = { IS: 'Income Statement', BS: 'Balance Sheet', CF: 'Cash Flow', Ratio: 'Performance Ratios' };

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
        fetch('/api/stock-info').then(res => res.json()).then(data => { if (mounted) setStockInfo(data); });
        fetch('/api/financial-prefs').then(res => res.json()).then(data => { if (mounted && data.rows) setRowPrefs(data.rows); });
        fetch('/api/financials/available').then(res => res.json()).then(data => { if (mounted && Array.isArray(data)) setAvailableTickers(data); });
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

    useEffect(() => {
        if (periods.length > 0) {
            setFromPeriod(periods[Math.min(7, periods.length - 1)]);
            setToPeriod(periods[0]);
        }
    }, [periods]);

    const data = useMemo(() => financials ? (view === 'Annual' ? financials.annual : financials.quarterly) : {}, [financials, view]);

    const handlePrefChange = (code, key, val) => {
        setRowPrefs(prev => ({ ...prev, [code]: { ...prev[code], [key]: val } }));
    };

    const handleSavePrefs = async () => {
        setSavingPrefs(true);
        try {
            const res = await fetch('/api/financial-prefs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: rowPrefs })
            });
            if (res.ok) setIsEditing(false);
            else alert("Failed to save preferences");
        } catch (e) {
            alert("Error saving preferences");
        } finally {
            setSavingPrefs(false);
        }
    };

    // Calculate dynamic insights from top results
    const insights = useMemo(() => {
        if (!financials || periods.length < 2) return null;
        const curP = periods[0];
        const prevP = periods[1];
        const curData = data[curP] || [];
        const prevData = data[prevP] || [];

        const findVal = (list, kw) => {
            const item = list.find(x =>
                (x.nameEn || '').toLowerCase().includes(kw) ||
                (x.name || '').toLowerCase().includes(kw) ||
                (x.itemName || '').toLowerCase().includes(kw) ||
                (x.itemNameEn || '').toLowerCase().includes(kw)
            );
            return item ? item.value : 0;
        };

        // VCB specific: 'NET REVENUE' or 'Net revenue'
        const curRev = findVal(curData, 'total operating income') || findVal(curData, 'net revenue');
        const prevRev = findVal(prevData, 'total operating income') || findVal(prevData, 'net revenue');
        const curProfit = findVal(curData, 'profit after tax') || findVal(curData, 'net profit');
        const prevProfit = findVal(prevData, 'profit after tax') || findVal(prevData, 'net profit');
        const curAssets = findVal(curData, 'total asset');
        const curEquity = findVal(curData, 'equity') || findVal(curData, 'owners\' equity') || findVal(curData, 'owner\'s equity');

        return {
            rev: curRev,
            revGrowth: prevRev ? ((curRev - prevRev) / prevRev) * 100 : 0,
            profit: curProfit,
            profitGrowth: prevProfit ? ((curProfit - prevProfit) / prevProfit) * 100 : 0,
            roe: curEquity && curProfit ? (curProfit / curEquity) * 100 * 4 : 0, // Annualize quarterly ROE roughly if needed, or just keep as is
            assetBase: curAssets
        };
    }, [financials, periods, data]);

    return (
        <div className="flex flex-col gap-8">
            {/* Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-6 bg-[#0d1117] p-4 rounded-2xl border border-gray-900 shadow-2xl">
                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Asset Intelligence:</span>
                    <select
                        value={tickerInput}
                        onChange={e => { setTickerInput(e.target.value); doSearch(e.target.value); }}
                        className="bg-black border border-gray-800 text-[11px] font-black text-emerald-500 rounded-lg px-4 py-2 outline-none focus:border-emerald-500 transition-all cursor-pointer uppercase"
                    >
                        {Object.entries(stockInfo)
                            .filter(([tk]) => availableTickers.length === 0 || availableTickers.includes(tk))
                            .map(([tk, info]) => (
                                <option key={tk} value={tk}>{tk} - {info.organ_short}</option>
                            ))}
                    </select>
                </div>

                <div className="flex items-center gap-6">
                    {financials && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setView('Quarterly')}
                                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${view === 'Quarterly' ? 'bg-emerald-500 text-black' : 'text-gray-500'}`}
                            >
                                Quarterly
                            </button>
                            <button
                                onClick={() => setView('Annual')}
                                className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${view === 'Annual' ? 'bg-emerald-500 text-black' : 'text-gray-500'}`}
                            >
                                Annual
                            </button>
                        </div>
                    )}

                    <div className="h-6 w-px bg-gray-800"></div>

                    {isAdmin && (
                        <button
                            onClick={() => isEditing ? handleSavePrefs() : setIsEditing(true)}
                            disabled={savingPrefs}
                            className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md border ${isEditing ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'border-gray-800 text-gray-500 hover:text-gray-300'}`}
                        >
                            {isEditing ? (savingPrefs ? 'Updating...' : 'Commit Changes') : 'Curate Layout'}
                        </button>
                    )}
                </div>
            </div>

            {error && <div className="p-4 bg-rose-500/10 border border-rose-500/50 rounded-xl text-rose-500 text-[11px] font-bold">⚠ {error}</div>}

            {financials && !loading && (
                <>
                    {/* Insights Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
                        <MetricCard
                            label="Current Revenue"
                            value={`${(insights?.rev / 1e9).toFixed(1)}B`}
                            subValue="Billion VND"
                            trend={insights?.revGrowth}
                            color={C.teal}
                            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 2v20M2 12h20" /></svg>}
                        />
                        <MetricCard
                            label="Net Earnings"
                            value={`${(insights?.profit / 1e9).toFixed(1)}B`}
                            subValue="Post-Tax Profit"
                            trend={insights?.profitGrowth}
                            color={C.blue}
                            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>}
                        />
                        <MetricCard
                            label="Return on Equity"
                            value={`${insights?.roe.toFixed(2)}%`}
                            subValue="Capital Efficiency"
                            color={C.yellow}
                            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><path d="m16 12-4-4-4 4" /></svg>}
                        />
                        <MetricCard
                            label="Asset Integrity"
                            value={`${(insights?.assetBase / 1e12).toFixed(1)}T`}
                            subValue="Total Assets"
                            color={C.purple}
                            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>}
                        />
                    </div>

                    {/* Chart Section */}
                    <div className="grid grid-cols-1 gap-6">
                        <div className="bg-[#0d1117] border border-gray-900 rounded-3xl p-8 relative overflow-hidden group">
                            <div className="flex flex-col gap-1 mb-6 relative z-10">
                                <h3 className="text-[11px] font-black text-gray-500 uppercase tracking-widest">{STMT_LABELS[stmtTab]} Evolution</h3>
                                <p className="text-[9px] text-gray-700 font-bold uppercase tracking-widest italic">Temporal trend analysis for {financials.ticker}</p>
                            </div>
                            <PremiumTrendChart periods={periods} data={data} stmtType={stmtTab} fromPeriod={fromPeriod} toPeriod={toPeriod} />

                            {/* Decorative Grid Overlay */}
                            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
                        </div>
                    </div>

                    {/* Smart Table Section */}
                    <div className="bg-[#0d1117] border border-gray-900 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-gray-900 flex items-center justify-between bg-white/[0.01]">
                            <div className="flex items-center gap-6">
                                {Object.entries(STMT_LABELS).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => setStmtTab(key)}
                                        className={`text-[10px] font-black uppercase tracking-widest transition-all ${stmtTab === key ? 'text-emerald-500' : 'text-gray-600 hover:text-gray-400'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-[10px] text-gray-700 font-bold uppercase tracking-widest">{periods.length} Data Points</span>
                                <select
                                    value={globalUnit}
                                    onChange={(e) => setGlobalUnit(e.target.value)}
                                    className="bg-black border border-gray-800 text-[9px] font-black text-gray-500 px-2 py-1 rounded outline-none"
                                >
                                    <option value="raw">VND</option>
                                    <option value="M">Million</option>
                                    <option value="B">Billion</option>
                                    <option value="T">Trillion</option>
                                </select>
                            </div>
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

            {!financials && loading && (
                <div className="flex flex-col items-center justify-center p-24 gap-4">
                    <div className="w-12 h-12 border-t-2 border-emerald-500 rounded-full animate-spin"></div>
                    <span className="text-[10px] text-gray-700 font-black uppercase tracking-widest animate-pulse">Synchronizing Market Data...</span>
                </div>
            )}
        </div>
    );
}
