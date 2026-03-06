'use client';

import React, { useState, useEffect, useMemo } from 'react';
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

const COLORS = {
    teal: '#00a884',
    blue: '#3b82f6',
    purple: '#a855f7',
    yellow: '#f59e0b',
    red: '#e55353',
    green: '#10b981',
    gray: '#64748b',
    card: '#111111',
    border: '#222222',
    text: '#888888',
    white: '#ffffff'
};

const BANK_COLORS = {
    'VPB': '#008466', 'TCB': '#2962FF', 'MBB': '#7B1FA2', 'BID': '#D4A82F',
    'VCB': '#00B8D4', 'CTG': '#C62828', 'ACB': '#1565C0', 'HDB': '#E65100',
    'VIB': '#F9A825', 'MSB': '#EF6C00', 'STB': '#2E7D32', 'LPB': '#D32F2F',
    'TPB': '#7B1FA2', 'SHB': '#F57C00', 'EIB': '#1976D2', 'OCB': '#388E3C',
    'SSB': '#C2185B', 'ABB': '#0097A7'
};

// DD/MM for chart X-axis ticks
const axisDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateStr;
};

// DD/MM/YYYY for "Latest:" labels and tooltips
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
};

export default function MoneyMarketTab({ timeFilter, customRange }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    // UI States
    const [fxBasket, setFxBasket] = useState(['USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CNY', 'KRW', 'SGD', 'THB']);
    const [depositTenor, setDepositTenor] = useState('12M');
    const [dataSource, setDataSource] = useState('Retail');
    const [selectedBanks, setSelectedBanks] = useState(['VCB', 'TCB', 'VPB', 'ACB', 'BID']);
    const [goldSilverSelection, setGoldSilverSelection] = useState(['bar', 'silver_bar']);

    useEffect(() => {
        setLoading(true);
        fetch('/api/money-market')
            .then(res => res.json())
            .then(d => {
                setData(d);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch money market data", err);
                setLoading(false);
            });
    }, []);

    // Filter by timeFilter logic
    const filteredData = useMemo(() => {
        if (!data) return null;

        let cutoffStr;
        let toStr = '9999-12-31';

        if (timeFilter === 'CUSTOM' && customRange) {
            cutoffStr = customRange.from || '1900-01-01';
            if (customRange.to) toStr = customRange.to;
        } else {
            let days = 3650;
            if (timeFilter === '1M') days = 30;
            else if (timeFilter === '3M') days = 90;
            else if (timeFilter === '6M') days = 180;
            else if (timeFilter === '1Y') days = 365;
            else if (timeFilter === 'YTD') {
                const now = new Date();
                days = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24));
            }
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            cutoffStr = cutoff.toISOString().split('T')[0];
        }

        const filterFn = (arr) => arr ? arr.filter(d => d.date >= cutoffStr && d.date <= toStr) : [];

        return {
            gold: filterFn(data.gold),
            silver: filterFn(data.silver),
            vcb_usd: data.vcb?.filter(d => d.ticker === 'USD' && d.date >= cutoffStr),
            vcb_all: data.vcb,
            black_market: filterFn(data.black_market),
            deposit: filterFn(data.deposit_quote),
            dl_deposit: filterFn(data.dl_deposit),
            treasury: filterFn(data.treasury),
            interbank: filterFn(data.interbank)
        };
    }, [data, timeFilter, customRange]);

    // 1. USD/VND Comparison
    const usdComparisonData = useMemo(() => {
        if (!filteredData?.vcb_usd || !filteredData?.black_market) return [];
        const combined = [];
        const blackMap = new Map(filteredData.black_market.map(d => [d.date, d]));
        filteredData.vcb_usd.forEach(v => {
            const b = blackMap.get(v.date);
            if (b) {
                combined.push({
                    date: v.date,
                    vcb: parseFloat(v.sell),
                    black: parseFloat(b.usd_sell_black_market || b.sell)
                });
            }
        });
        return combined.sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredData]);

    // 2. Gold & Silver Comparison with DoD Change
    const goldSeries = useMemo(() => {
        if (!filteredData?.gold) return [];
        const silverMap = new Map((filteredData.silver || []).map(s => [s.date, s]));

        const series = filteredData.gold.map((d, i, arr) => {
            const s = silverMap.get(d.date);
            const prevD = arr[i - 1];
            const prevS = i > 0 ? (filteredData.silver || []).find(sv => sv.date === prevD.date) : null;

            const silver_mace = s ? parseFloat(s.silver_sell) : null;

            const res = {
                date: d.date,
                bar: parseFloat(d.bar_sell) || null,
                ring: parseFloat(d.ring_sell) || null,
                silver_bar: silver_mace,
                // 1 Mace = 3.75g. 1kg = 1000g. 1kg = 1000 / 3.75 ~ 266.67 maces? No.
                // 1 Tael = 10 Mace = 37.5g. 1kg = 1000g.
                // 1kg = 1000 / 37.5 Taels = 26.666... Taels.
                // 1kg = 26.666... * 10 Mace = 266.666 Mace.
                // Price per kg (Millions VND) = Price per Mace * 266.666
                silver_kg: silver_mace ? silver_mace * 266.666 : null
            };

            // Calculate DoD Change %
            if (prevD) {
                if (res.bar && prevD.bar_sell) res.bar_dod = ((res.bar - parseFloat(prevD.bar_sell)) / parseFloat(prevD.bar_sell)) * 100;
                if (res.ring && prevD.ring_sell) res.ring_dod = ((res.ring - parseFloat(prevD.ring_sell)) / parseFloat(prevD.ring_sell)) * 100;
            }
            if (prevS && silver_mace && prevS.silver_sell) {
                res.silver_dod = ((silver_mace - parseFloat(prevS.silver_sell)) / parseFloat(prevS.silver_sell)) * 100;
            }

            return res;
        });

        return series.filter(d => d.bar || d.ring || d.silver_bar);
    }, [filteredData]);

    // 3. Deposit Rates
    const depositSeries = useMemo(() => {
        if (dataSource === 'Retail') {
            if (!filteredData?.deposit) return [];
            return filteredData.deposit.map(d => {
                const obj = { date: d.date };
                selectedBanks.forEach(b => {
                    const rate = d.banks[b]?.[depositTenor];
                    obj[b] = rate ? parseFloat(rate) : null;
                });
                return obj;
            });
        } else {
            if (!filteredData?.dl_deposit) return [];
            const rawSource = filteredData.dl_deposit.filter(d =>
                (d.tenor === depositTenor || d.tenor === depositTenor.toLowerCase()) && selectedBanks.includes(d.bank)
            );
            const grouped = {};
            rawSource.forEach(d => {
                if (!grouped[d.date]) grouped[d.date] = { date: d.date };
                grouped[d.date][d.bank] = parseFloat(d.rate);
            });
            return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
        }
    }, [filteredData, selectedBanks, depositTenor, dataSource]);

    // 4. Liquidity: State Treasury & OMO
    const treasurySeries = useMemo(() => {
        if (!filteredData?.treasury) return [];
        const grouped = {};
        filteredData.treasury.forEach(d => {
            if (!grouped[d.date]) grouped[d.date] = { date: d.date };
            let key = 'State Treasury';
            if (d.instrument.toLowerCase().includes('omo')) key = 'OMO';
            if (d.instrument.toLowerCase().includes('citad')) key = 'CITAD';
            grouped[d.date][key] = parseFloat(d.rate);
        });
        return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredData]);

    // 5. Interbank Rates
    const interbankSeries = useMemo(() => {
        if (!filteredData?.interbank) return [];
        const grouped = {};
        filteredData.interbank.forEach(d => {
            if (!grouped[d.date]) grouped[d.date] = { date: d.date };
            const t = (d.tenor || '').toLowerCase();
            let key = d.tenor;
            if (t === 'overnight' || t === 'o/n') key = 'O/N';
            else if (t === '1_week' || t === '1w') key = '1W';
            else if (t === '1_month' || t === '1m') key = '1M';
            else if (t === '1_year' || t === '1y') key = '1Y';
            grouped[d.date][key] = parseFloat(d.rate);
        });
        return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredData]);

    // Available Banks for selection (Union of Retail and DL Equity)
    const availableBanks = useMemo(() => {
        const banks = new Set();
        if (data?.deposit_quote?.length) {
            const lastDay = data.deposit_quote[data.deposit_quote.length - 1];
            Object.keys(lastDay.banks).forEach(b => banks.add(b));
        }
        if (data?.dl_deposit?.length) {
            data.dl_deposit.forEach(d => banks.add(d.bank));
        }
        return Array.from(banks).sort();
    }, [data]);

    // FX Basket Logic
    const latestFx = useMemo(() => {
        if (!data?.vcb) return [];
        const sorted = [...data.vcb].sort((a, b) => b.date.localeCompare(a.date));
        const dates = [...new Set(sorted.map(d => d.date))];
        const latestDate = dates[0];
        const prevDate = dates[1];

        const latest = data.vcb.filter(d => d.date === latestDate);
        const prev = data.vcb.filter(d => d.date === prevDate);

        return fxBasket.map(t => {
            const curr = latest.find(d => d.ticker === t);
            const old = prev.find(d => d.ticker === t);
            const val = parseFloat(curr?.sell);
            const oldVal = parseFloat(old?.sell);
            return {
                ticker: t,
                name: curr?.name || t,
                sell: val,
                prevSell: oldVal,
                absChange: val && oldVal ? val - oldVal : 0,
                change: val && oldVal ? ((val - oldVal) / oldVal) * 100 : 0
            };
        }).filter(f => f.sell);
    }, [data, fxBasket]);

    const latestCommodities = useMemo(() => {
        if (!goldSeries.length) return null;
        const latest = goldSeries[goldSeries.length - 1];
        return {
            bar: latest.bar,
            bar_dod: latest.bar_dod,
            silver_kg: latest.silver_kg,
            silver_dod: latest.silver_dod,
            date: latest.date
        };
    }, [goldSeries]);

    const latestDates = useMemo(() => {
        if (!data) return {};
        const getLatest = (arr) => arr?.length ? arr[arr.length - 1].date : null;
        return {
            fx: getLatest(usdComparisonData),
            gold: getLatest(goldSeries),
            deposit: getLatest(filteredData?.deposit),
            liquidity: getLatest(treasurySeries),
            interbank: getLatest(interbankSeries)
        };
    }, [data, usdComparisonData, goldSeries, filteredData]);

    if (loading) return <div style={{ color: COLORS.text, padding: '2rem' }}>Loading Money Market...</div>;

    const toggleBank = (bank) => {
        setSelectedBanks(prev => prev.includes(bank) ? prev.filter(b => b !== bank) : [...prev, bank]);
    };

    const toggleGoldSilver = (key) => {
        setGoldSilverSelection(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Top Row: FX and Table */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.5rem', background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '14px', color: COLORS.white }}>USD/VND: VCB vs Black Market</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: COLORS.text }}>Daily selling rates comparison</p>
                        </div>
                        <div style={{ fontSize: '10px', color: COLORS.text, opacity: 0.8 }}>Latest: {formatDate(latestDates.fx) || '-'}</div>
                    </div>
                    <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={usdComparisonData}>
                                <defs>
                                    <linearGradient id="colorVCB" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.teal} stopOpacity={0.1} />
                                        <stop offset="95%" stopColor={COLORS.teal} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="#222" vertical={false} strokeDasharray="3 3" />
                                <XAxis dataKey="date" stroke={COLORS.text} fontSize={10} tickFormatter={axisDate} minTickGap={20} />
                                <YAxis domain={[d => Math.floor(d * 0.98), d => Math.ceil(d * 1.02)]} stroke={COLORS.text} fontSize={10} tickFormatter={v => v.toLocaleString()} width={55} />
                                <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontSize: '11px', color: '#fff' }} formatter={v => v.toLocaleString(undefined, { minimumFractionDigits: 0 })} labelFormatter={formatDate} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                <Area type="monotone" dataKey="vcb" name="VCB Sell" stroke={COLORS.teal} fill="url(#colorVCB)" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="black" name="Black Market" stroke={COLORS.yellow} strokeWidth={2} dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '14px', color: COLORS.white }}>FX Rates (VCB)</h3>
                            <div style={{ fontSize: '9px', color: COLORS.text, marginTop: '2px' }}>Update: {formatDate(latestDates.fx) || '-'}</div>
                        </div>
                        <div style={{ fontSize: '11px', color: COLORS.text }}>DoD Change</div>
                    </div>
                    <div style={{ overflowY: 'auto', maxHeight: '280px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead style={{ position: 'sticky', top: 0, background: COLORS.card, zIndex: 1 }}>
                                <tr style={{ color: COLORS.text, textAlign: 'left', borderBottom: `1px solid ${COLORS.border}` }}>
                                    <th style={{ padding: '8px 4px' }}>Ticker</th>
                                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Sell Price</th>
                                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Abs Chg</th>
                                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {latestFx.map(fx => (
                                    <tr key={fx.ticker} style={{ borderBottom: `1px solid #1a1a1a` }}>
                                        <td style={{ padding: '8px 4px' }}>
                                            <div style={{ fontWeight: 600, color: COLORS.white }}>{fx.ticker}</div>
                                            <div style={{ fontSize: '10px', color: COLORS.text }}>{fx.name}</div>
                                        </td>
                                        <td style={{ padding: '8px 4px', textAlign: 'right', color: COLORS.white }}>{fx.sell?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td style={{ padding: '8px 4px', textAlign: 'right', color: fx.absChange >= 0 ? COLORS.teal : COLORS.red }}>
                                            {fx.absChange > 0 ? '+' : ''}{fx.absChange.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '8px 4px', textAlign: 'right', color: fx.change >= 0 ? COLORS.teal : COLORS.red, fontWeight: 600 }}>
                                            {fx.change > 0 ? '+' : ''}{fx.change.toFixed(2)}%
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Middle Row: Gold/Silver and Deposit */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.5rem', background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '14px', color: COLORS.white }}>Commodities (Sell)</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: COLORS.text }}>Gold (Tael) & Silver (Mace) in Millions VND</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                            <div style={{ fontSize: '10px', color: COLORS.text, opacity: 0.8 }}>Latest: {formatDate(latestDates.gold) || '-'}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', background: '#1a1a1a', padding: '2px', borderRadius: '4px', justifyContent: 'flex-end' }}>
                                {[
                                    { key: 'bar', label: 'Gold Bar' },
                                    { key: 'ring', label: 'Gold Ring' },
                                    { key: 'silver_bar', label: 'Silver' }
                                ].map(item => (
                                    <button
                                        key={item.key}
                                        onClick={() => toggleGoldSilver(item.key)}
                                        style={{
                                            border: 'none',
                                            background: goldSilverSelection.includes(item.key) ? COLORS.teal : 'transparent',
                                            color: goldSilverSelection.includes(item.key) ? COLORS.white : COLORS.text,
                                            fontSize: '9px',
                                            padding: '3px 6px',
                                            borderRadius: '3px',
                                            cursor: 'pointer'
                                        }}
                                    >{item.label}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Latest Price Cards for Silver preference */}
                    {latestCommodities && (
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div style={{ flex: 1, padding: '12px', background: '#161616', borderRadius: '8px', border: '1px solid #222', textAlign: 'center' }}>
                                <div style={{ fontSize: '11px', color: COLORS.text, marginBottom: '4px' }}>Gold Bar (Millions/Tael)</div>
                                <div style={{ fontSize: '18px', fontWeight: 700, color: COLORS.yellow }}>
                                    {latestCommodities.bar?.toFixed(2)}
                                </div>
                                <div style={{ fontSize: '11px', color: latestCommodities.bar_dod >= 0 ? COLORS.teal : COLORS.red }}>
                                    {latestCommodities.bar_dod >= 0 ? '▲' : '▼'} {Math.abs(latestCommodities.bar_dod || 0).toFixed(2)}%
                                </div>
                            </div>
                            <div style={{ flex: 1, padding: '12px', background: '#161616', borderRadius: '8px', border: '1px solid #222', textAlign: 'center' }}>
                                <div style={{ fontSize: '11px', color: COLORS.text, marginBottom: '4px' }}>Silver Bar (Millions/kg)</div>
                                <div style={{ fontSize: '18px', fontWeight: 700, color: COLORS.blue }}>
                                    {latestCommodities.silver_kg?.toFixed(2)}
                                </div>
                                <div style={{ fontSize: '11px', color: latestCommodities.silver_dod >= 0 ? COLORS.teal : COLORS.red }}>
                                    {latestCommodities.silver_dod >= 0 ? '▲' : '▼'} {Math.abs(latestCommodities.silver_dod || 0).toFixed(2)}%
                                </div>
                            </div>
                        </div>
                    )}
                    <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={goldSeries}>
                                <CartesianGrid stroke="#222" vertical={false} strokeDasharray="3 3" />
                                <XAxis dataKey="date" stroke={COLORS.text} fontSize={10} tickFormatter={axisDate} minTickGap={20} />
                                <YAxis domain={['auto', 'auto']} stroke={COLORS.text} fontSize={10} tickFormatter={v => v.toLocaleString()} width={40} />
                                <Tooltip
                                    contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontSize: '11px' }}
                                    formatter={(v, name, props) => {
                                        const unit = props.dataKey.includes('silver') ? '' : ''; // In Millions
                                        const dodKey = `${props.dataKey}_dod`;
                                        const dod = props.payload[dodKey];
                                        const dodText = dod !== undefined ? ` (${dod >= 0 ? '+' : ''}${dod.toFixed(2)}%)` : '';
                                        return [`${v.toLocaleString()}${unit}${dodText}`, name];
                                    }}
                                    labelFormatter={formatDate}
                                />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                {goldSilverSelection.includes('bar') && <Line type="monotone" dataKey="bar" name="Gold Bar" stroke={COLORS.yellow} dot={false} strokeWidth={2} connectNulls />}
                                {goldSilverSelection.includes('ring') && <Line type="monotone" dataKey="ring" name="9999 Ring" stroke={COLORS.teal} dot={false} strokeWidth={2} connectNulls />}
                                {goldSilverSelection.includes('silver_bar') && <Line type="monotone" dataKey="silver_bar" name="Silver Bar" stroke={COLORS.blue} dot={false} strokeWidth={2} connectNulls />}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '14px', color: COLORS.white }}>Deposit Rates</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: COLORS.text }}>Deposit interest rate (% p.a.) - Quoted on website</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <div style={{ display: 'flex', gap: '4px', background: '#1a1a1a', padding: '2px', borderRadius: '4px' }}>
                                {['Retail', 'Institution'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setDataSource(type)}
                                        style={{
                                            border: `1px solid ${dataSource === type ? COLORS.border : 'transparent'}`,
                                            background: dataSource === type ? '#222' : 'transparent',
                                            color: dataSource === type ? COLORS.white : COLORS.text,
                                            fontSize: '10px',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >{type}</button>
                                ))}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', background: '#1a1a1a', padding: '2px', borderRadius: '4px', flexWrap: 'wrap' }}>
                                {['1M', '3M', '6M', '9M', '12M', '18M', '24M'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setDepositTenor(t)}
                                        style={{
                                            border: 'none',
                                            background: depositTenor === t ? COLORS.teal : 'transparent',
                                            color: depositTenor === t ? COLORS.white : COLORS.text,
                                            fontSize: '10px',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >{t}</button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Bank Chips */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1rem', maxHeight: '60px', overflowY: 'auto', padding: '2px' }}>
                        {availableBanks.map(b => (
                            <button
                                key={b}
                                onClick={() => toggleBank(b)}
                                style={{
                                    border: `1px solid ${selectedBanks.includes(b) ? BANK_COLORS[b] || COLORS.teal : COLORS.border}`,
                                    background: selectedBanks.includes(b) ? (BANK_COLORS[b] || COLORS.teal) + '22' : 'transparent',
                                    color: selectedBanks.includes(b) ? COLORS.white : COLORS.text,
                                    fontSize: '10px',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.1s'
                                }}
                            >{b}</button>
                        ))}
                    </div>

                    <div style={{ height: '220px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={depositSeries}>
                                <CartesianGrid stroke="#222" vertical={false} strokeDasharray="3 3" />
                                <XAxis dataKey="date" stroke={COLORS.text} fontSize={10} tickFormatter={axisDate} minTickGap={20} />
                                <YAxis
                                    domain={[
                                        dataMin => Math.max(0, dataMin - 1),
                                        dataMax => dataMax + 1
                                    ]}
                                    stroke={COLORS.text}
                                    fontSize={10}
                                    tickFormatter={v => `${v}%`}
                                    width={40}
                                />
                                <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontSize: '11px' }} formatter={v => `${v}%`} labelFormatter={formatDate} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                {selectedBanks.map(bank => (
                                    <Line
                                        key={bank}
                                        type="monotone"
                                        dataKey={bank}
                                        stroke={BANK_COLORS[bank] || '#888'}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                        connectNulls
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Liquidity and Interbank */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.5rem', background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '14px', color: COLORS.white }}>State Treasury, OMO & CITAD</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: COLORS.text }}>Liquidity injection/absorption (Billion VND)</p>
                        </div>
                        <div style={{ fontSize: '10px', color: COLORS.text, opacity: 0.8 }}>Latest: {formatDate(latestDates.liquidity) || '-'}</div>
                    </div>
                    <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={treasurySeries}>
                                <defs>
                                    <linearGradient id="colorTreasury" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.teal} stopOpacity={0.15} />
                                        <stop offset="95%" stopColor={COLORS.teal} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="#222" vertical={false} strokeDasharray="3 3" />
                                <XAxis dataKey="date" stroke={COLORS.text} fontSize={10} tickFormatter={axisDate} minTickGap={20} />
                                <YAxis stroke={COLORS.text} fontSize={10} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} domain={[d => Math.floor(d * 1.2), d => Math.ceil(d * 1.2)]} width={45} />
                                <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontSize: '11px' }} formatter={v => v.toLocaleString()} labelFormatter={formatDate} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} iconType="circle" />
                                <Area type="monotone" dataKey="State Treasury" stroke={COLORS.teal} fill="url(#colorTreasury)" strokeWidth={2} dot={false} connectNulls />
                                <Area type="monotone" dataKey="OMO" stroke={COLORS.yellow} fill="transparent" strokeWidth={2} dot={false} connectNulls />
                                <Area type="monotone" dataKey="CITAD" stroke={COLORS.blue} fill="transparent" strokeWidth={2} dot={false} connectNulls />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '14px', color: COLORS.white }}>Interbank Rates</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '11px', color: COLORS.text }}>Overnight to 1-Year interbank rates (% p.a.)</p>
                        </div>
                        <div style={{ fontSize: '10px', color: COLORS.text, opacity: 0.8 }}>Latest: {formatDate(latestDates.interbank) || '-'}</div>
                    </div>
                    <div style={{ height: '280px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={interbankSeries}>
                                <CartesianGrid stroke="#222" vertical={false} strokeDasharray="3 3" />
                                <XAxis dataKey="date" stroke={COLORS.text} fontSize={10} tickFormatter={axisDate} minTickGap={20} />
                                <YAxis
                                    domain={[
                                        dataMin => Math.max(0, dataMin - 1),
                                        dataMax => dataMax + 1
                                    ]}
                                    stroke={COLORS.text}
                                    fontSize={10}
                                    tickFormatter={v => `${Number(v).toFixed(1)}%`}
                                    width={40}
                                />
                                <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontSize: '11px' }} formatter={v => `${v}%`} labelFormatter={formatDate} />
                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} iconType="circle" />
                                <Line type="monotone" dataKey="O/N" stroke={COLORS.red} strokeWidth={2.5} dot={false} connectNulls />
                                <Line type="monotone" dataKey="1W" stroke={COLORS.teal} strokeWidth={2.5} dot={false} connectNulls />
                                <Line type="monotone" dataKey="1M" stroke={COLORS.blue} strokeWidth={2.5} dot={false} connectNulls />
                                <Line type="monotone" dataKey="1Y" stroke={COLORS.purple} strokeWidth={2.5} dot={false} connectNulls />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .card { border-radius: 12px; transition: all 0.2s ease; }
                .card:hover { border-color: #333 !important; }
            `}</style>
        </div>
    );
}
