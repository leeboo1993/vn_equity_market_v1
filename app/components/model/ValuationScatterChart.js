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
    Cell,
    LabelList
} from 'recharts';

/**
 * Premium Valuation Scatter Chart
 * X-axis: Valuation Metric (P/E or P/B)
 * Y-axis: Performance Metric (Return % or ROE)
 */

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div style={{ 
                backgroundColor: 'rgba(10, 10, 10, 0.95)', 
                border: '1px solid #333', 
                padding: '12px', 
                borderRadius: '8px',
                color: '#fff', 
                fontSize: '11px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(4px)'
            }}>
                <div style={{ fontWeight: '700', marginBottom: '8px', color: '#00ffcc', borderBottom: '1px solid #222', paddingBottom: '4px' }}>
                    {data.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '4px' }}>
                    <span style={{ color: '#888' }}>Valuation (P/E):</span>
                    <span style={{ fontWeight: '600' }}>{data.x.toFixed(2)}x</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                    <span style={{ color: '#888' }}>Valuation (P/B):</span>
                    <span style={{ fontWeight: '600' }}>{data.y.toFixed(2)}x</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '10px', color: '#666' }}>
                    Sample Size: {data.count} tickers
                </div>
            </div>
        );
    }
    return null;
};

export default function ValuationScatterChart({ data = [] }) {
    const processedData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return data.map(item => ({
            name: item.industry || item.name,
            x: parseFloat(item.pe) || 0,
            y: parseFloat(item.pb) || 0,
            count: item.count || 1,
            z: Math.sqrt(item.count || 1) * 5
        })).filter(d => d.x > 0 && d.y > 0);
    }, [data]);

    if (processedData.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', background: '#050505', borderRadius: '12px' }}>
                No valuation data available.
            </div>
        );
    }

    // Dynamic domains
    const xMax = Math.max(...processedData.map(d => d.x)) * 1.1;
    const yMax = Math.max(...processedData.map(d => d.y)) * 1.1;
    const xMid = 15; 
    const yMid = 1.8; 

    return (
        <div style={{ 
            height: '100%', 
            background: '#0a0a0a', 
            borderRadius: '16px', 
            padding: '1rem',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', fontWeight: '800', letterSpacing: '-0.5px' }}>
                    Valuation Distribution
                </h3>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                    Sector P/E vs P/B Multiples
                </div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                        <XAxis 
                            type="number" 
                            dataKey="x" 
                            name="P/E" 
                            stroke="#333" 
                            fontSize={10}
                            domain={[0, Math.min(60, xMax)]}
                            tick={{ fill: '#444' }}
                            axisLine={false}
                            tickLine={false}
                            label={{ value: 'P/E Ratio', position: 'bottom', offset: 15, fill: '#444', fontSize: '9px', fontWeight: '700' }}
                        />
                        <YAxis 
                            type="number" 
                            dataKey="y" 
                            name="P/B" 
                            stroke="#333" 
                            fontSize={10}
                            domain={[0, Math.min(10, yMax)]}
                            tick={{ fill: '#444' }}
                            axisLine={false}
                            tickLine={false}
                            label={{ value: 'P/B Ratio', angle: -90, position: 'insideLeft', offset: 0, fill: '#444', fontSize: '9px', fontWeight: '700' }}
                        />
                        <ZAxis type="number" dataKey="z" range={[20, 800]} />
                        <Tooltip content={<CustomTooltip />} />
                        
                        {/* Quadrant Lines */}
                        <ReferenceLine x={xMid} stroke="#222" strokeDasharray="5 5" strokeWidth={1} />
                        <ReferenceLine y={yMid} stroke="#222" strokeDasharray="5 5" strokeWidth={1} />

                        {/* Quadrant Labels */}
                        <text x="80%" y="15%" fill="#888" fontSize="8" fontWeight="700" opacity="0.3">Premium Growth</text>
                        <text x="20%" y="15%" fill="#00ff7f" fontSize="8" fontWeight="700" opacity="0.3">Alpha Value</text>
                        <text x="20%" y="85%" fill="#444" fontSize="8" fontWeight="700" opacity="0.3">Laggards</text>
                        <text x="80%" y="85%" fill="#ff4d4d" fontSize="8" fontWeight="700" opacity="0.3">Overvalued</text>

                        <Scatter name="Sectors" data={processedData}>
                            {processedData.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={entry.y > yMid ? (entry.x < xMid ? '#00ff7f' : '#3b82f6') : (entry.x < xMid ? '#444' : '#ef4444')}
                                    fillOpacity={0.6}
                                    stroke="#fff"
                                    strokeWidth={1}
                                    strokeOpacity={0.2}
                                />
                            ))}
                            <LabelList dataKey="name" position="top" style={{ fill: '#444', fontSize: '8px', pointerEvents: 'none', fontWeight: '600' }} offset={10} />
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
