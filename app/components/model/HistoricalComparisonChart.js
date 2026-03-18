'use client';

import React, { useMemo, useState } from 'react';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine,
    Area
} from 'recharts';

export default function HistoricalComparisonChart({ history }) {
    const [viewMode, setViewMode] = useState('daily'); // 'daily' | 'cumulative'

    const chartData = useMemo(() => {
        if (!history || history.length === 0) return [];

        // Reverse to show chronological order (API returns newest first)
        const sortedHistory = [...history].reverse();

        let cumActual = 0;
        let cumForecast = 0;

        return sortedHistory.map(row => {
            // Extract forecast percentage: "1,855 (-0.3%)" -> -0.3
            const forecastMatch = row.forecast.match(/\(([+-]?[\d.]+)\%\)/);
            const forecastVal = forecastMatch ? parseFloat(forecastMatch[1]) : 0;

            // Extract actual percentage: "+0.5%" -> 0.5
            const actualMatch = row.actualRet.match(/([+-]?[\d.]+)/);
            const actualVal = actualMatch ? parseFloat(actualMatch[1]) : 0;

            cumActual += actualVal;
            cumForecast += forecastVal;

            return {
                date: row.date.split('/').slice(0, 2).join('/'), // Just DD/MM
                fullDate: row.date,
                forecast: forecastVal,
                actual: actualVal,
                cumActual: parseFloat(cumActual.toFixed(2)),
                cumForecast: parseFloat(cumForecast.toFixed(2)),
                decision: row.decision
            };
        });
    }, [history]);

    if (chartData.length === 0) return null;

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-[#0d1117] border border-gray-800 p-3 rounded-lg shadow-2xl backdrop-blur-md">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 border-b border-gray-800 pb-1">
                        {payload[0].payload.fullDate}
                    </p>
                    <div className="space-y-1.5">
                        {payload.map((entry, index) => (
                            <div key={index} className="flex justify-between items-center gap-4">
                                <span className="text-[10px] font-bold text-gray-400 uppercase">{entry.name}:</span>
                                <span className={`text-xs font-black ${entry.value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {entry.value > 0 ? '+' : ''}{entry.value}%
                                </span>
                            </div>
                        ))}
                        <div className="mt-2 pt-2 border-t border-gray-800 flex justify-between items-center gap-4">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Decision:</span>
                            <span className="text-[10px] font-black text-blue-500 uppercase">{payload[0].payload.decision}</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ 
            backgroundColor: 'rgba(13, 17, 23, 0.4)', 
            border: '1px solid #111', 
            borderRadius: '24px', 
            padding: '1.5rem', 
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h3 style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.3em', color: '#10b981', marginBottom: '4px' }}>Alpha Tracking</h3>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '900', letterSpacing: '-0.02em', textTransform: 'uppercase', margin: 0 }}>Call vs Actual Return</h2>
                    </div>
                    
                    <div style={{ display: 'flex', backgroundColor: '#111', padding: '4px', borderRadius: '12px', border: '1px solid #1f2937' }}>
                        <button 
                            onClick={() => setViewMode('daily')}
                            style={{ 
                                padding: '6px 16px', 
                                borderRadius: '8px', 
                                fontSize: '10px', 
                                fontWeight: '900', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.05em',
                                transition: 'all 0.2s',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: viewMode === 'daily' ? '#10b981' : 'transparent',
                                color: viewMode === 'daily' ? '#000' : '#6b7280',
                                boxShadow: viewMode === 'daily' ? '0 0 15px rgba(16, 185, 129, 0.3)' : 'none'
                            }}
                        >
                            Daily
                        </button>
                        <button 
                            onClick={() => setViewMode('cumulative')}
                            style={{ 
                                padding: '6px 16px', 
                                borderRadius: '8px', 
                                fontSize: '10px', 
                                fontWeight: '900', 
                                textTransform: 'uppercase', 
                                letterSpacing: '0.05em',
                                transition: 'all 0.2s',
                                border: 'none',
                                cursor: 'pointer',
                                backgroundColor: viewMode === 'cumulative' ? '#10b981' : 'transparent',
                                color: viewMode === 'cumulative' ? '#000' : '#6b7280',
                                boxShadow: viewMode === 'cumulative' ? '0 0 15px rgba(16, 185, 129, 0.3)' : 'none'
                            }}
                        >
                            Accumulated
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1f2937" strokeOpacity={0.5} />
                        <XAxis 
                            dataKey="date" 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 700 }}
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 700 }}
                            tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#374151', strokeWidth: 1 }} />
                        <Legend 
                            verticalAlign="top" 
                            align="right" 
                            height={36}
                            content={({ payload }) => (
                                <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginBottom: '16px' }}>
                                    {payload.map((entry, index) => (
                                        <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }}></div>
                                            <span style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}>{entry.value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        />
                        <ReferenceLine y={0} stroke="#374151" strokeWidth={1} />
                        
                        {viewMode === 'daily' ? (
                            <>
                                <Bar 
                                    name="Actual" 
                                    dataKey="actual" 
                                    fill="#10b981" 
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={30}
                                />
                                <Line 
                                    name="Forecast" 
                                    type="monotone" 
                                    dataKey="forecast" 
                                    stroke="#3b82f6" 
                                    strokeWidth={3}
                                    dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                                    activeDot={{ r: 5, strokeWidth: 0 }}
                                />
                            </>
                        ) : (
                            <>
                                <Area 
                                    name="Cum. Actual" 
                                    type="monotone" 
                                    dataKey="cumActual" 
                                    stroke="#10b981" 
                                    fillOpacity={1} 
                                    fill="url(#colorActual)" 
                                    strokeWidth={3}
                                />
                                <Area 
                                    name="Cum. Forecast" 
                                    type="monotone" 
                                    dataKey="cumForecast" 
                                    stroke="#3b82f6" 
                                    fillOpacity={1} 
                                    fill="url(#colorForecast)" 
                                    strokeWidth={3}
                                />
                            </>
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(17, 24, 39, 0.5)', paddingTop: '1rem' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                        <span style={{ fontSize: '9px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Market Reality</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
                        <span style={{ fontSize: '9px', fontWeight: '700', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Model Projection</span>
                    </div>
                </div>
                <div style={{ fontSize: '9px', color: '#111827', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                    Sample Size: {history.length} Days
                </div>
            </div>
        </div>
    );
}
