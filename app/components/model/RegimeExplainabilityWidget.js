'use client';

import React, { useMemo } from 'react';
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

export default function RegimeExplainabilityWidget({ features, regime }) {
    const chartData = useMemo(() => {
        if (!features) return [];

        return Object.entries(features)
            .filter(([, value]) => value !== null && value !== undefined)
            .map(([name, value]) => ({
                name: name.replace(/_/g, ' '),
                value: typeof value === 'number' ? parseFloat(value.toFixed(2)) : 0,
                color: value > 0 ? '#10b981' : '#ef4444'
            }))
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    }, [features]);

    if (chartData.length === 0) {
        return (
            <div style={{ 
                backgroundColor: 'rgba(13, 17, 23, 0.4)', 
                border: '1px solid #111', 
                borderRadius: '24px', 
                padding: '1.5rem', 
                minHeight: '450px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
            }}>
                <p style={{ color: '#4b5563', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center' }}>
                    Feature influence data <br/> unavailable for this cycle
                </p>
            </div>
        );
    }

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div style={{ 
                    backgroundColor: '#0d1117', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <p style={{ fontSize: '9px', fontWeight: '900', color: '#666', uppercase: 'true', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '0 0 6px 0' }}>{data.name}</p>
                    <div style={{ fontSize: '14px', fontWeight: '900', color: data.value >= 0 ? '#10b981' : '#ef4444' }}>
                        Z-Shift: {data.value > 0 ? '+' : ''}{data.value}
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
            minHeight: '520px', 
            display: 'flex', 
            flexDirection: 'column',
            height: '100%'
        }}>
            <div style={{ marginBottom: '3rem' }}>
                <h3 style={{ fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.5em', color: '#f59e0b', marginBottom: '8px', opacity: 0.8 }}>Explainability</h3>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '900', letterSpacing: '-0.05em', textTransform: 'uppercase', margin: 0, color: '#eee', whiteSpace: 'nowrap' }}>
                    Phase Drivers <span style={{ color: '#333', marginLeft: '12px' }}>[{regime}]</span>
                </h2>
            </div>

            <div style={{ flex: 1, width: '100%', minHeight: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                        barSize={10}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#333" strokeOpacity={0.2} />
                        <XAxis type="number" hide domain={['auto', 'auto']} />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={110} 
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#555', fontSize: 8, fontWeight: 800 }}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                        <Bar 
                            dataKey="value" 
                            radius={[0, 4, 4, 0]}
                            animationDuration={1500}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.03)' }}>
                <p style={{ fontSize: '8px', color: '#333', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.15em', margin: 0, lineHeight: 1.6 }}>
                    Statistical Z-shift from annual baseline. Positive drivers push for Bullish expansion.
                </p>
            </div>
        </div>
    );
}
