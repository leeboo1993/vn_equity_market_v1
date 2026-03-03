'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import MacroChart from '../components/MacroChart';
import MacroKPICard from '../components/MacroKPICard';

export default function MacroResearchPage() {
    const [data, setData] = useState(null);
    const [macroResearch, setMacroResearch] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('global'); // 'global' or 'vietnam' for charts
    const [viewMode, setViewMode] = useState('articles'); // 'articles' or 'economics'
    const [selectedArticle, setSelectedArticle] = useState(null);
    const [selectedBroker, setSelectedBroker] = useState('All');

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch Economics Data
                const res = await fetch('/data/macro_data.json');
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }

                // Fetch Macro Research Articles
                const reportRes = await fetch('/api/daily-report');
                if (reportRes.ok) {
                    const reportData = await reportRes.json();
                    setMacroResearch(reportData.macro_research || []);
                }
            } catch (error) {
                console.error("Failed to load macro data", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const getMacroBadgeColors = (broker) => {
        if (!broker) return { bg: '#2a2a2a', color: '#999' };
        const b = broker.toLowerCase();
        if (b.includes('gavekal')) return { bg: '#1e3a8a', color: '#93c5fd' }; // Dark Blue / Light Blue
        if (b.includes('goldman')) return { bg: '#78350f', color: '#fcd34d' }; // Dark Orange / Yellow
        if (b.includes('ssi')) return { bg: '#4c1d95', color: '#c4b5fd' }; // Dark Purple / Light Purple
        if (b.includes('13d')) return { bg: '#14532d', color: '#86efac' }; // Dark Green / Light Green
        return { bg: '#1f2937', color: '#d1d5db' }; // Default Dark theme
    };

    const filteredArticles = macroResearch.filter(item => {
        if (selectedBroker === 'All') return true;
        const sourceName = item.source || item.Source || item.broker || '';
        return sourceName.includes(selectedBroker);
    });

    const renderArticles = () => {
        if (loading) return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00ff7f]"></div>
            </div>
        );

        return (
            <div className="space-y-4 animate-in fade-in duration-500">
                {/* Filter Chips */}
                <div className="flex gap-2 flex-wrap mb-4">
                    {['All', 'Goldman Sachs', 'Gavekal', 'SSI', '13D'].map(broker => (
                        <button
                            key={broker}
                            onClick={() => setSelectedBroker(broker)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedBroker === broker
                                ? 'bg-[#027368] text-white border-[#027368]'
                                : 'bg-[#262626] text-gray-400 border border-[#333] hover:text-white'
                                }`}
                        >
                            {broker}
                        </button>
                    ))}
                </div>

                {/* Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                    {filteredArticles.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-gray-500 bg-[#111] rounded-xl border border-[#222]">
                            No research articles found matching your filters.
                        </div>
                    ) : (
                        filteredArticles.map((item, i) => {
                            const sourceName = item.source || item.Source || item.broker || 'UNKNOWN';
                            const dateStr = item.date ? item.date.substring(0, 10) : (item.DatePublish ? item.DatePublish.substring(0, 10) : '');
                            const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
                            const titleStr = item.title || item.Title || 'Untitled';
                            const summaryStr = item.summary || item.Summary || item.snippet || item.body || '';
                            const badgeColors = getMacroBadgeColors(sourceName);

                            return (
                                <div
                                    key={i}
                                    onClick={() => setSelectedArticle(item)}
                                    className="p-5 bg-[#161616] border border-[#2a2a2a] rounded-xl cursor-pointer hover:border-[#444] hover:-translate-y-1 transition-all group"
                                >
                                    <div className="flex justify-between items-center mb-4">
                                        <span
                                            className="px-2 py-1 rounded text-[11px] font-bold"
                                            style={{ backgroundColor: badgeColors.bg, color: badgeColors.color }}
                                        >
                                            {sourceName}
                                        </span>
                                        <span className="text-[12px] text-gray-500 font-mono italic">{formattedDate}</span>
                                    </div>
                                    <h3 className="text-white font-semibold text-[15px] leading-snug mb-3 group-hover:text-[#00ff7f] transition-colors line-clamp-2">
                                        {titleStr}
                                    </h3>
                                    <p className="text-gray-400 text-[13px] leading-relaxed line-clamp-3">
                                        {summaryStr}
                                    </p>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    };

    const renderEconomics = () => {
        if (loading) return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00ff7f]"></div>
            </div>
        );

        if (!data) return <div className="p-8 text-center text-gray-500">Data not available yet. Please run the update script.</div>;

        const categoryData = activeTab === 'global' ? data.global : data.vietnam;

        if (!categoryData || Object.keys(categoryData).length === 0) {
            return (
                <div className="p-12 text-center bg-[#111] rounded-xl border border-[#222]">
                    <p className="text-gray-300 font-medium">No data found for this category.</p>
                    {activeTab === 'global' && <p className="text-sm text-gray-500 mt-2">Ensure FRED_API_KEY is configured.</p>}
                </div>
            );
        }

        const entries = Object.entries(categoryData);
        const primaryColor = activeTab === 'global' ? "#00d2ff" : "#ff4444";

        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {entries.map(([key, item]) => (
                        <MacroKPICard
                            key={`kpi-${key}`}
                            title={item.name}
                            data={item.data}
                        />
                    ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {entries.map(([key, item]) => (
                        <MacroChart
                            key={`chart-${key}`}
                            title={item.name}
                            data={item.data}
                            color={primaryColor}
                        />
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="text-white pt-4">
            <main className="main-container px-3 md:px-6 py-8">
                {/* Header & Sub-Navigation */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-[#222] pb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-[#00ff7f]">Macro Insights</h1>
                        <p className="text-gray-400 text-sm mt-1">Global analysis and economic indicators.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Primary View Mode Switch (Articles vs Economics) */}
                        <div className="bg-[#111] p-1 rounded-lg border border-[#333] flex shadow-sm">
                            <button
                                onClick={() => setViewMode('articles')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'articles'
                                    ? 'bg-[#027368] text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Articles
                            </button>
                            <button
                                onClick={() => setViewMode('economics')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'economics'
                                    ? 'bg-[#027368] text-white shadow-lg'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                Economics
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub-Tabs (Only for Economics) */}
                {viewMode === 'economics' && (
                    <div className="flex justify-start mb-6">
                        <div className="bg-[#111] p-1 rounded-lg border border-[#333] flex shadow-sm">
                            <button
                                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'global'
                                    ? 'bg-[#00ff7f] text-black'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                                onClick={() => setActiveTab('global')}
                            >
                                GLOBAL
                            </button>
                            <button
                                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${activeTab === 'vietnam'
                                    ? 'bg-[#00ff7f] text-black'
                                    : 'text-gray-400 hover:text-white'
                                    }`}
                                onClick={() => setActiveTab('vietnam')}
                            >
                                VIETNAM
                            </button>
                        </div>
                    </div>
                )}

                {viewMode === 'articles' ? renderArticles() : renderEconomics()}

                {/* ARTICLE MODAL */}
                {selectedArticle && (
                    <div
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
                        onClick={() => setSelectedArticle(null)}
                    >
                        <div
                            className="bg-[#18181b] border border-[#27272a] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Close */}
                            <button
                                onClick={() => setSelectedArticle(null)}
                                className="absolute top-4 right-4 text-gray-500 hover:text-white p-2 transition-colors z-10"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>

                            {/* Modal Header */}
                            <div className="p-8 pb-4">
                                <h2 className="text-2xl font-bold text-white mb-4 pr-10 leading-tight">
                                    {selectedArticle.title || selectedArticle.Title}
                                </h2>

                                <div className="flex flex-wrap items-center gap-4 mb-6">
                                    <span
                                        className="px-3 py-1 rounded text-xs font-bold"
                                        style={{
                                            backgroundColor: getMacroBadgeColors(selectedArticle.source || selectedArticle.broker).bg,
                                            color: getMacroBadgeColors(selectedArticle.source || selectedArticle.broker).color
                                        }}
                                    >
                                        {selectedArticle.source || selectedArticle.broker || 'Source'}
                                    </span>
                                    <span className="text-gray-400 text-sm font-medium">
                                        {selectedArticle.date
                                            ? new Date(selectedArticle.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                            : ''}
                                    </span>
                                    {selectedArticle.author && (
                                        <span className="text-gray-500 text-sm italic">
                                            by {selectedArticle.author}
                                        </span>
                                    )}
                                </div>

                                {/* Summary Box - Premium Look like screenshot */}
                                <div className="bg-[#27272a]/40 border-l-[4px] border-[#027368] p-6 rounded-r-xl mb-8">
                                    <p className="text-[#e4e4e7] leading-relaxed text-[15px]">
                                        <span className="font-bold text-white uppercase text-xs tracking-wider mr-2">Summary:</span>
                                        {selectedArticle.summary || selectedArticle.Summary || selectedArticle.snippet}
                                    </p>
                                </div>

                                {/* Body Content */}
                                <div className="text-[#d4d4d8] leading-[1.8] text-[16px] space-y-6 pb-12 font-light">
                                    {(selectedArticle.body || '').split('\n').map((para, i) => (
                                        para.trim() ? <p key={i}>{para}</p> : <br key={i} />
                                    ))}
                                    {(!selectedArticle.body && !selectedArticle.Summary) && (
                                        <div className="text-center py-12 text-gray-600 italic">
                                            Full article content not available.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {data && (
                    <div className="text-center md:text-right text-xs text-gray-500 mt-12 pb-8">
                        Data Source: FRED (Global) & Vnstock (Vietnam) • {viewMode === 'economics' ? `Last Updated: ${new Date(data.last_updated).toLocaleString()}` : ''}
                    </div>
                )}
            </main>
        </div>
    );
}
