'use client';

import { useMemo } from 'react';
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    Cell
} from 'recharts';

export default function PropArbitrageChart({ data }) {
    if (!data || data.length === 0) return null;

    // data from derivatives_prop
    const chartData = useMemo(() => {
        return data.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [data]);

    const latest = chartData[chartData.length - 1];

    return (
        <div className="card" style={{ padding: '1.5rem', height: '350px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Prop Arbitrage</h3>
            </div>
            {latest && (
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                    Balance <span style={{ color: latest.outstanding_balance_bn > 0 ? '#00a884' : '#e55353', fontWeight: 600 }}>{latest.outstanding_balance_bn}bn</span>
                    {' '}Net Today <span style={{ color: latest.total_net_today > 0 ? '#00a884' : '#e55353', fontWeight: 600 }}>{latest.total_net_today}bn</span>
                </div>
            )}

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
                            tickFormatter={(v) => v > 1000 ? (v / 1000).toFixed(1) + 'k' : v}
                            axisLine={false}
                            tickLine={false}
                            width={40}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#888"
                            fontSize={11}
                            axisLine={false}
                            tickLine={false}
                            width={45}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(15, 15, 15, 0.95)', borderColor: '#333', borderRadius: '8px', color: '#fff', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                            itemStyle={{ color: '#fff', padding: '2px 0' }}
                            labelStyle={{ color: '#a0a0a0', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}
                            cursor={{ fill: '#333', opacity: 0.1 }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="circle" />
                        <Bar
                            yAxisId="right"
                            dataKey="total_net_today"
                            name="Net Today"
                            barSize={4}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.total_net_today > 0 ? '#059669' : '#dc2626'} />
                            ))}
                        </Bar>
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="outstanding_balance_bn"
                            name="Balance"
                            stroke="#2563EB"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
