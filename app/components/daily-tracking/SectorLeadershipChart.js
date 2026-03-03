'use client';

import { useMemo } from 'react';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    Cell
} from 'recharts';

// Simple deterministic color generator based on sector name
const stringToColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00FFFFFF)
        .toString(16)
        .toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
};

const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div style={{ backgroundColor: '#111', border: '1px solid #333', padding: '10px', color: '#fff', fontSize: '12px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>{data.sector}</div>
                <div>Net Score: {data.net_score.toFixed(3)}</div>
                <div>Return 5D: {data.ret.toFixed(2)}%</div>
            </div>
        );
    }
    return null;
};

export default function SectorLeadershipChart({ data }) {
    // Get latest date data for the scatter plot (Must be BEFORE any early returns!)
    const chartData = useMemo(() => {
        if (!data || data.length === 0) return [];
        const sorted = data.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        const latestDate = sorted[sorted.length - 1]?.date;
        if (!latestDate) return [];
        return sorted.filter(d => d.date === latestDate).map(d => ({
            ...d,
            net_score: parseFloat(d.net_score) || 0,
            ret: (parseFloat(d.ret_5d) || 0) * 100 // Convert to percentage display
        }));
    }, [data]);

    if (!data || data.length === 0 || chartData.length === 0) return null;

    return (
        <div className="card" style={{ padding: '1.5rem', height: '400px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Sector Leadership</h3>
                <div style={{ fontSize: '12px', color: '#888' }}>Lead-Lag NET Score vs 5-Day Return</div>
            </div>

            <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                        <XAxis
                            type="number"
                            dataKey="net_score"
                            name="Net Score"
                            domain={['dataMin - 0.02', 'dataMax + 0.02']}
                            stroke="#888"
                            fontSize={11}
                            tickFormatter={(v) => v.toFixed(2)}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            type="number"
                            dataKey="ret"
                            name="Return"
                            domain={['dataMin - 2', 'dataMax + 2']}
                            stroke="#888"
                            fontSize={11}
                            tickFormatter={(v) => v.toFixed(1)}
                            axisLine={false}
                            tickLine={false}
                            width={30}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#555', strokeWidth: 1, strokeDasharray: '3 3' }} />

                        <ReferenceLine y={0} stroke="#555" strokeDasharray="3 3" />
                        <ReferenceLine x={0} stroke="#555" strokeDasharray="3 3" />

                        {/* Quadrant Labels */}
                        <text x="85%" y="10%" fill="#00ff7f" fontSize="10" opacity="0.5" textAnchor="middle">Leading Up</text>
                        <text x="15%" y="10%" fill="#a95abf" fontSize="10" opacity="0.5" textAnchor="middle">Lagging Up</text>
                        <text x="15%" y="95%" fill="#e55353" fontSize="10" opacity="0.5" textAnchor="middle">Lagging Down</text>
                        <text x="85%" y="95%" fill="#e55353" fontSize="10" opacity="0.5" textAnchor="middle">Leading Down</text>

                        <Scatter name="Sectors" data={chartData}>
                            {
                                chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={stringToColor(entry.sector)} />
                                ))
                            }
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
