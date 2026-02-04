'use client';

import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MacroChart = ({ title, data, color = "#3b82f6", formatValue = (val) => val }) => {
    const [range, setRange] = useState('All');

    // Filter data based on range
    const filteredData = useMemo(() => {
        if (!data || data.length === 0) return [];
        if (range === 'All') return data;

        const now = new Date();
        let yearsToSubtract = 0;
        if (range === '1Y') yearsToSubtract = 1;
        if (range === '3Y') yearsToSubtract = 3;
        if (range === '5Y') yearsToSubtract = 5;

        const cutoff = new Date(now.setFullYear(now.getFullYear() - yearsToSubtract));
        return data.filter(d => new Date(d.date) >= cutoff);
    }, [data, range]);

    if (!data || data.length === 0) {
        return (
            <div className="p-6 border rounded-xl shadow-sm bg-white h-[400px] flex items-center justify-center">
                <p className="text-gray-400">No data available for {title}</p>
            </div>
        );
    }

    // Calculate Min/Max for Y-Axis Domain Auto-Scaling to look nice
    const values = filteredData.map(d => parseFloat(d.value)).filter(v => !isNaN(v));
    const minVal = values.length ? Math.min(...values) : 0;
    const maxVal = values.length ? Math.max(...values) : 100;
    // Buffer
    const yDomain = [minVal - (minVal * 0.05), maxVal + (maxVal * 0.05)];

    const ranges = ['1Y', '3Y', '5Y', 'All'];

    return (
        <div className="p-6 border border-gray-100 rounded-xl shadow-sm bg-white hover:shadow-lg transition-all duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800">{title}</h3>

                {/* Time Range Selector */}
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mt-2 sm:mt-0">
                    {ranges.map(r => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${range === r
                                    ? 'bg-white text-gray-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                    <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11, fill: '#9CA3AF' }}
                            tickFormatter={(str) => {
                                const d = new Date(str);
                                return `${d.getFullYear()}`;
                            }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={40}
                        />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#9CA3AF' }}
                            domain={['auto', 'auto']} // Using 'auto' is usually safe enough with Recharts now
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val) => typeof val === 'number' ? val.toFixed(1) : val}
                            width={35}
                        />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                            labelFormatter={(label) => new Date(label).toLocaleDateString()}
                            formatter={(value) => [formatValue(value), title]}
                        />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill={`url(#gradient-${title})`}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default MacroChart;
