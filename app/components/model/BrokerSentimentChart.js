'use client';

import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend
} from 'recharts';

export default function BrokerSentimentChart({ broker }) {
    if (!broker) return null;

    const data = [
        { name: 'Positive', value: broker.pos, color: '#10B981' }, // emerald-500
        { name: 'Neutral', value: broker.neu, color: '#9CA3AF' },  // gray-400
        { name: 'Negative', value: broker.neg, color: '#EF4444' }, // red-500
    ];

    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-800 p-3 rounded-lg shadow-xl backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-sm">
                        <span
                            className="w-3 h-3 rounded-full inline-block"
                            style={{ backgroundColor: data.color }}
                        ></span>
                        <span className="text-gray-600 dark:text-gray-400 font-medium">
                            {data.name}
                        </span>
                        <span className="font-bold text-gray-900 dark:text-white ml-auto">
                            {data.value}%
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm h-full flex flex-col items-center">
            <div className="w-full text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider mb-2 text-left">
                Broker Consensus
            </div>

            <div className="text-xl font-bold mb-4 w-full text-left">
                Overall Sentiment: <span className="text-gray-900 dark:text-gray-100">{broker.sentiment}</span>
            </div>

            <div className="flex-grow w-full relative min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            formatter={(value, entry) => (
                                <span className="text-gray-700 dark:text-gray-300 font-medium ml-1">
                                    {value}
                                </span>
                            )}
                        />
                    </PieChart>
                </ResponsiveContainer>

                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-6">
                    <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">8</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">Reports</span>
                </div>
            </div>
        </div>
    );
}
