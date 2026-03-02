'use client';

import { useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts';

export default function DCCashRatioChart({ data }) {
    if (!data || data.length === 0) return null;

    // data from dc_cash_ratio
    const chartData = useMemo(() => {
        return data.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [data]);

    return (
        <div className="card" style={{ padding: '1.5rem', height: '300px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>DC Fund Cash Ratio</h3>
                <div style={{ background: '#222', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', color: '#00a884', fontWeight: 600 }}>
                    Incl. Loans
                </div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                            stroke="#888"
                            fontSize={11}
                            tickFormatter={(v) => `${v.toFixed(1)}%`}
                            domain={['auto', 'auto']}
                            axisLine={false}
                            tickLine={false}
                            width={40}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: 'rgba(15, 15, 15, 0.95)', borderColor: '#333', borderRadius: '8px', color: '#fff', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                            itemStyle={{ color: '#fff', padding: '2px 0' }}
                            labelStyle={{ color: '#a0a0a0', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}
                            cursor={{ stroke: '#555', strokeWidth: 1, strokeDasharray: '4 4' }}
                            formatter={(value) => [`${value.toFixed(2)}%`, undefined]}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} iconType="circle" />

                        <Line type="monotone" dataKey="dcds" name="DCDS" stroke="#C2850C" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                        <Line type="monotone" dataKey="nbim" name="NBIM" stroke="#7C3AED" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                        <Line type="monotone" dataKey="tsk" name="TSK" stroke="#2563EB" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                        <Line type="monotone" dataKey="veil" name="VEIL" stroke="#027368" strokeWidth={3} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
