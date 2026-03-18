'use client';

import React from 'react';

export default function ModelEvaluationWidget({ evaluation }) {
    if (!evaluation || !evaluation.target_date) {
        return (
            <div className="card daily-card p-6 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-gray-600">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <p className="text-gray-500 text-sm font-medium">Evaluation data pending for this session.</p>
                <p className="text-[10px] text-gray-600 max-w-[200px]">Actual returns are calculated only after the market close of the target date.</p>
            </div>
        );
    }

    const isSuccess = evaluation.direction_hit;
    const returnDiff = (evaluation.actual_return - evaluation.predicted_return) * 100;

    return (
        <div className="card daily-card overflow-hidden" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className={`p-4 flex items-center justify-between ${isSuccess ? 'bg-emerald-500/5' : 'bg-rose-500/5'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSuccess ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'}`}>
                        {isSuccess ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider m-0">
                            {isSuccess ? 'Prediction Success' : 'Prediction Miss'}
                        </h3>
                        <p className="text-[10px] text-gray-500 font-bold m-0">Evaluation for {evaluation.target_date}</p>
                    </div>
                </div>

                <div className="text-right">
                    <div className={`text-xl font-black ${isSuccess ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {Math.abs(returnDiff).toFixed(2)}% <span className="text-[10px] text-gray-600 uppercase">Delta</span>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-6">
                {/* Comparison Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111] p-3 rounded-lg border border-[#222]">
                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Forecast</p>
                        <p className="text-lg font-bold text-white">
                            {(evaluation.predicted_return * 100).toFixed(2)}%
                        </p>
                        <p className="text-[10px] text-blue-400 font-medium">{evaluation.predicted_bucket}</p>
                    </div>
                    <div className="bg-[#111] p-3 rounded-lg border border-[#222]">
                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Actual</p>
                        <p className={`text-lg font-bold ${evaluation.actual_return >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {(evaluation.actual_return * 100).toFixed(2)}%
                        </p>
                        <p className="text-[10px] text-gray-600 font-medium">Realized Return</p>
                    </div>
                </div>

                {/* Explainability Section */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Model Explainability / Reason</span>
                    </div>
                    <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-xl">
                        <p className="text-xs text-amber-200/80 leading-relaxed font-medium italic">
                            "{evaluation.explanation || 'The model encountered an edge case where volatility regime shifts bypassed standard triggers.'}"
                        </p>
                    </div>
                </div>

                {/* Features Delta Alert */}
                {!isSuccess && evaluation.explanation && (
                    <div className="flex items-start gap-3 bg-[#161616] p-3 rounded-lg border border-dashed border-[#333]">
                        <div className="text-rose-500 mt-0.5">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4"></path><path d="M12 16h.01"></path></svg>
                        </div>
                        <p className="text-[10px] text-gray-400 font-medium leading-normal">
                            Model logic drifted from reality. This is typically caused by unexpected macro shocks or structural regime breaks detected post-trade.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
