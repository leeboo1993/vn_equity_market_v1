'use client';

import React, { useMemo, useState } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine
} from 'recharts';

/**
 * Enhanced Capital Flow Trends Chart
 * Supports 19+ Sectors and Participant Group Breakdown (Foreign, Instituion, Retail)
 */

const GROUP_OPTIONS = [
    { id: 'all', label: 'All Market' },
    { id: 'institution', label: 'Institution' },
    { id: 'foreign', label: 'Foreigners' },
    { id: 'retails', label: 'Retails' }
];

const SECTOR_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#f59e0b',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
    '#84cc16', '#0ea5e9', '#d946ef', '#34d399', '#f43f5e',
    '#a855f7', '#60a5fa', '#fbbf24', '#2dd4bf'
];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{ 
                backgroundColor: 'rgba(10, 10, 10, 0.95)', 
                border: '1px solid #333', 
                padding: '12px', 
                borderRadius: '8px',
                color: '#fff',
                fontSize: '11px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(4px)',
                maxHeight: '400px',
                overflowY: 'auto'
            }}>
                <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#888', borderBottom: '1px solid #222', paddingBottom: '4px' }}>{label}</div>
                {payload.sort((a,b) => (b.value || 0) - (a.value || 0)).slice(0, 10).map((entry, index) => (
                    <div key={index} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '4px' }}>
                        <span style={{ color: entry.color, fontWeight: '600' }}>{entry.name}:</span>
                        <span style={{ fontWeight: '800' }}>{entry.value >= 0 ? '+' : ''}{(entry.value || 0).toFixed(1)} BN</span>
                    </div>
                ))}
                {payload.length > 10 && (
                    <div style={{ fontSize: '9px', color: '#444', textAlign: 'center', marginTop: '4px' }}>+ {payload.length - 10} more sectors</div>
                )}
            </div>
        );
    }
    return null;
};

export default function SectorNetFlowChart({ data = [] }) {
    const [activeGroup, setActiveGroup] = useState('all');

    const { processedData, sectors, colorMap } = useMemo(() => {
        if (!data || data.length === 0) return { processedData: [], sectors: [], colorMap: {} };

        // 1. Extract Sector Keys (excluding participants)
        const first = data[0];
        const sectorKeys = Object.keys(first).filter(k => k !== 'date' && typeof first[k] === 'object');
        
        // 2. Map colors stably
        const cmap = {};
        sectorKeys.forEach((s, i) => {
            cmap[s] = SECTOR_COLORS[i % SECTOR_COLORS.length];
        });

        // 3. Transform data based on activeGroup
        const pData = data.map(entry => {
            const row = { date: entry.date };
            sectorKeys.forEach(s => {
                row[s] = entry[s]?.[activeGroup] || 0;
            });
            return row;
        });

        return { processedData: pData, sectors: sectorKeys, colorMap: cmap };
    }, [data, activeGroup]);

    if (!data || data.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', background: '#050505', borderRadius: '12px', fontSize: '12px' }}>
                Waiting for net flow synchronization...
            </div>
        );
    }

    return (
        <div style={{ 
            height: '100%', 
            background: '#0a0a0a', 
            borderRadius: '16px', 
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', fontWeight: '800', letterSpacing: '-0.5px' }}>
                        Capital Flow Trends
                    </h3>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                        Net Flow (VND Billion) by Sector & Participant
                    </div>
                </div>

                {/* Participant Toggles */}
                <div style={{ display: 'flex', gap: '4px', background: '#111', padding: '3px', borderRadius: '8px' }}>
                    {GROUP_OPTIONS.map(group => (
                        <button
                            key={group.id}
                            onClick={() => setActiveGroup(group.id)}
                            style={{
                                background: activeGroup === group.id ? '#1a1a1a' : 'transparent',
                                border: 'none',
                                color: activeGroup === group.id ? '#00ff7f' : '#666',
                                fontSize: '10px',
                                fontWeight: '700',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: activeGroup === group.id ? '1px solid #333' : '1px solid transparent'
                            }}
                        >
                            {group.label}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={processedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                            {sectors.map(sector => (
                                <linearGradient key={`grad-${sector}`} id={`grad-${sector}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={colorMap[sector]} stopOpacity={0.15}/>
                                    <stop offset="95%" stopColor={colorMap[sector]} stopOpacity={0}/>
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                        <XAxis 
                            dataKey="date" 
                            stroke="#333" 
                            fontSize={10} 
                            tick={{ fill: '#444' }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={40}
                            tickFormatter={(v) => v.split('-').slice(1).join('/')}
                        />
                        <YAxis 
                            stroke="#333" 
                            fontSize={10} 
                            tick={{ fill: '#444' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend 
                            iconType="circle" 
                            wrapperStyle={{ fontSize: '9px', paddingTop: '15px' }} 
                            formatter={(v) => <span style={{ color: '#888' }}>{v}</span>}
                        />
                        <ReferenceLine y={0} stroke="#444" strokeDasharray="5 5" />
                        
                        {sectors.map(sector => (
                            <Area 
                                key={sector}
                                type="monotone" 
                                dataKey={sector} 
                                name={sector}
                                stroke={colorMap[sector]} 
                                fill={`url(#grad-${sector})`}
                                strokeWidth={1.5}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                                stackId="1"
                                animationDuration={500}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
