'use client';

import React, { useState, useMemo } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

// Distinct colors for different lines
const COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#14b8a6', '#f97316', '#6366f1'
];

export default function IndustryTrendlines({ data }) {
    const [selectedIndustries, setSelectedIndustries] = useState([]);

    // We get `data` as an array of { code, nameVn, nameEn, series: [{date, RS, PE, ...}] }

    // Sort all available industries for the dropdown
    const availableIndustries = useMemo(() => {
        if (!data) return [];
        return [...data].sort((a, b) => (a.nameVn || a.nameEn).localeCompare(b.nameVn || b.nameEn));
    }, [data]);

    // Format data constraint for Recharts (array of objects where each object is a Date with multiple lines as keys)
    const chartData = useMemo(() => {
        if (!data || selectedIndustries.length === 0) return [];

        // Group by Date
        const dateMap = new Map();

        selectedIndustries.forEach(indCode => {
            const indData = data.find(d => d.code === indCode);
            if (indData && indData.series) {
                indData.series.forEach(point => {
                    // We use WEEKLY_JDK_RS_MOMENTUM_CR as the default trendline metric
                    if (point['WEEKLY_JDK_RS_MOMENTUM_CR'] != null) {
                        if (!dateMap.has(point.date)) dateMap.set(point.date, { date: point.date });
                        dateMap.get(point.date)[indData.nameVn || indData.nameEn] = point['WEEKLY_JDK_RS_MOMENTUM_CR'];
                    }
                });
            }
        });

        // Convert Map back to array and sort chronologically
        const combined = Array.from(dateMap.values());
        combined.sort((a, b) => a.date.localeCompare(b.date));
        return combined;

    }, [data, selectedIndustries]);

    const handleSelect = (e) => {
        const val = e.target.value;
        if (!val) return;
        if (!selectedIndustries.includes(val) && selectedIndustries.length < 5) { // Limit to 5 max
            setSelectedIndustries([...selectedIndustries, val]);
        }
        e.target.value = ''; // Reset dropdown
    };

    const handleRemove = (code) => {
        setSelectedIndustries(selectedIndustries.filter(c => c !== code));
    };

    if (!data || data.length === 0) return <div>No data available</div>;

    return (
        <div className="w-full flex flex-col h-full min-h-[400px]">
            {/* Controls */}
            <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <select
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-sm focus:ring-2 outline-none"
                    onChange={handleSelect}
                    defaultValue=""
                >
                    <option value="" disabled>Select Sector to Compare (Max 5)</option>
                    {availableIndustries.map(ind => (
                        <option key={ind.code} value={ind.code} disabled={selectedIndustries.includes(ind.code)}>
                            {ind.nameVn || ind.nameEn}
                        </option>
                    ))}
                </select>

                <div className="flex flex-wrap gap-2">
                    {selectedIndustries.map((code, idx) => {
                        const ind = availableIndustries.find(a => a.code === code);
                        return (
                            <span key={code} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
                                style={{ backgroundColor: `${COLORS[idx % COLORS.length]}15`, color: COLORS[idx % COLORS.length], borderColor: COLORS[idx % COLORS.length] }}>
                                {ind?.nameVn}
                                <button type="button" onClick={() => handleRemove(code)} className="ml-1.5 focus:outline-none hover:text-gray-900 dark:hover:text-white">
                                    &times;
                                </button>
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Chart */}
            <div className="w-full flex-grow border border-gray-100 dark:border-gray-700/50 rounded-lg bg-gray-50/50 dark:bg-gray-900/30 p-2 relative h-[350px]">
                {selectedIndustries.length === 0 ? (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                        Please select at least one industry above to generate the chart.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                tickLine={false}
                                axisLine={{ stroke: '#e5e7eb' }}
                                minTickGap={30}
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#f3f4f6', borderRadius: '8px', fontSize: '13px' }}
                                itemStyle={{ padding: '2px 0' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

                            {selectedIndustries.map((code, idx) => {
                                const ind = availableIndustries.find(a => a.code === code);
                                const name = ind?.nameVn || ind?.nameEn;
                                return (
                                    <Line
                                        key={code}
                                        type="monotone"
                                        dataKey={name}
                                        stroke={COLORS[idx % COLORS.length]}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4 }}
                                        isAnimationActive={false}
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
}
