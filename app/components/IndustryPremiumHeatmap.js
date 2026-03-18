'use client';

import React, { useState, useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

export default function IndustryPremiumHeatmap({ data }) {
    const [selectedMetric, setSelectedMetric] = useState('PRICE_CHG_PCT_CR_1M');

    const metrics = [
        { id: 'PRICE_CHG_PCT_CR_1M', label: '1-Month %', color: '#10b981' },
        { id: 'PRICE_TO_EARNINGS', label: 'P/E Ratio', color: '#3b82f6' },
        { id: 'PRICE_CHG_PCT_CR_1W', label: '1-Week %', color: '#f59e0b' }
    ];

    const chartData = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        return data.map(ind => ({
            name: ind.nameVn || ind.nameEn,
            shortName: (ind.nameVn || ind.nameEn).split(' ').map(w => w[0]).join(''),
            value: ind.metrics[selectedMetric] || 0,
            allMetrics: ind.metrics
        })).sort((a, b) => b.value - a.value);
    }, [data, selectedMetric]);

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[300px] border border-gray-900 rounded-2xl bg-[#0d1117]/20">
                <span className="text-[10px] text-gray-700 font-black uppercase tracking-widest">Awaiting Sector Intelligence...</span>
            </div>
        );
    }

    const currentMetric = metrics.find(m => m.id === selectedMetric);

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload;
            return (
                <div className="bg-[#111] border border-gray-800 p-4 rounded-xl shadow-2xl backdrop-blur-xl">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2 border-b border-gray-800 pb-2">{label}</p>
                    <div className="space-y-2">
                        <div className="flex justify-between gap-8 items-center">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">1M Performance</span>
                            <span className={`text-[11px] font-black ${d.allMetrics.PRICE_CHG_PCT_CR_1M >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {d.allMetrics.PRICE_CHG_PCT_CR_1M?.toFixed(2)}%
                            </span>
                        </div>
                        <div className="flex justify-between gap-8 items-center">
                            <span className="text-[10px] text-gray-400 font-bold uppercase">P/E Valuation</span>
                            <span className="text-[11px] font-black text-blue-500">
                                {d.allMetrics.PRICE_TO_EARNINGS?.toFixed(2)}x
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
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 p-1 bg-gray-950/50 border border-gray-900 rounded-lg">
                    {metrics.map(m => (
                        <button
                            key={m.id}
                            onClick={() => setSelectedMetric(m.id)}
                            className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-md transition-all duration-300 ${selectedMetric === m.id
                                ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                : 'text-gray-600 hover:text-gray-400'
                                }`}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] text-gray-700 font-black uppercase tracking-widest">Real-time Attribution</span>
                </div>
            </div>

            {/* Premium Chart Container */}
            <div style={{ height: '450px', width: '100%' }} className="relative overflow-hidden rounded-3xl border border-gray-900/50 bg-gradient-to-b from-[#0d1117]/40 to-transparent p-6">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 0, right: 40, left: 40, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#111" />
                        <XAxis
                            type="number"
                            hide
                        />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={140}
                            tick={{ fontSize: 9, fill: '#444', fontWeight: 900, textTransform: 'uppercase' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ fill: '#ffffff05' }}
                        />
                        <Bar
                            dataKey="value"
                            isAnimationActive={true}
                            animationDuration={1500}
                            radius={[0, 4, 4, 0]}
                            barSize={12}
                        >
                            {chartData.map((entry, index) => {
                                const val = parseFloat(entry.value);
                                let color = '#222';
                                if (selectedMetric === 'PRICE_TO_EARNINGS') {
                                    color = val < 15 ? '#3b82f6' : '#1d4ed8'; // Blue for valuation
                                } else {
                                    color = val >= 0 ? '#10b981' : '#f43f5e';
                                }
                                return (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={color}
                                        fillOpacity={0.8}
                                        className="transition-all duration-500"
                                    />
                                );
                            })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>

                {/* Background Texture Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_50%,#10b98105,transparent_70%)]"></div>
            </div>

            {/* Visual Legend */}
            <div className="flex items-center justify-end gap-6 px-4">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm bg-emerald-500"></div>
                    <span className="text-[8px] text-gray-700 font-bold uppercase tracking-widest">Outperforming</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm bg-rose-500"></div>
                    <span className="text-[8px] text-gray-700 font-bold uppercase tracking-widest">Underperforming</span>
                </div>
            </div>
        </div>
    );
}
