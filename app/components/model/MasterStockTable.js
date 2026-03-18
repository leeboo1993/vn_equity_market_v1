'use client';

import React from 'react';

export default function MasterStockTable({ topPicks = [], exitWarnings = [] }) {
    const renderTable = (stocks, title, themeColor) => {
        if (stocks.length === 0) return null;

        return (
            <div className="mb-10 last:mb-0 w-full">
                <div className="flex items-center gap-3 mb-4 px-2">
                    <div className={`w-1 h-6 rounded-full ${themeColor === 'green' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]'}`}></div>
                    <h3 className={`text-sm font-black uppercase tracking-[0.2em] ${themeColor === 'green' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {title}
                    </h3>
                    <span className="text-[10px] bg-gray-900/50 text-gray-500 px-2 py-0.5 rounded-full border border-gray-800 font-bold">
                        {stocks.length} Tickers
                    </span>
                </div>

                <div className="overflow-hidden rounded-2xl border border-gray-800/50 bg-[#0d0d0d] shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="border-b border-gray-800/50 bg-[#111]/80 backdrop-blur-md">
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Ticker</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Signal</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Exp. Return</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Call Date</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Perf. Since Call</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Risk / Logic</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/30">
                                {stocks.map((stock, idx) => (
                                    <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors tracking-tight">
                                                    {stock.ticker}
                                                </span>
                                                <span className="text-[10px] text-gray-600 font-bold uppercase tracking-tighter">{stock.industry || 'General'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-block px-3 py-1 rounded-md text-[10px] font-black tracking-tighter uppercase border ${stock.recommendation === 'BUY' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                                stock.recommendation === 'SELL' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                                                    'bg-gray-500/10 text-gray-500 border-gray-500/20'
                                                }`}>
                                                {stock.recommendation}
                                            </span>
                                        </td>
                                        <td className={`px-6 py-4 text-right font-black text-sm tabular-nums ${parseFloat(stock.returnPct) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                            }`}>
                                            {stock.returnPct}
                                        </td>
                                        <td className="px-6 py-4 text-center text-xs text-gray-400 font-medium tabular-nums">
                                            {stock.callDate || 'N/A'}
                                        </td>
                                        <td className={`px-6 py-4 text-right text-sm font-black tabular-nums ${parseFloat(stock.perfSinceCall) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                            }`}>
                                            {stock.perfSinceCall}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 max-w-sm">
                                                {stock.flags && stock.flags !== 'N/A' && stock.flags !== 'Safe' && (
                                                    <div className="flex flex-wrap gap-1">
                                                        {stock.flags.split(',').map((f, fi) => (
                                                            <span key={fi} className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-900/20 whitespace-nowrap">
                                                                {f.trim()}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                <span className="text-[10px] text-gray-500 italic leading-snug line-clamp-1">
                                                    {stock.logic}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {stocks.length > 5 && (
                                    <tr className="bg-black/40">
                                        <td colSpan="6" className="px-6 py-2 text-[9px] text-gray-700 font-bold uppercase tracking-[0.3em] text-center">
                                            Institutional Level Alpha Scan Active
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    if (topPicks.length === 0 && exitWarnings.length === 0) {
        return (
            <div className="card daily-card p-10 flex flex-col items-center justify-center text-center bg-[#0d0d0d] border border-gray-800/50 rounded-2xl">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="1.5" className="mb-4">
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                <div className="text-gray-400 font-black uppercase text-xs tracking-widest mb-1">No Active Calls</div>
                <p className="text-[10px] text-gray-600 font-medium">Model scanning current regime for high-alpha opportunities.</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            {renderTable(topPicks, "Opportunities (Top Picks)", "green")}
            {renderTable(exitWarnings, "Exit Warnings (De-risk)", "red")}
        </div>
    );
}
