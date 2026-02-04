'use client';

const MacroKPICard = ({ title, data, formatValue = (val) => val }) => {
    if (!data || data.length < 2) return null;

    const latest = data[data.length - 1];
    const prev = data[data.length - 2];

    // Ensure values are numbers
    const latestVal = parseFloat(latest.value);
    const prevVal = parseFloat(prev.value);

    const change = latestVal - prevVal;
    const isPositive = change > 0;
    const isNeutral = change === 0;

    // For some metrics (like Unemployment), Up is "Bad". For now, we assume Up = Green/Neutral unless specified.
    // Let's keep it simple: Up/Down arrow. User interprets goodness.
    const colorClass = isPositive ? 'text-green-600' : (isNeutral ? 'text-gray-500' : 'text-red-500');
    // If we want "Up" color, usually green. 

    return (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition-shadow">
            <h4 className="text-gray-500 text-sm font-medium uppercase tracking-wider">{title}</h4>
            <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-gray-900">
                    {formatValue(latestVal)}
                </span>
                <span className={`flex items-center text-sm font-medium ${colorClass}`}>
                    {!isNeutral && (isPositive ? '↑' : '↓')}
                    {isNeutral ? '-' : Math.abs(change).toFixed(2)}
                    {/* Add % or unit if needed via props, simplfied here */}
                </span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
                Last: {latest.date}
            </div>
        </div>
    );
};

export default MacroKPICard;
