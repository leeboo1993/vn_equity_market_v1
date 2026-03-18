'use client';

export default function PerformanceMetricsGrid({ metrics }) {
    if (!metrics || Object.keys(metrics).length === 0) return null;

    // We can pick specific metrics to highlight, or just map them dynamically.
    // Given the known keys:
    const highlightKeys = [
        "Model Directional Accuracy (30 verifiable days)",
        "High Conviction Strategy Accuracy",
        "Action Plan Strategy Accuracy (T+1)",
        "Logic Reliability (Process Integrity)"
    ];

    const getMetricColor = (key, value) => {
        const pctMatch = value.match(/([\d.]+)%/);
        if (!pctMatch) return 'text-gray-900 dark:text-white';
        const val = parseFloat(pctMatch[1]);

        if (val >= 65) return 'text-green-600 dark:text-green-500';
        if (val >= 50) return 'text-amber-600 dark:text-amber-500';
        return 'text-red-500';
    };

    return (
        <div className="bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm mb-8">
            <div className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                Model Performance Benchmarks
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {highlightKeys.map((key, i) => {
                    const value = metrics[key];
                    if (!value) return null;

                    // Simplify title for UI
                    let shortTitle = key;
                    if (key.includes("Directional Accuracy")) shortTitle = "30D Directional Acc";
                    if (key.includes("High Conviction")) shortTitle = "High Conviction Acc";
                    if (key.includes("Action Plan Strategy")) shortTitle = "Action Plan Acc";
                    if (key.includes("Logic Reliability")) shortTitle = "Logic Reliability";

                    return (
                        <div key={i} className="flex flex-col border-l-2 border-gray-100 dark:border-gray-800 pl-4">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase mb-1 line-clamp-2" title={key}>{shortTitle}</span>
                            <span className={`text-2xl font-black ${getMetricColor(key, value)}`}>{value}</span>
                        </div>
                    );
                })}
            </div>

            {/* Minor metrics */}
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-x-8 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                {Object.entries(metrics).map(([key, value], i) => {
                    if (highlightKeys.includes(key)) return null;
                    return (
                        <div key={i}>
                            <span className="font-semibold">{key.replace('Model Bucket ', '')}:</span> <span className="text-gray-900 dark:text-gray-300 ml-1">{value}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
