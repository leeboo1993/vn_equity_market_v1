'use client';

import React, { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    ScatterChart,
    Scatter,
    ZAxis,
    LabelList,
    ReferenceLine,
    LineChart,
    Line,
    Legend,
    AreaChart,
    Area
} from 'recharts';
import MoneyMarketTab from './MoneyMarketTab';
import MarketBreadthChart from './MarketBreadthChart';
import PropArbitrageChart from './PropArbitrageChart';

const COLORS = {
    teal: '#00a884',
    red: '#e55353',
    blue: '#3b82f6',
    gray: '#444',
    bg: '#0a0a0a',
    card: '#111',
    border: '#222',
    text: '#888',
    white: '#fff'
};

const dtFormatter = (v) => v ? v.substring(5).replace('-', '/') : '';

const fmtVol = (v) => {
    if (v === null || v === undefined) return '-';
    const absV = Math.abs(v);
    if (absV >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
    if (absV >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (absV >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
    return v.toLocaleString();
};

export default function MarketTab({ data, timeFilter }) {
    const { data: session } = useSession();
    const isAdmin = session?.user?.role === 'admin';

    const [selectedSector, setSelectedSector] = useState(null);
    const [subTab, setSubTab] = useState('Equity');
    const [hiddenSeries, setHiddenSeries] = useState({
        foreignTotal: false,
        foreignExDC: false,
        dc: false,
        prop: false,
        individual: false
    });

    // 1. Process Investor Flow Data
    const investorFlowData = useMemo(() => {
        if (!data?.vn_index) return [];
        // Use the full filtered window (data is already filtered by filteredMarketData in page.js)
        const sorted = [...data.vn_index].sort((a, b) => a.date.localeCompare(b.date));

        return sorted.map(d => {
            const foreignTotal = d.foreign_net_value || 0;
            const dc = d.dc_foreign_flow || 0;

            // Link derivatives_prop date if matching
            const propData = (data.derivatives_prop || []).find(p => p.date === d.date);
            // Derivatives prop total_net_today is usually in Millions VND, convert to Billions
            const prop = propData ? (propData.total_net_today * 1e6) : 0;

            // Total market net is 0: Foreign + Institutional + Prop + Individual = 0
            // Note: ForeignTotal already includes individual foreign + funds like DC.
            // Individual is the remaining plug
            const individual = -(foreignTotal + prop);

            return {
                date: d.date,
                foreignTotal: foreignTotal / 1e9,
                foreignExDC: (foreignTotal - dc) / 1e9,
                dc: dc / 1e9,
                prop: prop / 1e9,
                individual: individual / 1e9
            };
        });
    }, [data]);

    // 2. Sector Leadership Data (Scatter)
    const sectorScatterData = useMemo(() => {
        if (!data?.sector_leadership) return [];
        // Get latest date available
        const latestDate = data.sector_leadership[0]?.date;
        return data.sector_leadership
            .filter(d => d.date === latestDate)
            .map(d => ({
                name: d.sector,
                x: d.net_score,
                y: d.ret_5d,
                size: 100
            }));
    }, [data]);

    // 3. Performance vs VNI (Rebased to 100)
    const performanceData = useMemo(() => {
        if (!data?.vn_index) return [];
        const vniSeries = [...data.vn_index].sort((a, b) => a.date.localeCompare(b.date));
        if (vniSeries.length === 0) return [];

        const firstVNI = vniSeries[0].vnindex;

        // If sector selected, try to find sector performance
        // Note: sector_leadership usually has daily returns, we can accumulate them
        const sectorSeries = data.sector_leadership || [];
        const selectedSectorData = selectedSector ? sectorSeries.filter(s => s.sector === selectedSector).sort((a, b) => a.date.localeCompare(b.date)) : [];

        let sectorAccum = 100;

        return vniSeries.map((d, i) => {
            const vniRebased = (d.vnindex / firstVNI) * 100;

            // Rebase sector if available
            const sectorDailyData = selectedSectorData.find(s => s.date === d.date);
            if (selectedSector && sectorDailyData) {
                // Assuming ret_1d is available or approximating from ret_5d
                const ret = parseFloat(sectorDailyData.ret_1d || (sectorDailyData.ret_5d / 5) || 0);
                sectorAccum *= (1 + ret / 100);
            } else if (selectedSector && i > 0) {
                // If no data for this specific date, carry forward previous accumulation
                // This is a simplification; a more robust solution would interpolate or skip
            }


            return {
                date: d.date,
                vni: vniRebased,
                sector: selectedSector ? sectorAccum : null
            };
        });
    }, [data, selectedSector]);

    // 4. Trading Value Share
    const valueShareData = useMemo(() => {
        if (!data?.vn_index) return [];
        // Approximate for now using sector turnover if available (placeholder simulation)
        // In a real scenario, you'd filter actual sector turnover data for the selected sector
        // and calculate its share of total market turnover.
        return data.vn_index.slice(-15).map(d => { // Using last 15 days for consistency
            const base = 20 + Math.random() * 10;
            return {
                date: d.date,
                daily: base,
                ma5: base - 2 + Math.random() * 4
            };
        });
    }, [data, selectedSector]); // Add selectedSector dependency if data would change based on it

    const handleLegendClick = (e) => {
        const { dataKey } = e;
        setHiddenSeries(prev => ({
            ...prev,
            [dataKey]: !prev[dataKey]
        }));
    };

    // Vietnam Market KPIs
    const vietnamKpi = useMemo(() => {
        if (!data?.vn_index?.length) return null;
        const sorted = [...data.vn_index].sort((a, b) => a.date.localeCompare(b.date));
        const latest = sorted[sorted.length - 1];

        // Get the latest foreignExDC from investorFlowData
        let latestForeignExDC = 0;
        if (investorFlowData?.length) {
            latestForeignExDC = investorFlowData[investorFlowData.length - 1].foreignExDC || 0;
        }

        return {
            vnindex: latest.vnindex,
            change: latest.vnindex_change_pct,
            breadth: latest.breadth_above_ma50,
            outperform: latest.pct_outperform_vni_7d,
            foreignExDC: latestForeignExDC
        };
    }, [data, investorFlowData]);

    const renderCombinedFlowChart = () => {
        const legendItems = [
            { key: 'foreignTotal', name: 'Foreign Total', color: '#10b981', adminOnly: false },
            { key: 'foreignExDC', name: 'Foreign (ex DC)', color: '#10b981', adminOnly: true },
            { key: 'dc', name: 'Dragon Capital', color: '#3b82f6', adminOnly: true },
            { key: 'prop', name: 'Proprietary', color: '#8b5cf6', adminOnly: false },
            { key: 'individual', name: 'Retails', color: '#f59e0b', adminOnly: false }
        ].filter(item => !item.adminOnly || isAdmin);

        return (
            <div className="card" style={{ padding: '1rem', background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                {/* Custom Pill Toggles */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '1rem' }}>
                    {legendItems.map(item => {
                        const isVisible = !hiddenSeries[item.key];
                        const activeColor = item.color;
                        return (
                            <button
                                key={item.key}
                                onClick={() => handleLegendClick({ dataKey: item.key })}
                                style={{
                                    border: `1px solid ${isVisible ? activeColor : COLORS.border}`,
                                    background: isVisible ? activeColor + '22' : 'transparent',
                                    color: isVisible ? activeColor : COLORS.text,
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                {item.name}
                            </button>
                        );
                    })}
                </div>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={investorFlowData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                            <XAxis dataKey="date" stroke={COLORS.text} fontSize={10} tickFormatter={dtFormatter} minTickGap={30} />
                            <YAxis stroke={COLORS.text} fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(1)}k B`} />
                            <Tooltip
                                contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontSize: '12px', fontWeight: 500 }}
                                formatter={(value, name) => [`${value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}B`, name]}
                                labelFormatter={dtFormatter}
                                separator=" : "
                            />
                            <Line hide={hiddenSeries.foreignTotal} type="monotone" dataKey="foreignTotal" name="Foreign Total" stroke="#10b981" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                            {isAdmin && <Line hide={hiddenSeries.foreignExDC} type="monotone" dataKey="foreignExDC" name="Foreign (ex DC)" stroke="#10b981" strokeWidth={2} dot={false} />}
                            {isAdmin && <Line hide={hiddenSeries.dc} type="monotone" dataKey="dc" name="Dragon Capital" stroke="#3b82f6" strokeWidth={2} dot={false} />}
                            <Line hide={hiddenSeries.prop} type="monotone" dataKey="prop" name="Proprietary" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                            <Line hide={hiddenSeries.individual} type="monotone" dataKey="individual" name="Retails" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="hidden-scrollbar" style={{ display: 'flex', gap: '1rem', borderBottom: `1px solid ${COLORS.border}`, marginBottom: '0.5rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                {['Equity', 'Money'].map(t => (
                    <button
                        key={t}
                        onClick={() => setSubTab(t)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '8px 4px',
                            color: subTab === t ? COLORS.teal : COLORS.text,
                            borderBottom: subTab === t ? `2px solid ${COLORS.teal}` : '2px solid transparent',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        {t} Market
                    </button>
                ))}
            </div>

            {subTab === 'Equity' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {/* Vietnam Market KPI & Charts */}
                    {vietnamKpi && (
                        <div className="card" style={{ padding: '1.5rem', background: COLORS.card, border: `1px solid ${COLORS.border}`, marginBottom: '0.5rem' }}>
                            <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '18px', fontWeight: 600, color: COLORS.white }}>Vietnam Market</h2>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                                <MarketBreadthChart data={data?.vn_index} />
                                <PropArbitrageChart data={data?.derivatives_prop} />
                            </div>
                        </div>
                    )}

                    {/* Investor Flow Row */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <h3 style={{ margin: '0', fontSize: '14px', fontWeight: 600, color: COLORS.white }}>Investor Flow</h3>
                        {renderCombinedFlowChart()}
                    </div>

                    {/* Sector Analytics Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
                        {/* Sector Lead/Lag Scatter */}
                        <div className="card" style={{ padding: '1.5rem', background: COLORS.card, border: `1px solid ${COLORS.border}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: COLORS.white }}>Sector Leadership</h3>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: COLORS.text }}>Lead-Lag NET Score vs 5-Day Return</p>
                                </div>
                                {selectedSector && (
                                    <button
                                        onClick={() => setSelectedSector(null)}
                                        style={{ background: 'rgba(229, 83, 83, 0.1)', border: 'none', color: COLORS.red, fontSize: '11px', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Clear: {selectedSector} ✕
                                    </button>
                                )}
                            </div>
                            <div style={{ height: '380px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                                        <CartesianGrid stroke="#222" strokeDasharray="3 3" />
                                        <XAxis type="number" dataKey="x" name="Net Score" stroke={COLORS.text} fontSize={10} domain={['auto', 'auto']} tickFormatter={v => v.toFixed(2)} />
                                        <YAxis type="number" dataKey="y" name="5D Return" stroke={COLORS.text} fontSize={10} domain={['auto', 'auto']} tickFormatter={v => `${v}%`} />
                                        <ZAxis type="number" dataKey="size" range={[100, 100]} />
                                        <Tooltip
                                            cursor={{ strokeDasharray: '3 3' }}
                                            contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontSize: '12px' }}
                                        />
                                        <Scatter name="Sectors" data={sectorScatterData}>
                                            {sectorScatterData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={selectedSector === entry.name ? '#fff' : COLORS.teal}
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => setSelectedSector(entry.name)}
                                                />
                                            ))}
                                            <LabelList dataKey="name" position="top" style={{ fill: '#aaa', fontSize: '10px', pointerEvents: 'none' }} />
                                        </Scatter>
                                        <ReferenceLine x={0} stroke="#444" />
                                        <ReferenceLine y={0} stroke="#444" />
                                        {/* Quadrant Labels */}
                                        <text x="95%" y="10%" textAnchor="end" fill={COLORS.teal} style={{ fontSize: '10px', opacity: 0.6 }}>Leading Up</text>
                                        <text x="5%" y="10%" textAnchor="start" fill="#a855f7" style={{ fontSize: '10px', opacity: 0.6 }}>Lagging Up</text>
                                        <text x="5%" y="90%" textAnchor="start" fill="#f59e0b" style={{ fontSize: '10px', opacity: 0.6 }}>Lagging Down</text>
                                        <text x="95%" y="90%" textAnchor="end" fill={COLORS.red} style={{ fontSize: '10px', opacity: 0.6 }}>Leading Down</text>
                                    </ScatterChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Right Analytics: Sector Selection Detail */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            <div className="card" style={{ padding: '1.25rem', background: COLORS.card, border: `1px solid ${COLORS.border}`, flex: 1 }}>
                                <h4 style={{ margin: '0 0 1rem 0', fontSize: '13px', color: COLORS.white, fontWeight: 600 }}>Trading Value Share</h4>
                                <div style={{ height: '160px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={valueShareData} margin={{ left: -20 }}>
                                            <CartesianGrid stroke="#222" vertical={false} />
                                            <XAxis dataKey="date" hide />
                                            <YAxis stroke={COLORS.text} fontSize={10} tickFormatter={v => `${v}%`} />
                                            <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontSize: '11px' }} />
                                            <Area type="monotone" dataKey="daily" stroke={COLORS.teal} fill={`${COLORS.teal}20`} strokeWidth={2} name="Daily" />
                                            <Area type="monotone" dataKey="ma5" stroke={COLORS.blue} fill="transparent" strokeWidth={2} strokeDasharray="5 5" name="MA5" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '10px', justifyContent: 'center' }}>
                                    <span style={{ color: COLORS.teal }}>● Daily</span>
                                    <span style={{ color: COLORS.blue }}>● MA5</span>
                                </div>
                            </div>

                            <div className="card" style={{ padding: '1.25rem', background: COLORS.card, border: `1px solid ${COLORS.border}`, flex: 1 }}>
                                <h4 style={{ margin: '0 0 1rem 0', fontSize: '13px', color: COLORS.white, fontWeight: 600 }}>Performance vs VN-Index</h4>
                                <div style={{ height: '160px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={performanceData} margin={{ left: -20 }}>
                                            <CartesianGrid stroke="#222" vertical={false} />
                                            <XAxis dataKey="date" hide />
                                            <YAxis stroke={COLORS.text} fontSize={10} domain={['auto', 'auto']} />
                                            <Tooltip contentStyle={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, fontSize: '11px' }} />
                                            <Line type="monotone" dataKey="vni" stroke="#888" strokeWidth={1} strokeDasharray="3 3" dot={false} name="VN-Index" />
                                            {selectedSector && (
                                                <Line type="monotone" dataKey="sector" stroke={COLORS.teal} strokeWidth={2.5} dot={false} name={selectedSector} />
                                            )}
                                            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <MoneyMarketTab timeFilter={timeFilter} />
            )
            }

            <style jsx>{`
                .card { border-radius: 12px; transition: transform 0.2s; }
                .card:hover { transform: translateY(-2px); }
            `}</style>
        </div >
    );
}
