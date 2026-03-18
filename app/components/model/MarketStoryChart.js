'use client';

export default function MarketStoryChart({ story }) {
    if (!story) return null;

    const { whales, crowd, retail_nn } = story;

    // Parse metric percentages
    const parsePct = (str) => {
        if (!str) return 0;
        const match = str.match(/([+-]?[\d.]+)/);
        return match ? parseFloat(match[1]) : 0;
    };

    const whalePct = whales ? parsePct(whales.metric) : 0;
    const crowdPct = crowd ? parsePct(crowd.metric) : 0;
    const retailNnPct = retail_nn ? parsePct(retail_nn.metric) : 0;

    const renderActionBadge = (action) => {
        if (!action) return null;
        const lower = action.toLowerCase();
        if (lower.includes('accumulating') || lower.includes('buy')) return <span className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-1 rounded text-xs font-bold">{action}</span>;
        if (lower.includes('distributing') || lower.includes('sell') || lower.includes('dumping')) return <span className="bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-1 rounded text-xs font-bold">{action}</span>;
        return <span className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded text-xs font-bold">{action}</span>;
    };

    const isDivergence = (whales && crowd) ? ((whalePct > 0 && crowdPct < 0) || (whalePct < 0 && crowdPct > 0)) : false;

    return (
        <div className="bg-white dark:bg-[#1a1c23] border border-gray-200 dark:border-gray-800 rounded-xl p-6 shadow-sm h-full flex flex-col">
            <div className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider mb-6 flex justify-between items-center">
                <span>The Story: Market Actors</span>
                {isDivergence && (
                    <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        DIVERGENCE
                    </span>
                )}
            </div>

            <div className="space-y-4 flex-grow flex flex-col justify-center">

                {/* Traditional Whales */}
                {whales && (
                    <div className="pb-3 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xl">🐋</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">Whales (Smart Money)</span>
                                </div>
                                {renderActionBadge(whales.action)}
                            </div>
                            <div className={`text-xl font-bold ${whalePct > 0 ? 'text-green-500' : whalePct < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                {whales.metric}
                            </div>
                        </div>
                    </div>
                )}

                {/* Traditional Crowd */}
                {crowd && (
                    <div className="pb-3 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xl">🧑‍🤝‍🧑</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">The Crowd (Retail)</span>
                                </div>
                                {renderActionBadge(crowd.action)}
                            </div>
                            <div className={`text-xl font-bold ${crowdPct > 0 ? 'text-green-500' : crowdPct < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                {crowd.metric}
                            </div>
                        </div>
                    </div>
                )}

                {/* Deep Learning NN */}
                {retail_nn && (
                    <div>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xl">🤖</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">Retail Flow (Deep Learning)</span>
                                </div>
                                {renderActionBadge(retail_nn.action)}
                            </div>
                            <div className={`text-xl font-bold ${retailNnPct > 0 ? 'text-green-500' : retailNnPct < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                {retail_nn.metric}
                            </div>
                        </div>
                    </div>
                )}

            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                    If models conflict (divergence), caution is advised. Smart money follows volume spikes and foreign flows.
                </p>
            </div>
        </div>
    );
}
