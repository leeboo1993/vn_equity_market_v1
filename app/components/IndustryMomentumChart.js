'use client';

import React, { useMemo } from 'react';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    ZAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from 'recharts';

export default function IndustryMomentumChart({ data }) {
    const chartData = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        return data.map(ind => ({
            name: ind.nameVn || ind.nameEn,
            pe: parseFloat(ind.metrics.PRICE_TO_EARNINGS) || 0,
            perf1m: parseFloat(ind.metrics.PRICE_CHG_PCT_CR_1M) || 0,
            perf1w: parseFloat(ind.metrics.PRICE_CHG_PCT_CR_1W) || 0,
            size: Math.abs(parseFloat(ind.metrics.PRICE_CHG_PCT_CR_1M)) * 2 + 5 // Bubble size based on performance magnitude
        })).filter(d => d.pe > 0 && d.pe < 100); // Filter outliers for a better visual spread
    }, [data]);

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[300px] border border-gray-900 rounded-2xl bg-[#0d1117]/20">
                <span className="text-[10px] text-gray-700 font-black uppercase tracking-widest">Calibrating Momentum Matrix...</span>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload;
            return (
                <div className="bg-[#111] border border-gray-800 p-4 rounded-xl shadow-2xl backdrop-blur-xl">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 border-b border-gray-800 pb-2">{d.name}</p>
                    <div className="space-y-2">
                        <div className="flex justify-between gap-8 items-center">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Valuation (P/E)</span>
                            <span className="text-[11px] font-black text-blue-500">{d.pe.toFixed(2)}x</span>
                        </div>
                        <div className="flex justify-between gap-8 items-center">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">1M Return</span>
                            <span className={`text-[11px] font-black ${d.perf1m >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {d.perf1m.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Sector Momentum Matrix</h3>
                    <p className="text-[9px] text-gray-700 font-bold uppercase tracking-tighter">Valuation P/E vs. 1-Month Return</p>
                </div>
            </div>

            <div style={{ height: '450px', width: '100%' }} className="border border-gray-900/50 bg-[#0a0a0a] rounded-3xl p-6 relative">
                {/* Quadrant Labels */}
                <div className="absolute top-8 right-8 text-[8px] font-black text-emerald-500/20 uppercase tracking-widest border border-emerald-500/10 px-2 py-1 rounded">High Value / High Growth</div>
                <div className="absolute top-8 left-8 text-[8px] font-black text-blue-500/20 uppercase tracking-widest border border-blue-500/10 px-2 py-1 rounded">Under-Valued / Growth</div>
                <div className="absolute bottom-8 left-8 text-[8px] font-black text-gray-700/20 uppercase tracking-widest border border-gray-800 px-2 py-1 rounded">Value Trap</div>
                <div className="absolute bottom-8 right-8 text-[8px] font-black text-rose-500/20 uppercase tracking-widest border border-rose-500/10 px-2 py-1 rounded">Over-Valued / Laggard</div>

                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#111" />
                        <XAxis
                            type="number"
                            dataKey="pe"
                            name="P/E"
                            stroke="#333"
                            fontSize={9}
                            tickFormatter={v => `${v}x`}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            type="number"
                            dataKey="perf1m"
                            name="1M Return"
                            stroke="#333"
                            fontSize={9}
                            tickFormatter={v => `${v}%`}
                            axisLine={false}
                            tickLine={false}
                        />
                        <ZAxis type="number" dataKey="size" range={[50, 400]} />
                        <Tooltip content={<CustomTooltip />} />

                        <ReferenceLine x={15} stroke="#222" strokeDasharray="5 5" />
                        <ReferenceLine y={0} stroke="#222" strokeDasharray="5 5" />

                        <Scatter name="Industries" data={chartData}>
                            {chartData.map((entry, index) => {
                                let color = '#444';
                                if (entry.pe < 15 && entry.perf1m > 0) color = '#10b981'; // Undervalued Leader
                                else if (entry.pe >= 15 && entry.perf1m > 0) color = '#3b82f6'; // Growth
                                else if (entry.pe >= 15 && entry.perf1m <= 0) color = '#f43f5e'; // Overvalued Laggard
                                else color = '#6b7280'; // Value Trap / Other

                                return (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={color}
                                        fillOpacity={0.6}
                                        stroke={color}
                                        strokeWidth={1}
                                        className="transition-all duration-700 hover:fill-opacity-100 cursor-pointer shadow-lg"
                                    />
                                );
                            })}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>

            <div className="flex justify-center gap-8 mt-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[8px] text-gray-700 font-bold uppercase tracking-widest italic">Core Opportunity</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-[8px] text-gray-700 font-bold uppercase tracking-widest italic">Growth Narrative</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                    <span className="text-[8px] text-gray-700 font-bold uppercase tracking-widest italic">Risk Overlay</span>
                </div>
            </div>
        </div>
    );
}
