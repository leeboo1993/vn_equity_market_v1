'use client';

import React, { useMemo } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceArea
} from 'recharts';

const REGIME_COLORS = {
    'Bull': '#10b981',
    'Bear': '#ef4444',
    'Neutral': '#9ca3af',
    'Distribution': '#f59e0b',
    'Accumulation': '#3b82f6'
};

const REGIME_BG_COLORS = {
    'Bull': 'rgba(16, 185, 129, 0.1)',
    'Bear': 'rgba(239, 68, 68, 0.1)',
    'Neutral': 'rgba(156, 163, 175, 0.05)',
    'Distribution': 'rgba(245, 158, 11, 0.1)',
    'Accumulation': 'rgba(59, 130, 246, 0.1)'
};

export default function ModelRegimeChart({ history, selectedDate, onDateClick }) {
    if (!history || history.length === 0) {
        return (
            <div style={{ 
                backgroundColor: 'rgba(13, 17, 23, 0.4)', 
                border: '1px solid #111', 
                borderRadius: '24px', 
                padding: '1.5rem', 
                minHeight: '400px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
            }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: '#444', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                        Awaiting Market Sequence...
                    </p>
                </div>
            </div>
        );
    }

    const chartData = useMemo(() => {
        return history.map(item => ({
            ...item,
            formattedDate: item.date.split('-').slice(1).join('/') // MM/DD
        }));
    }, [history]);

    // Create spans of regimes for ReferenceArea
    const regimeAreas = useMemo(() => {
        const areas = [];
        if (chartData.length === 0) return areas;

        let currentRegime = chartData[0].regime;
        let start = chartData[0].date;

        for (let i = 1; i < chartData.length; i++) {
            if (chartData[i].regime !== currentRegime) {
                areas.push({
                    regime: currentRegime,
                    start: start,
                    end: chartData[i - 1].date
                });
                currentRegime = chartData[i].regime;
                start = chartData[i].date;
            }
        }
        
        areas.push({
            regime: currentRegime,
            start: start,
            end: chartData[chartData.length - 1].date
        });

        return areas;
    }, [chartData]);

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-[#0d1117] border border-gray-800 p-3 rounded-lg shadow-2xl backdrop-blur-md">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{data.date}</p>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: REGIME_COLORS[data.regime] }}></div>
                        <span className="text-xs font-black uppercase text-white">{data.regime} Phase</span>
                    </div>
                    <div className="text-xl font-black text-white">
                        {data.price.toLocaleString()}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ 
            backgroundColor: '#0d1117', 
            border: '1px solid rgba(255,255,255,0.05)', 
            borderRadius: '16px', 
            padding: '2.5rem', 
            boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.7)',
            display: 'flex', 
            flexDirection: 'column',
            minHeight: '520px',
            height: '100%'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5em', color: '#10b981', marginBottom: '8px', opacity: 0.8 }}>Market Sequence</h3>
                        <h2 style={{ fontSize: '1.75rem', fontWeight: '900', letterSpacing: '-0.05em', textTransform: 'uppercase', margin: 0, color: '#eee' }}>Regime History</h2>
                    </div>
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', backgroundColor: 'rgba(255,255,255,0.02)', padding: '10px 18px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {Object.entries(REGIME_COLORS).map(([name, color]) => (
                            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 10px ${color}` }}></div>
                                <span style={{ fontSize: '7px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#555' }}>{name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ width: '100%', height: '380px', flex: 1 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                        data={chartData} 
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        onClick={(data) => {
                            if (data && data.activePayload) {
                                onDateClick(data.activePayload[0].payload.date);
                            }
                        }}
                    >
                        <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" strokeOpacity={0.2} />
                        <XAxis 
                            dataKey="date" 
                            hide={false}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#333', fontSize: 8, fontWeight: 700 }}
                            interval="preserveStartEnd"
                            minTickGap={50}
                        />
                        <YAxis 
                            domain={['auto', 'auto']}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#666', fontSize: 10, fontWeight: 700 }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#444', strokeWidth: 1 }} />
                        
                        {regimeAreas.map((area, i) => (
                            <ReferenceArea 
                                key={i}
                                x1={area.start}
                                x2={area.end}
                                fill={REGIME_BG_COLORS[area.regime]}
                                strokeOpacity={0}
                                fillOpacity={0.4}
                            />
                        ))}

                        <Area 
                            type="monotone" 
                            dataKey="price" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorPrice)" 
                            animationDuration={1500}
                            dot={false}
                            activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }}
                        />

                        {selectedDate && (
                            <ReferenceArea 
                                x1={selectedDate} 
                                x2={selectedDate} 
                                stroke="#3b82f6" 
                                strokeWidth={2} 
                                fillOpacity={0}
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(17, 24, 39, 0.5)', paddingTop: '1rem' }}>
                <p style={{ fontSize: '9px', color: '#374151', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.2em', maxWidth: '400px', margin: 0 }}>
                    Shaded areas represent detected market regimes based on 1-month momentum, volatility, and order flow delta.
                </p>
                <div style={{ fontSize: '9px', color: '#111827', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                    Interactive Core V.Regime
                </div>
            </div>
        </div>
    );
}
