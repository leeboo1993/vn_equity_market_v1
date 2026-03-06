'use client';

import React, { useState } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

export default function IndustryHeatmap({ data }) {
    const [selectedMetric, setSelectedMetric] = useState('PRICE_CHG_PCT_CR_1M');

    if (!data || data.length === 0) return <div>No data available</div>;

    // Process data for the bar chart
    const chartData = data.map(ind => ({
        name: ind.nameVn || ind.nameEn,
        value: ind.metrics[selectedMetric] || 0
    })).sort((a, b) => b.value - a.value); // Always sort descending

    const metricLabel = selectedMetric === 'PRICE_CHG_PCT_CR_1M' ? '1-Month Price Change (%)' : 'P/E Ratio';

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-gray-800 p-3 rounded shadow-lg border border-gray-100 dark:border-gray-700 text-sm">
                    <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">{label}</p>
                    <p style={{ color: payload[0].payload.value >= 0 ? '#10b981' : '#ef4444' }}>
                        {metricLabel}: <span className="font-bold">{payload[0].value.toFixed(2)}</span>
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-full flex flex-col items-center min-h-[400px]">
            {/* Toggle */}
            <div className="flex space-x-2 mb-4 bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg self-start">
                <button
                    onClick={() => setSelectedMetric('PRICE_CHG_PCT_CR_1M')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${selectedMetric === 'PRICE_CHG_PCT_CR_1M'
                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                        }`}
                >
                    1-Month Change
                </button>
                <button
                    onClick={() => setSelectedMetric('PRICE_TO_EARNINGS')}
                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${selectedMetric === 'PRICE_TO_EARNINGS'
                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                        }`}
                >
                    P/E Ratio
                </button>
            </div>

            <div className="w-full h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.2} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={{ stroke: '#e5e7eb' }} />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={110}
                            tick={{ fontSize: 11, fill: '#4b5563' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Bar dataKey="value" isAnimationActive={false} radius={[0, 4, 4, 0]}>
                            {chartData.map((entry, index) => {
                                // For P/E, everything is usually positive, but color by value magnitude optionally.
                                // Simplest is green for > 0, red for < 0
                                const color = entry.value >= 0 ? '#10b981' : '#ef4444';
                                return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
