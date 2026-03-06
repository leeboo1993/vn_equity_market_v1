'use client';

import React, { useState } from 'react';
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';

export default function MarketValuationChart({ data }) {
    const [selectedMetric, setSelectedMetric] = useState('pe'); // 'pe' or 'pb'

    if (!data || data.length === 0) return <div>No data available</div>;

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-gray-800 p-3 rounded shadow-lg border border-gray-100 dark:border-gray-700 text-sm">
                    <p className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={`item-${index}`} style={{ color: entry.color }}>
                            {entry.name}: {entry.value?.toFixed(2)}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    const metricKey = selectedMetric === 'pe' ? 'pe' : 'pb';
    const metricName = selectedMetric === 'pe' ? 'P/E Ratio' : 'P/B Ratio';
    const metricColor = selectedMetric === 'pe' ? '#ef4444' : '#f59e0b'; // Red for PE, Amber for PB

    // Calculate Y-axis domain for VN-Index
    const vnIndexDomain = ['auto', 'auto'];

    return (
        <div className="w-full flex flex-col items-center">
            {/* Toggle */}
            <div className="flex space-x-2 mb-4 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg">
                <button
                    onClick={() => setSelectedMetric('pe')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${selectedMetric === 'pe'
                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                        }`}
                >
                    P/E Ratio
                </button>
                <button
                    onClick={() => setSelectedMetric('pb')}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${selectedMetric === 'pb'
                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                        }`}
                >
                    P/B Ratio
                </button>
            </div>

            <div className="w-full h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                        data={data}
                        margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                        <XAxis
                            dataKey="date"
                            tick={{ fill: '#6b7280', fontSize: 12 }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                            minTickGap={50}
                        />

                        {/* Left Y-Axis for VN-Index */}
                        <YAxis
                            yAxisId="index"
                            orientation="left"
                            domain={vnIndexDomain}
                            tick={{ fill: '#3b82f6', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => Math.round(val)}
                        />

                        {/* Right Y-Axis for Ratio */}
                        <YAxis
                            yAxisId="ratio"
                            orientation="right"
                            domain={['auto', 'auto']}
                            tick={{ fill: metricColor, fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => val.toFixed(1)}
                        />

                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />

                        {/* VN-Index Area */}
                        <Area
                            yAxisId="index"
                            type="monotone"
                            dataKey="close"
                            name="VN-Index"
                            fill="#3b82f6"
                            stroke="#3b82f6"
                            fillOpacity={0.15}
                            isAnimationActive={false}
                        />

                        {/* Valuation Line */}
                        <Line
                            yAxisId="ratio"
                            type="monotone"
                            dataKey={metricKey}
                            name={metricName}
                            stroke={metricColor}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
