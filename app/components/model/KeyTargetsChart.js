'use client';

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

export default function KeyTargetsChart({ horizons }) {
    if (!horizons || horizons.length === 0) return null;

    // Parse data to numbers for charting
    const chartData = horizons.map(h => {
        const pctMatch = (h.forecast || "").match(/([+-]?[\d.]+)/);
        const val = pctMatch ? parseFloat(pctMatch[1]) : 0;
        return {
            name: h.term,
            value: val,
            target: h.target,
            bucket: h.bucket,
            trend: h.trend,
            color: val > 0 ? '#10B981' : val < 0 ? '#EF4444' : '#9CA3AF'
        };
    });

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-800 p-4 rounded-lg shadow-xl backdrop-blur-sm border-l-4" style={{ borderLeftColor: data.color }}>
                    <p className="font-bold text-gray-900 dark:text-gray-100 mb-2 border-b border-gray-100 dark:border-gray-800 pb-2">{data.name}</p>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Target Level:</span>
                        <span className="font-semibold text-right dark:text-gray-200">{data.target}</span>

                        <span className="text-gray-500 dark:text-gray-400">Expected:</span>
                        <span className={`font-bold text-right ${data.value > 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {data.value > 0 ? '+' : ''}{data.value}%
                        </span>

                        <span className="text-gray-500 dark:text-gray-400">Bucket:</span>
                        <span className="font-medium text-right text-gray-700 dark:text-gray-300">{data.bucket}</span>

                        <span className="text-gray-500 dark:text-gray-400">Risk/Trend:</span>
                        <span className="font-medium text-right text-gray-700 dark:text-gray-300">{data.trend}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm h-full">
            <div className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider mb-6">
                Key Targets & Horizons
            </div>

            <div className="w-full h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        margin={{ top: 20, right: 20, left: -20, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" strokeOpacity={0.2} />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 13, fontWeight: 500 }}
                            dy={10}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#6B7280', fontSize: 12 }}
                            tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                        <Bar
                            dataKey="value"
                            radius={[6, 6, 6, 6]}
                            maxBarSize={60}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-4">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Positive Outlook</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Negative Outlook</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span> Flat</span>
            </div>
        </div>
    );
}
