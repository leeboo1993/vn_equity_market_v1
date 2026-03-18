'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';

// Helper to calculate boxplot stats
const calculateBoxPlotStats = (data) => {
    if (!data || data.length === 0) return null;
    const sorted = [...data].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    
    const getPercentile = (p) => {
        const index = (p / 100) * (sorted.length - 1);
        const low = Math.floor(index);
        const high = Math.ceil(index);
        const weight = index - low;
        return sorted[low] * (1 - weight) + sorted[high] * weight;
    };

    const q1 = getPercentile(25);
    const median = getPercentile(50);
    const q3 = getPercentile(75);

    return { min, q1, median, q3, max };
};

const SectorValuationBoxplot = () => {
    const [historyData, setHistoryData] = useState(null);
    const [period, setPeriod] = useState('1y'); 
    const [metric, setMetric] = useState('pe'); // 'pe' or 'pb'
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [hoveredData, setHoveredData] = useState(null);
    const [loading, setLoading] = useState(true);
    const containerRef = useRef(null);

    useEffect(() => {
        fetch('/industry_valuation_history.json')
            .then(res => res.json())
            .then(data => {
                setHistoryData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch valuation history:", err);
                setLoading(false);
            });
    }, []);

    const processedData = useMemo(() => {
        if (!historyData) return [];

        const now = new Date();
        let cutoffDate = new Date();
        if (period === '1y') cutoffDate.setFullYear(now.getFullYear() - 1);
        else if (period === '2y') cutoffDate.setFullYear(now.getFullYear() - 2);
        else if (period === '5y') cutoffDate.setFullYear(now.getFullYear() - 5);
        else if (period === 'custom' && customRange.start) cutoffDate = new Date(customRange.start);
        else cutoffDate = new Date(0);

        const cutoffStr = cutoffDate.toISOString().split('T')[0];
        const endStr = customRange.end || now.toISOString().split('T')[0];

        return Object.entries(historyData).map(([code, { name, history }]) => {
            const filteredValues = history
                .filter(h => h.date >= cutoffStr && h.date <= endStr)
                .map(h => h[metric])
                .filter(v => v != null && v > 0);
            
            const stats = calculateBoxPlotStats(filteredValues);
            const current = history.length > 0 ? history[0][metric] : null;

            return {
                code,
                name: name.replace(' & ', ' & '),
                stats,
                current
            };
        }).filter(d => d.stats !== null);
    }, [historyData, period, metric, customRange]);

    if (loading) return <div className="animate-pulse h-[550px] bg-zinc-900/50 rounded-xl" />;
    
    // SVG parameters
    const baseWidth = 1000;
    const baseHeight = 480;
    const margin = { top: 40, right: 30, bottom: 90, left: 50 };
    const chartWidth = baseWidth - margin.left - margin.right;
    const chartHeight = baseHeight - margin.top - margin.bottom;

    const allValues = processedData.flatMap(d => [d.stats.min, d.stats.max, d.current].filter(v => v != null));
    const yMin = 0;
    const rawMax = Math.max(...allValues);
    const yMax = metric === 'pe' ? Math.min(50, rawMax * 1.1) : Math.min(10, rawMax * 1.1);

    const yScale = (val) => {
        const clampedVal = Math.min(yMax, Math.max(yMin, val));
        return chartHeight - ((clampedVal - yMin) / (yMax - yMin)) * chartHeight;
    };
    const xStep = chartWidth / processedData.length;

    return (
        <div className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-2xl relative h-full flex flex-col min-h-0" ref={containerRef}>
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 flex-shrink-0">
                <div>
                    <h3 className="text-xl font-bold text-white uppercase tracking-tight">Sector Valuation Range</h3>
                    <p className="text-zinc-500 text-sm">Historical {metric.toUpperCase()} Comparison</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center bg-zinc-900/80 rounded-lg p-1 border border-zinc-800">
                        {['pe', 'pb'].map(m => (
                            <button
                                key={m}
                                onClick={() => setMetric(m)}
                                className={`px-4 py-1.5 rounded-md text-[10px] font-black tracking-widest transition-all ${
                                    metric === m 
                                        ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                {m.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center bg-zinc-900/80 rounded-lg p-1 border border-zinc-800">
                        {['1y', '2y', '5y', 'all', 'custom'].map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                                    period === p 
                                        ? 'bg-emerald-500/10 text-emerald-400' 
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                {p === 'custom' ? 'Range' : p.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {period === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input 
                                type="date" 
                                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-emerald-500"
                                value={customRange.start}
                                onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                            />
                            <span className="text-zinc-600">→</span>
                            <input 
                                type="date" 
                                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-emerald-500"
                                value={customRange.end}
                                onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 relative overflow-x-auto custom-scrollbar" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 #0a0a0a' }}>
                <svg 
                    width={processedData.length * 75 + margin.left + margin.right}
                    height={baseHeight}
                    viewBox={`0 0 ${processedData.length * 75 + margin.left + margin.right} ${baseHeight}`} 
                    className="h-full overflow-visible"
                >
                    {/* Grid + Axes */}
                    {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                        const val = yMin + pct * (yMax - yMin);
                        const y = yScale(val);
                        const dynamicWidth = processedData.length * 75 + margin.left + margin.right;
                        return (
                            <g key={pct}>
                                <line x1={margin.left} y1={y + margin.top} x2={dynamicWidth - margin.right} y2={y + margin.top} stroke="#222" strokeDasharray="4 4" />
                                <text x={margin.left - 12} y={y + margin.top + 3} textAnchor="end" fill="#444" fontSize="10" fontWeight="700">{val.toFixed(1)}</text>
                            </g>
                        );
                    })}

                    {processedData.map((d, i) => {
                        const currentXStep = 75;
                        const x = margin.left + i * currentXStep + currentXStep / 2;
                        const { min, q1, median, q3, max } = d.stats;
                        
                        return (
                            <g key={d.code} 
                               onMouseEnter={() => setHoveredData({ ...d, x, y: yScale(median) + margin.top })}
                               onMouseLeave={() => setHoveredData(null)}
                               className="cursor-pointer group"
                            >
                                {/* Whisker */}
                                <line x1={x} y1={yScale(min) + margin.top} x2={x} y2={yScale(max) + margin.top} stroke="#444" strokeWidth="1" />
                                <line x1={x-6} y1={yScale(min) + margin.top} x2={x+6} y2={yScale(min) + margin.top} stroke="#444" strokeWidth="1" />
                                <line x1={x-6} y1={yScale(max) + margin.top} x2={x+6} y2={yScale(max) + margin.top} stroke="#444" strokeWidth="1" />
                                
                                {/* Box */}
                                <rect 
                                    x={x - 12} 
                                    y={yScale(q3) + margin.top} 
                                    width="24" 
                                    height={Math.max(1, yScale(q1) - yScale(q3))}
                                    fill={hoveredData?.code === d.code ? "rgba(16, 185, 129, 0.3)" : "rgba(16, 185, 129, 0.1)"}
                                    stroke={hoveredData?.code === d.code ? "#00ff7f" : "rgba(0, 255, 127, 0.5)"}
                                    strokeWidth="1.5"
                                    className="transition-all"
                                />
                                
                                {/* Median */}
                                <line x1={x - 12} y1={yScale(median) + margin.top} x2={x + 12} y2={yScale(median) + margin.top} stroke="#10b981" strokeWidth="2.5" />

                                {/* Current */}
                                {d.current && (
                                    <circle 
                                        cx={x} 
                                        cy={yScale(d.current) + margin.top} 
                                        r="4" 
                                        fill="#fff" 
                                        stroke="#10b981" 
                                        strokeWidth="2"
                                    />
                                )}

                                {/* Horizontal Multi-line Label */}
                                <g transform={`translate(${x}, ${baseHeight - margin.bottom + 25})`}>
                                    <text textAnchor="middle" fill="#666" fontSize="8" fontWeight="700" className="uppercase tracking-tighter">
                                        {d.name.split(' ').map((word, wi) => (
                                            <tspan x="0" dy={wi > 0 ? "1.2em" : "0"} key={wi}>{word}</tspan>
                                        ))}
                                    </text>
                                </g>
                            </g>
                        );
                    })}

                    {/* Tooltip */}
                    {hoveredData && (
                        <g transform={`translate(${hoveredData.x > (processedData.length * 75) * 0.7 ? hoveredData.x - 200 : hoveredData.x + 20}, ${Math.max(margin.top, hoveredData.y - 120)})`} style={{ pointerEvents: 'none' }}>
                            <rect width="180" height="130" rx="4" fill="rgba(6, 6, 6, 0.95)" stroke="#222" strokeWidth="1" />
                            <text x="12" y="24" fill="#00ff7f" fontSize="11" fontWeight="900" className="uppercase">{hoveredData.name}</text>
                            
                            <text x="12" y="48" fill="#888" fontSize="9">CURRENT {metric.toUpperCase()}:</text>
                            <text x="168" y="48" textAnchor="end" fill="#fff" fontSize="11" fontWeight="900">{hoveredData.current?.toFixed(2)}x</text>
                            
                            <text x="12" y="66" fill="#888" fontSize="9">MEDIAN (AVG):</text>
                            <text x="168" y="66" textAnchor="end" fill="#00ff7f" fontSize="11" fontWeight="900">{hoveredData.stats.median?.toFixed(2)}x</text>
                            
                            <text x="12" y="88" fill="#666" fontSize="9">HISTORICAL RANGE:</text>
                            <text x="168" y="88" textAnchor="end" fill="#666" fontSize="9">{hoveredData.stats.min?.toFixed(2)} - {hoveredData.stats.max?.toFixed(2)}</text>
                            
                            <text x="12" y="106" fill="#666" fontSize="9">25th - 75th (IQR):</text>
                            <text x="168" y="106" textAnchor="end" fill="#666" fontSize="9">{hoveredData.stats.q1?.toFixed(2)} - {hoveredData.stats.q3?.toFixed(2)}</text>
                        </g>
                    )}
                </svg>
            </div>
            
            <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[9px] text-zinc-600 uppercase tracking-widest font-black flex-shrink-0 border-t border-white/5 pt-4">
                <div className="flex items-center gap-2 pt-1"><div className="w-3 h-2.5 bg-emerald-500/10 border border-emerald-500/40"></div> Intra-Quartile Range</div>
                <div className="flex items-center gap-2 pt-1"><div className="w-3 h-0.5 bg-emerald-500"></div> Historical Median</div>
                <div className="flex items-center gap-2 pt-1"><div className="w-2 h-2 rounded-full bg-white border border-emerald-500"></div> Current {metric.toUpperCase()}</div>
            </div>
        </div>
    );
};

export default SectorValuationBoxplot;
