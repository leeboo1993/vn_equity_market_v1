'use client';

import React, { useMemo, useState } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine
} from 'recharts';

const COLORS = {
    Banks: '#3b82f6',
    RealEstate: '#ef4444',
    Financials: '#10b981',
    Resources: '#8b5cf6',
    Technology: '#14b8a6',
    Consumer: '#f59e0b',
    Other: '#6b7280'
};

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ 
                backgroundColor: 'rgba(10, 10, 10, 0.95)', 
                border: '1px solid #333', 
                padding: '12px', 
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
            }}>
                <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#888' }}>{label}</div>
                {payload.map((entry, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '4px' }}>
                        <span style={{ color: entry.color }}>{entry.name}:</span>
                        <span style={{ fontWeight: 'bold' }}>{entry.value.toFixed(3)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

export default function HistoricalFlowChart({ data = [] }) {
    if (!data || data.length === 0) {
        return (
            <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', background: '#111', borderRadius: '12px' }}>
                Waiting for flow historical data...
            </div>
        );
    }

    return (
        <div style={{ 
            height: '500px', 
            background: '#0a0a0a', 
            borderRadius: '16px', 
            padding: '2rem',
            border: '1px solid #1a1a1a',
            position: 'relative'
        }}>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '20px', color: '#fff', fontWeight: '800' }}>
                        Sector <span style={{ color: '#00a884', fontStyle: 'italic', WebkitTextStroke: '0.5px #00a884', WebkitTextFillColor: 'transparent' }}>FLOW Z-SCORE</span>
                    </h3>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        Institutional Participation Intensity (Z-Shift) per Industry Group
                    </div>
                </div>
                <div style={{ fontSize: '10px', color: '#333', fontFamily: 'monospace' }}>
                    FLOW_ENGINE.V4.1
                </div>
            </div>

            <div style={{ width: '100%', height: 'calc(100% - 70px)' }}>
                <ResponsiveContainer>
                    <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                        <XAxis 
                            dataKey="date" 
                            stroke="#444" 
                            fontSize={10} 
                            tick={{ fill: '#666' }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={30}
                        />
                        <YAxis 
                            stroke="#444" 
                            fontSize={10} 
                            tick={{ fill: '#666' }}
                            axisLine={false}
                            tickLine={false}
                            label={{ value: 'Z-Score', angle: -90, position: 'insideLeft', fill: '#444', fontSize: '10px' }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
                        <ReferenceLine y={0} stroke="#333" strokeDasharray="3 3" />
                        
                        {Object.keys(COLORS).map(sector => (
                            <Line 
                                key={sector}
                                type="monotone" 
                                dataKey={sector} 
                                name={sector}
                                stroke={COLORS[sector]} 
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
