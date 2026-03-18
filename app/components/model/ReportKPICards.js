'use client';

export default function ReportKPICards({ meta }) {
    if (!meta) return null;

    const { date, view, regime, regimeConfidence, targetValue, targetReturn, forecastConfidence } = meta;

    const isBull = regime.toLowerCase().includes('bull');
    const isBear = regime.toLowerCase().includes('bear');
    const isUpTarget = targetReturn.includes('+');

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Market View */}
            <div className="bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm flex flex-col justify-center relative overflow-hidden">
                <div className="relative z-10">
                    <div className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">
                        Market View
                    </div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                        {view}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                        Updated Insight: {date}
                    </div>
                </div>
            </div>

            {/* Regime */}
            <div className="bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm flex flex-col justify-center relative overflow-hidden">
                <div className="relative z-10">
                    <div className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider mb-2">
                        Market Regime
                    </div>
                    <div className={`text-3xl font-bold mb-1 ${isBull ? 'text-green-600 dark:text-green-500' : isBear ? 'text-red-600 dark:text-red-500' : 'text-blue-600 dark:text-blue-500'}`}>
                        {regime}
                    </div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                        Regime Confidence: <span className="font-semibold text-gray-700 dark:text-gray-300">{regimeConfidence}</span>
                    </div>
                </div>
                {/* Accent Background */}
                <div className={`absolute -bottom-8 -right-8 w-24 h-24 rounded-full opacity-10 pointer-events-none ${isBull ? 'bg-green-500' : isBear ? 'bg-red-500' : 'bg-blue-500'}`}></div>
            </div>

            {/* Target and Confidence */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-[#1e2130] dark:to-[#171925] border border-blue-100 dark:border-indigo-900/50 rounded-xl p-6 shadow-sm flex justify-between items-center">
                <div>
                    <div className="text-blue-600 dark:text-indigo-400 text-sm font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                        T+1 Index Target
                    </div>
                    <div className="text-3xl font-extrabold text-gray-900 dark:text-white mb-1">
                        {targetValue}
                    </div>
                    <div className={`text-sm font-medium ${isUpTarget ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {targetReturn} Expected Return
                    </div>
                </div>
                {forecastConfidence && (
                    <div className="text-right flex flex-col items-end justify-center pr-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">Model Conviction</div>
                        <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{forecastConfidence}</div>
                    </div>
                )}
            </div>
        </div>
    );
}
