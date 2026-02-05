'use client';

import React, { useState, useEffect, useMemo } from 'react';
import BankingCharts from './BankingCharts';
import BankingTable from './BankingTable';
import StockPriceChart from './StockPriceChart';
import MultiSelect from './ui/MultiSelect';

export default function BankingDashboard() {
    // === loaded data ===
    const [quarterlyData, setQuarterlyData] = useState([]);
    const [yearlyData, setYearlyData] = useState([]);
    const [forecastData, setForecastData] = useState([]);
    const [keyItems, setKeyItems] = useState([]);
    const [loading, setLoading] = useState(true);

    // === UI State ===
    const [activeTab, setActiveTab] = useState('analysis');
    const [dbOption, setDbOption] = useState('Quarterly');
    const [includeForecast, setIncludeForecast] = useState(false);

    // === Selection State === 
    const [chartTickers, setChartTickers] = useState(['Private_1']);
    const [chartPeriods, setChartPeriods] = useState(10);
    const [chartMetrics, setChartMetrics] = useState(['TOI', 'PBT', 'NIM', 'Loan yield', 'NPL', 'GROUP 2', 'New NPL', 'New G2']);

    const [tableTicker, setTableTicker] = useState('Private_1');
    const [tablePeriods, setTablePeriods] = useState(6);
    const [growthType, setGrowthType] = useState('QoQ');

    // Load Data
    useEffect(() => {
        async function load() {
            try {
                const [qRes, yRes, fRes, kRes] = await Promise.all([
                    fetch('/data/banking/banking_quarterly.json'),
                    fetch('/data/banking/banking_yearly.json'),
                    fetch('/data/banking/banking_forecast.json'),
                    fetch('/data/banking/key_items.json')
                ]);

                if (qRes.ok) {
                    const d = await qRes.json();
                    if (d && d.length) setQuarterlyData(d);
                    else {
                        const sample = await fetch('/data/banking/sample_quarterly.json').then(r => r.json());
                        setQuarterlyData(sample);
                    }
                }
                if (yRes.ok) setYearlyData(await yRes.json());
                if (fRes.ok) setForecastData(await fRes.json());
                if (kRes.ok) setKeyItems(await kRes.json());
            } catch (err) {
                console.error("Failed to load banking data", err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const currentData = useMemo(() => {
        return dbOption === 'Quarterly' ? quarterlyData : yearlyData;
    }, [dbOption, quarterlyData, yearlyData]);

    const bankTypes = ['Sector', 'SOCB', 'Private_1', 'Private_2', 'Private_3'];
    const allTickers = useMemo(() => {
        if (!currentData.length) return bankTypes;
        const tickers = [...new Set(currentData.map(d => d.TICKER))].filter(t => t).sort();
        const others = tickers.filter(t => !bankTypes.includes(t));
        return [...bankTypes, ...others];
    }, [currentData]);

    const availableMetrics = useMemo(() => {
        const defaults = ['TOI', 'PBT', 'NIM', 'Loan yield', 'NPL', 'GROUP 2', 'New NPL', 'New G2', 'Loan', 'Deposit'];
        if (keyItems.length) {
            return [...new Set([...defaults, ...keyItems.map(k => k.Name)])];
        }
        return defaults;
    }, [keyItems]);

    const isSingleStock = useMemo(() => {
        return tableTicker && tableTicker.length === 3 && !bankTypes.includes(tableTicker);
    }, [tableTicker, bankTypes]);


    if (loading) return <div className="p-8 text-accent">Loading Dashboard...</div>;

    return (
        <div className="flex flex-col gap-6">

            {/* Top Navigation & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">

                {/* Left: View Mode Pills (Banking Plot / Company Table) */}
                <div className="bg-[#1e1e1e] p-1 rounded-lg flex items-center">
                    <button
                        onClick={() => setActiveTab('analysis')}
                        className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-all ${activeTab === 'analysis'
                            ? 'bg-[#00ff7f] text-black shadow-sm'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Banking Plot
                    </button>
                    <button
                        onClick={() => setActiveTab('financials')}
                        className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-all ${activeTab === 'financials'
                            ? 'bg-[#00ff7f] text-black shadow-sm'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Company Table
                    </button>
                </div>

                {/* Right: Data Controls */}
                <div className="flex items-center gap-4 bg-[#1e1e1e] p-1.5 rounded-lg">
                    {/* Period Toggle Pills */}
                    <div className="flex items-center bg-[#2d2d2d] rounded px-1 py-0.5">
                        <button
                            onClick={() => setDbOption('Quarterly')}
                            className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${dbOption === 'Quarterly' ? 'bg-[#00ff7f] text-black' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Quarterly
                        </button>
                        <button
                            onClick={() => setDbOption('Yearly')}
                            className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${dbOption === 'Yearly' ? 'bg-[#00ff7f] text-black' : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Yearly
                        </button>
                    </div>

                    <div className="h-4 w-[1px] bg-gray-700 mx-1"></div>

                    <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white text-[11px] select-none px-2">
                        <input
                            type="checkbox"
                            checked={includeForecast}
                            onChange={e => setIncludeForecast(e.target.checked)}
                            className="rounded bg-[#222] border-gray-600 text-[#00ff7f] focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                        />
                        Include Forecast
                    </label>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'analysis' && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-300">

                    {/* Inline Filter Row (No Card Background) */}
                    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '16px', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '8px' }}>

                        {/* Ticker Filter */}
                        <div className="flex items-center gap-2">
                            <label className="text-[12px] font-medium text-gray-400 whitespace-nowrap">Ticker:</label>
                            <div className="w-[200px]">
                                <MultiSelect
                                    options={allTickers}
                                    value={chartTickers}
                                    onChange={setChartTickers}
                                    placeholder="Select Tickers..."
                                />
                            </div>
                        </div>

                        {/* Period Filter */}
                        <div className="flex items-center gap-2">
                            <label className="text-[12px] font-medium text-gray-400 whitespace-nowrap">Periods:</label>
                            <div className="flex bg-[#1e1e1e] border border-gray-700 rounded h-[38px] items-center px-2">
                                <button
                                    onClick={() => setChartPeriods(Math.max(1, chartPeriods - 1))}
                                    className="text-gray-400 hover:text-white px-2 text-lg leading-none"
                                >
                                    -
                                </button>
                                <span className="text-white text-[13px] font-mono px-2 min-w-[24px] text-center border-x border-gray-800">
                                    {chartPeriods}
                                </span>
                                <button
                                    onClick={() => setChartPeriods(Math.min(50, chartPeriods + 1))}
                                    className="text-gray-400 hover:text-white px-2 text-lg leading-none"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Metrics Filter */}
                        <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                            <label className="text-[12px] font-medium text-gray-400 whitespace-nowrap">Metrics:</label>
                            <div className="flex-1">
                                <MultiSelect
                                    options={availableMetrics}
                                    value={chartMetrics}
                                    onChange={setChartMetrics}
                                    placeholder="Select Metrics..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div>
                        <h3 className="text-[13px] font-semibold text-[#00ff7f] mb-3 tracking-wide flex items-center gap-2">
                            Banking Metrics
                            <span className="h-[1px] flex-1 bg-gray-800"></span>
                        </h3>
                        <BankingCharts
                            data={currentData}
                            forecastData={forecastData}
                            includeForecast={includeForecast}
                            allTickers={allTickers}
                            availableMetrics={availableMetrics}
                            tickers={chartTickers}
                            setTickers={setChartTickers}
                            periods={chartPeriods}
                            setPeriods={setChartPeriods}
                            metrics={chartMetrics}
                            setMetrics={setChartMetrics}
                            dbOption={dbOption}
                        />
                    </div>
                </div>
            )}

            {activeTab === 'financials' && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                    <div className="card !p-4 bg-[#141414]" style={{ minHeight: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end', gap: '16px', flexWrap: 'nowrap' }}>
                            <div className="space-y-1 min-w-[200px]">
                                <label className="text-[10px] font-bold text-[#888] uppercase">Ticker / Sector</label>
                                <select
                                    value={tableTicker}
                                    onChange={e => setTableTicker(e.target.value)}
                                    className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.18)] rounded h-[38px] px-3 text-white focus:border-accent outline-none text-[11px]"
                                >
                                    {allTickers.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1 w-[100px]">
                                <label className="text-[10px] font-bold text-[#888] uppercase">History Periods</label>
                                <input
                                    type="number"
                                    value={tablePeriods}
                                    onChange={e => setTablePeriods(parseInt(e.target.value) || 6)}
                                    className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.18)] rounded h-[38px] px-3 text-white focus:border-accent outline-none text-[11px]"
                                />
                            </div>
                            {dbOption === 'Quarterly' && (
                                <div className="space-y-1 w-[150px]">
                                    <label className="text-[10px] font-bold text-[#888] uppercase">Growth Calculation</label>
                                    <select
                                        value={growthType}
                                        onChange={e => setGrowthType(e.target.value)}
                                        className="w-full bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.18)] rounded h-[38px] px-3 text-white focus:border-accent outline-none text-[11px]"
                                    >
                                        <option value="QoQ">QoQ</option>
                                        <option value="YoY">YoY</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    {isSingleStock && <StockPriceChart ticker={tableTicker} />}

                    <div className="card !p-0 !bg-transparent !border-0 !shadow-none" style={{ minHeight: 0 }}>
                        <BankingTable
                            data={currentData}
                            forecastData={forecastData}
                            includeForecast={includeForecast}
                            allTickers={allTickers}
                            ticker={tableTicker}
                            periods={tablePeriods}
                            growthType={growthType}
                            dbOption={dbOption}
                            keyItems={keyItems}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
