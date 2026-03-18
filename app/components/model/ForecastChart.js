'use client';

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

export default function ForecastChart({ chartData }) {
    if (!chartData || chartData.length === 0) {
        return <div className="p-8 text-center text-gray-500">No chart data available.</div>;
    }

    // Format data slightly if needed
    const data = chartData.map(d => ({
        ...d,
        displayDate: new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        closeFormatted: d.close?.toFixed(2),
        ma50Formatted: d.ma_50?.toFixed(2)
    }));

    // Find min and max for intelligent Y-axis scaling
    const allValues = data.flatMap(d => [d.close, d.ma_50]).filter(v => v !== null && v !== undefined);
    const minVal = Math.min(...allValues);
    const maxVal = Math.max(...allValues);
    const diff = maxVal - minVal;

    // Add 5% padding
    const yDomain = [
        Math.floor(minVal - diff * 0.05),
        Math.ceil(maxVal + diff * 0.05)
    ];

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-800 p-3 rounded-lg shadow-xl backdrop-blur-sm">
                    <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">{label}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2 mb-1 text-sm">
                            <span
                                className="w-3 h-3 rounded-full inline-block"
                                style={{ backgroundColor: entry.color }}
                            ></span>
                            <span className="text-gray-600 dark:text-gray-400 capitalize w-16">
                                {entry.name === 'close' ? 'VN-Index' : 'MA 50'}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-white ml-auto">
                                {entry.value?.toFixed(2)}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.2} />
                    <XAxis
                        dataKey="displayDate"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                        minTickGap={30}
                    />
                    <YAxis
                        domain={yDomain}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#6B7280', fontSize: 12 }}
                        tickFormatter={(value) => value.toLocaleString()}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                        verticalAlign="top"
                        height={36}
                        iconType="circle"
                        formatter={(value) => (
                            <span className="text-gray-700 dark:text-gray-300 font-medium ml-1">
                                {value === 'close' ? 'VN-Index Close' : '50-Day Moving Average'}
                            </span>
                        )}
                    />
                    <Line
                        type="monotone"
                        dataKey="close"
                        name="close"
                        stroke="#3B82F6"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#3B82F6' }}
                    />
                    <Line
                        type="monotone"
                        dataKey="ma_50"
                        name="ma_50"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
