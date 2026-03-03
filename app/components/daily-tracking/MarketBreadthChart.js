'use client';

import { useState, useMemo } from 'react';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

export default function MarketBreadthChart({ data }) {
    // data is expected to be vn_index array from market.json
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return data.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [data]);

    if (!data || data.length === 0) return null;

    return (
        <div className="card" style={{ padding: '1.5rem', height: '400px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Market Breadth</h3>
                <div style={{ fontSize: '12px', color: '#888' }}>VN-Index, Breadth %, Outperform %</div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#888"
                            fontSize={11}
                            tickFormatter={(v) => v ? v.substring(5).replace('-', '/') : ''}
                            tickMargin={10}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#888"
                            fontSize={11}
                            domain={['auto', 'auto']}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) => `${v}%`}
                            width={40}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#888"
                            fontSize={11}
                            domain={['dataMin - 10', 'dataMax + 10']}
                            axisLine={false}
                            tickLine={false}
                            width={45}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(15, 15, 15, 0.95)', borderColor: '#333', borderRadius: '8px', color: '#fff', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                            itemStyle={{ color: '#fff', padding: '2px 0' }}
                            labelStyle={{ color: '#a0a0a0', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}
                            cursor={{ stroke: '#555', strokeWidth: 1, strokeDasharray: '4 4' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="circle" />

                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="pct_outperform_vni_7d"
                            name="15D O/P VNI"
                            stroke="#C2850C"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="breadth_above_ma50"
                            name="Breadth >MA50"
                            stroke="#5D7173"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="vnindex"
                            name="VN-Index"
                            stroke="#027368"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
