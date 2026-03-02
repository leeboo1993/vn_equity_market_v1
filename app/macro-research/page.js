'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';
import MacroChart from '../components/MacroChart';
import MacroKPICard from '../components/MacroKPICard';

export default function MacroResearchPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('global');

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/data/macro_data.json');
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (error) {
                console.error("Failed to load macro data", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const renderContent = () => {
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
        // Use neon blue for global, neon red for vietnam in dark mode
        const primaryColor = activeTab === 'global' ? "#00d2ff" : "#ff4444";

        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                {/* KPI Section */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {entries.map(([key, item]) => (
                        <MacroKPICard
                            key={`kpi-${key}`}
                            title={item.name}
                            data={item.data}
                        />
                    ))}
                </div>

                {/* Charts Section */}
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
            <main className="main-container px-6 py-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-[#00ff7f]">Economic Dashboard</h1>
                        <p className="text-gray-400 text-sm mt-1">Track key indicators for Global and Vietnamese markets.</p>
                    </div>

                    {/* Modern Tabs - Dark Mode */}
                    <div className="bg-[#111] p-1 rounded-lg border border-[#333] flex shadow-sm">
                        <button
                            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'global'
                                ? 'bg-[#00ff7f] text-black shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-[#222]'
                                }`}
                            onClick={() => setActiveTab('global')}
                        >
                            Global Macro
                        </button>
                        <button
                            className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'vietnam'
                                ? 'bg-[#00ff7f] text-black shadow-lg'
                                : 'text-gray-400 hover:text-white hover:bg-[#222]'
                                }`}
                            onClick={() => setActiveTab('vietnam')}
                        >
                            Vietnam Economy
                        </button>
                    </div>
                </div>

                {renderContent()}

                {data && (
                    <div className="text-center md:text-right text-xs text-gray-500 mt-12 pb-8">
                        Data Source: FRED (Global) & Vnstock (Vietnam) • Last Updated: {new Date(data.last_updated).toLocaleString()}
                    </div>
                )}
            </main>
        </div>
    );
}
