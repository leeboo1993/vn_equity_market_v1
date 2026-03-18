'use client';

import React, { useMemo } from 'react';
import {
    ComposedChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    Scatter
} from 'recharts';

/**
 * Premium Valuation Box Plot
 * Shows Current P/E vs 5Y History (Min, Max, Quartiles)
 */

const BoxPlotTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div style={{ 
                backgroundColor: 'rgba(10, 10, 10, 0.95)', 
                border: '1px solid #333', 
                padding: '12px', 
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px'
            }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#00ffcc' }}>{data.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <span style={{ color: '#888' }}>Current P/E:</span> <span style={{ fontWeight: 'bold' }}>{data.current.toFixed(2)}x</span>
                    <span style={{ color: '#888' }}>Median (5Y):</span> <span>{data.median.toFixed(2)}x</span>
                    <span style={{ color: '#888' }}>High (5Y):</span> <span>{data.max.toFixed(2)}x</span>
                    <span style={{ color: '#888' }}>Low (5Y):</span> <span>{data.min.toFixed(2)}x</span>
                </div>
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #222', fontSize: '11px', color: data.current < data.median ? '#10b981' : '#ef4444' }}>
                    {data.current < data.median ? 'Currently Discounted' : 'Currently Premium'}
                </div>
            </div>
        );
    }
    return null;
};

export default function ValuationBoxPlot({ data = [] }) {
    if (!data || data.length === 0) {
        return (
            <div style={{ height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', background: '#111', borderRadius: '12px' }}>
                Calculating historical valuation ranges...
            </div>
        );
    }

    return (
        <div style={{ 
            height: '600px', 
            background: '#0a0a0a', 
            borderRadius: '16px', 
            padding: '2rem',
            border: '1px solid #1a1a1a',
            position: 'relative'
        }}>
           <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                   <h3 style={{ margin: 0, fontSize: '20px', color: '#fff', fontWeight: '800' }}>
                        Valuation <span style={{ color: '#00a884', fontStyle: 'italic', WebkitTextStroke: '0.5px #00a884', WebkitTextFillColor: 'transparent' }}>HISTOGRAM</span>
                    </h3>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        Current P/E Multiples against 5-Year Statistical Variance
                    </div>
                </div>
                <div style={{ fontSize: '10px', color: '#333', fontFamily: 'monospace' }}>
                    QUANT.RANGE_X01
                </div>
            </div>

            <div style={{ width: '100%', height: 'calc(100% - 70px)' }}>
                <ResponsiveContainer>
                    <ComposedChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid stroke="#1a1a1a" horizontal={true} vertical={false} />
                        <XAxis type="number" stroke="#444" fontSize={11} tick={{ fill: '#666' }} domain={[0, 'auto']} />
                        <YAxis dataKey="name" type="category" stroke="#444" fontSize={11} tick={{ fill: '#eee' }} width={120} />
                        <Tooltip content={<BoxPlotTooltip />} />
                        
                        {/* Range Bar (Min to Max) */}
                        <Bar dataKey="range" fill="#222" radius={[0, 4, 4, 0]} barSize={20} />
                        
                        {/* Current Value Marker */}
                        <Scatter dataKey="current" fill="#00ffcc" shape="diamond" />

                        {/* Reference Points (Optional - visualized via Tooltip mostly in this design) */}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
