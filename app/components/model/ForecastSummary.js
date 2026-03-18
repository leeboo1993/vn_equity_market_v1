'use client';

export default function ForecastSummary({ meta, forecast }) {
    if (!meta || !forecast) return null;

    const { data_date } = meta;
    const { direction, return_1d, bucket_label, confidence, term_structure } = forecast;

    const isUp = direction === 'UP';
    const confidencePct = Math.round(confidence * 100);

    const formatPct = (val) => {
        if (val === undefined || val === null) return '-';
        const sign = val >= 0 ? '+' : '';
        return `${sign}${(val * 100).toFixed(2)}%`;
    };

    const getTermColor = (val) => {
        if (val > 0.01) return 'text-green-600 dark:text-green-400 bg-green-500/10';
        if (val > 0) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10';
        if (val < -0.01) return 'text-red-600 dark:text-red-400 bg-red-500/10';
        if (val < 0) return 'text-rose-600 dark:text-rose-400 bg-rose-500/10';
        return 'text-gray-600 dark:text-gray-400 bg-gray-500/10';
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Primary Forecast Card */}
            <div className="bg-gradient-to-br from-white to-gray-50 dark:from-[#1a1c23] dark:to-[#14151b] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between h-full">
                <div className="mb-4 flex flex-col md:flex-row md:justify-between md:items-start gap-4 h-full">
                    <div className="flex flex-col h-full justify-between">
                        <div>
                            <div className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">
                                Consensus Forecast
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                                as of {data_date}
                            </div>
                        </div>

                        <div>
                            <div className={`text-4xl sm:text-5xl font-extrabold flex items-center gap-3 ${isUp ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                                {isUp ? (
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                                        <polyline points="17 6 23 6 23 12"></polyline>
                                    </svg>
                                ) : (
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline>
                                        <polyline points="17 18 23 18 23 12"></polyline>
                                    </svg>
                                )}
                                {direction}
                            </div>
                            <div className="mt-2 text-lg font-medium text-gray-800 dark:text-gray-200">
                                {bucket_label}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center justify-center pt-2 md:pt-0">
                        {/* Circular Progress Gauge for Confidence */}
                        <div className="relative w-24 h-24">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <path
                                    className="text-gray-200 dark:text-gray-800"
                                    strokeWidth="3"
                                    stroke="currentColor"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path
                                    className={isUp ? 'text-green-500' : 'text-red-500'}
                                    strokeDasharray={`${confidencePct}, 100`}
                                    strokeWidth="3"
                                    strokeDashoffset="0"
                                    strokeLinecap="round"
                                    stroke="currentColor"
                                    fill="none"
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                            </svg>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                                <span className="text-xl font-bold">{confidencePct}%</span>
                            </div>
                        </div>
                        <span className="text-xs text-gray-500 mt-2 font-medium">CONFIDENCE</span>
                    </div>
                </div>

                {/* Background accent */}
                <div className={`absolute -bottom-10 -right-10 w-32 h-32 rounded-full opacity-[0.03] pointer-events-none ${isUp ? 'bg-green-500' : 'bg-red-500'}`}></div>
            </div>

            {/* Term Structure Bar Chart */}
            <div className="bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm md:col-span-2 flex flex-col h-full justify-between">
                <div>
                    <div className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider mb-6 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        Term Structure Expectations
                    </div>

                    <div className="grid grid-cols-3 gap-4 lg:gap-8 h-full">
                        {['t1', 't5', 't22'].map((term) => {
                            const val = term_structure?.[term];
                            if (val === undefined) return null;
                            const isPositive = val >= 0;

                            const absVal = Math.min(Math.abs(val) * 100, 5); // cap visual representation
                            const heightPct = Math.max((absVal / 5) * 100, 4); // min height 4% for visibility

                            return (
                                <div key={term} className="flex flex-col items-center justify-end h-32 relative group">
                                    <div className="w-full text-center text-lg font-bold mb-2 transition-all duration-300 group-hover:-translate-y-1">
                                        <span className={`px-2 py-1 rounded-md text-sm md:text-base ${getTermColor(val)}`}>
                                            {formatPct(val)}
                                        </span>
                                    </div>
                                    <div className="w-full max-w-[60px] h-full bg-gray-100 dark:bg-gray-800/50 rounded-t-lg relative overflow-hidden border-b border-gray-200 dark:border-gray-700">
                                        <div
                                            className={`absolute bottom-0 w-full transition-all duration-1000 ease-out ${isPositive ? 'bg-gradient-to-t from-green-500/20 to-green-500 dark:from-green-500/20 dark:to-green-400' : 'bg-gradient-to-t from-red-500/20 to-red-500 dark:from-red-500/20 dark:to-red-400'}`}
                                            style={{ height: `${heightPct}%` }}
                                        ></div>
                                    </div>
                                    <div className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300 uppercase">
                                        {term === 't1' ? '1 Day' : term === 't5' ? '1 Week' : '1 Month'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
