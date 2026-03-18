'use client';

import React, { useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

/**
 * Premium Sector Treemap
 * Size: Weight/Market Cap
 * Color: Performance (% Change)
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
                <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#00ffcc', borderBottom: '1px solid #222', paddingBottom: '4px' }}>{data.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '4px' }}>
                    <span style={{ color: '#888' }}>Performance:</span>
                    <span style={{ color: (data.change || 0) >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                        {data.change !== undefined ? `${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)}%` : 'N/A'}
                    </span>
                </div>
                {data.weight && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', color: '#888' }}>
                        <span>Weight:</span>
                        <span style={{ fontWeight: '600' }}>{data.weight.toFixed(2)}%</span>
                    </div>
                )}
            </div>
        );
    }
    return null;
};

const CustomizedContent = (props) => {
    const { depth, x, y, width, height, name, change } = props;

    const getColor = (val) => {
        if (val > 2) return '#064e3b'; 
        if (val > 0.5) return '#059669'; 
        if (val > 0) return '#10b981'; 
        if (val === 0) return '#1f2937'; 
        if (val > -0.5) return '#f87171'; 
        if (val > -2) return '#dc2626'; 
        return '#7f1d1d'; 
    };

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: getColor(change),
                    stroke: '#000',
                    strokeWidth: 1,
                    strokeOpacity: 0.5,
                }}
            />
            {width > 40 && height > 20 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2 - 2}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={width > 80 ? 10 : 8}
                    fontWeight="700"
                    style={{ pointerEvents: 'none' }}
                >
                    {name.length > width / 7 ? `${name.substring(0, Math.floor(width / 7))}...` : name}
                </text>
            )}
            {width > 60 && height > 40 && (
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 10}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={8}
                    fontWeight="600"
                    opacity={0.8}
                    style={{ pointerEvents: 'none' }}
                >
                    {change !== undefined ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : ''}
                </text>
            )}
        </g>
    );
};

export default function SectorTreemap({ data = [], title = "Sector Yield Map" }) {
    if (!data || data.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', background: '#050505', borderRadius: '12px' }}>
                Loading heatmap engine...
            </div>
        );
    }

    return (
        <div style={{ 
            height: '100%', 
            background: '#0a0a0a', 
            borderRadius: '16px', 
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', fontWeight: '800', letterSpacing: '-0.5px' }}>
                    {title}
                </h3>
                <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                    Relative Momentum Distribution & Performance Heatmap
                </div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={data}
                        dataKey="weight"
                        stroke="#000"
                        fill="#1a1a1a"
                        content={<CustomizedContent />}
                    >
                        <Tooltip content={<CustomTooltip />} />
                    </Treemap>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
