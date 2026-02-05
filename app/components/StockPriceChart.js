'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Area } from 'recharts';

export default function StockPriceChart({ ticker }) {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [period, setPeriod] = useState(180); // Default 6 Months

    const periodOptions = [
        { label: '1M', days: 30 },
        { label: '3M', days: 90 },
        { label: '6M', days: 180 },
        { label: '1Y', days: 365 },
        { label: '2Y', days: 730 },
    ];

    useEffect(() => {
        if (!ticker || ticker.length !== 3) return;

        async function fetchData() {
            setLoading(true);
            try {
                const res = await fetch(`/api/stock-history?ticker=${ticker}&days=${period}`);
                const json = await res.json();
                if (json.data && Array.isArray(json.data)) {
                    // Process Data
                    // API returns: { tradingDate, open, high, low, close, volume }
                    const processed = json.data.map((item, idx, arr) => {
                        // MA Calc (naive, efficient enough for small N)
                        const slice10 = arr.slice(Math.max(0, idx - 9), idx + 1);
                        const ma10 = slice10.reduce((s, x) => s + x.close, 0) / slice10.length;

                        const slice50 = arr.slice(Math.max(0, idx - 49), idx + 1);
                        const ma50 = slice50.reduce((s, x) => s + x.close, 0) / slice50.length;

                        return {
                            ...item,
                            dateStr: new Date(item.tradingDate).toLocaleDateString('en-GB'),
                            ma10: idx >= 9 ? ma10 : null,
                            ma50: idx >= 49 ? ma50 : null,
                        };
                    });
                    setData(processed);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [ticker, period]);

    if (!ticker || ticker.length !== 3) return null;

    if (loading) return <div className="h-[400px] w-full flex items-center justify-center text-gray-400">Loading Chart...</div>;
    if (!data.length) return <div className="h-[400px] w-full flex items-center justify-center text-gray-500">No Data Available</div>;

    const latest = data[data.length - 1];
    const first = data[0];
    const change = ((latest.close - first.close) / first.close) * 100;
    const isPositive = change >= 0;
    const color = isPositive ? '#10b981' : '#ef4444';

    return (
        <div className="card bg-[#141414] border border-gray-800 rounded-lg p-4 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                        {ticker}
                        <span className={`text-sm font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {latest.close.toLocaleString()} ({change > 0 ? '+' : ''}{change.toFixed(2)}%)
                        </span>
                    </h3>
                    <div className="flex gap-4 text-xs text-gray-500 mt-1">
                        <span>High: {Math.max(...data.map(d => d.high)).toLocaleString()}</span>
                        <span>Low: {Math.min(...data.map(d => d.low)).toLocaleString()}</span>
                        <span>Vol: {(data.reduce((s, x) => s + x.volume, 0) / data.length).toFixed(0)} avg</span>
                    </div>
                </div>

                <div className="flex bg-black rounded p-1 border border-gray-800">
                    {periodOptions.map(opt => (
                        <button
                            key={opt.label}
                            onClick={() => setPeriod(opt.days)}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${period === opt.days ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-[400px] w-full min-h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data}>
                        <defs>
                            <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis
                            dataKey="dateStr"
                            stroke="#555"
                            fontSize={11}
                            tickMargin={10}
                            minTickGap={30}
                        />
                        <YAxis
                            yAxisId="left"
                            orientation="right"
                            domain={['auto', 'auto']}
                            stroke="#555"
                            fontSize={11}
                            tickFormatter={(val) => val.toLocaleString()}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="left"
                            stroke="#555"
                            fontSize={0}
                            tick={false}
                            domain={[0, dataMax => dataMax * 4]} // Push volume down
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
                            itemStyle={{ fontSize: '12px' }}
                            formatter={(val, name) => {
                                if (name === 'Volume') return val.toLocaleString();
                                return val.toLocaleString();
                            }}
                            labelStyle={{ color: '#888', marginBottom: '5px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                        <Bar yAxisId="right" dataKey="volume" name="Volume" fill={color} opacity={0.3} barSize={2} />

                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="close"
                            name="Price"
                            stroke={color}
                            fillOpacity={1}
                            fill="url(#colorClose)"
                            strokeWidth={2}
                        />

                        <Line type="monotone" yAxisId="left" dataKey="ma10" name="MA10" stroke="#3b82f6" strokeDasharray="3 3" strokeWidth={1} dot={false} />
                        <Line type="monotone" yAxisId="left" dataKey="ma50" name="MA50" stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} dot={false} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
