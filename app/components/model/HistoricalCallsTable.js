'use client';

export default function HistoricalCallsTable({ history }) {
    if (!history || history.length === 0) return null;

    const renderAccuracyBadge = (status) => {
        if (!status || status === 'N/A') return <span className="text-gray-400">-</span>;
        if (status.includes('HIT')) return <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded text-xs font-bold border border-green-200 dark:border-green-800/50">{status}</span>;
        if (status.includes('MISS')) return <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded text-xs font-bold border border-red-200 dark:border-red-800/50">{status}</span>;
        return <span className="text-gray-500">{status}</span>;
    };

    const renderDecision = (decision) => {
        if (decision === 'SHORT' || decision === 'REDUCE') return <span className="text-red-600 dark:text-red-400 font-bold">{decision}</span>;
        if (decision === 'LONG') return <span className="text-green-600 dark:text-green-400 font-bold">{decision}</span>;
        if (decision === 'SKIP' || decision === 'NEUTRAL') return <span className="text-gray-500 dark:text-gray-400 font-semibold">{decision}</span>;
        return decision;
    };

    return (
        <div className="bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-500"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    30-Day Verifiable History
                </h3>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                            <th className="px-4 py-3 font-semibold rounded-tl-lg">Date</th>
                            <th className="px-4 py-3 font-semibold text-right">Forecast (T+1)</th>
                            <th className="px-4 py-3 font-semibold text-right border-r border-gray-200 dark:border-gray-700">Actual (T+1)</th>
                            <th className="px-4 py-3 font-semibold text-center">Decision</th>
                            <th className="px-4 py-3 font-semibold text-center border-r border-gray-200 dark:border-gray-700">Logic</th>
                            <th className="px-4 py-3 font-semibold text-center">Dec Addr</th>
                            <th className="px-4 py-3 font-semibold text-center">Dir. Acc</th>
                            <th className="px-4 py-3 font-semibold text-center">Mod. Acc</th>
                            <th className="px-4 py-3 font-semibold">Predicted Bucket</th>
                            <th className="px-4 py-3 font-semibold rounded-tr-lg">Actual Bucket</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {history.map((row, index) => {
                            const isActualPositive = row.actualRet.includes('+');
                            const isForecastPositive = row.forecast.includes('+');

                            return (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                        {row.date}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-semibold ${isForecastPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {row.forecast}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold border-r border-gray-100 dark:border-gray-800 ${isActualPositive ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
                                        {row.actualRet}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        {renderDecision(row.decision)}
                                    </td>
                                    <td className="px-4 py-3 text-center border-r border-gray-100 dark:border-gray-800">
                                        {row.logic.includes('Strong Align') ? (
                                            <span className="text-blue-600 dark:text-blue-400 font-bold text-xs">{row.logic}</span>
                                        ) : row.logic.includes('Divergent') ? (
                                            <span className="text-amber-600 dark:text-amber-500 font-medium text-xs">{row.logic}</span>
                                        ) : (
                                            <span className="text-gray-500 text-xs">{row.logic}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">{renderAccuracyBadge(row.decAcc)}</td>
                                    <td className="px-4 py-3 text-center">{renderAccuracyBadge(row.dirAcc)}</td>
                                    <td className="px-4 py-3 text-center">{renderAccuracyBadge(row.modAcc)}</td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">
                                        {row.modelBucket}
                                    </td>
                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs truncate max-w-[150px]">
                                        {row.actualBucket}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1.5"><span className="text-blue-500 font-bold">Strong Align:</span> Highest conviction.</div>
                <div className="flex items-center gap-1.5"><span className="text-amber-500 font-bold">Divergent:</span> Models conflict. SKIP.</div>
            </div>
        </div>
    );
}
