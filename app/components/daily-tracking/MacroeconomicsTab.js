'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine
} from 'recharts';
import MoneyMarketTab from './MoneyMarketTab';

const COLORS = {
    teal: '#027368',
    blue: '#3B82F6',
    purple: '#8B5CF6',
    gold: '#F59E0B',
    red: '#EF4444',
    green: '#10B981',
    gray: '#64748B',
    darkBg: '#020617',
    cardBg: '#0f172a',
    border: '#1e293b'
};

const BANK_COLORS = {
    'VPB': '#008466', 'TCB': '#2962FF', 'MBB': '#7B1FA2', 'BID': '#D4A82F',
    'VCB': '#00B8D4', 'CTG': '#C62828', 'ACB': '#1565C0', 'HDB': '#E65100',
    'VIB': '#F9A825', 'MSB': '#EF6C00', 'STB': '#2E7D32', 'LPB': '#D32F2F',
    'TPB': '#7B1FA2', 'SHB': '#F57C00', 'EIB': '#1976D2', 'OCB': '#388E3C',
    'SSB': '#C2185B', 'ABB': '#0097A7'
};

const ALL_BANKS = ['VPB', 'TCB', 'MBB', 'BID', 'VCB', 'CTG', 'ACB', 'HDB', 'VIB', 'MSB', 'STB'];

const dtFormatter = (v) => v ? v.substring(5).replace('-', '/') : '';

// Trend Icon Component
const TrendIcon = ({ trend }) => {
    if (trend === 'up') return (
        <svg width="10" height="10" viewBox="0 0 24 24" style={{ color: COLORS.green }}>
            <path d="M12 4l10 16H2z" fill="currentColor" />
        </svg>
    );
    if (trend === 'down') return (
        <svg width="10" height="10" viewBox="0 0 24 24" style={{ color: COLORS.red }}>
            <path d="M12 20L2 4h20z" fill="currentColor" />
        </svg>
    );
    return (
        <svg width="10" height="10" viewBox="0 0 24 24" style={{ color: COLORS.gray }}>
            <rect x="4" y="10" width="16" height="4" fill="currentColor" />
        </svg>
    );
};

// Initial Mock Data (Fallback if API fails) — grouped by region
const INITIAL_INDICES = [
    // Vietnam
    { id: 'VNINDEX', name: 'VN-Index', region: 'Vietnam', close: 1176.84, turnover: 474, turnoverVnd: 12050, turnover5dAvg: 450, turnover5dAvgVnd: 11500, turnoverVs5d: 5.3, turnover10dAvg: 440, turnover10dAvgVnd: 11200, turnoverVs10d: 7.7, turnover1mAvg: 420, turnover1mAvgVnd: 10800, turnoverVs1m: 12.8, d1: -2.25, d1m: 1.2, d3m: 3.5, d6m: 5.0, d12m: 10.0, ytd: 10.0, pe: 14.9, pb: 1.7, resistance: 1200, support: 1150, rsi: 52, ma20: 1160, macd: 5.2, date: 'N/A' },
    { id: 'HNXINDEX', name: 'HNX-Index', region: 'Vietnam', close: 253.64, turnover: 44, turnoverVnd: 1120, turnover5dAvg: 42, turnover5dAvgVnd: 1080, turnoverVs5d: 4.8, turnover10dAvg: 40, turnover10dAvgVnd: 1020, turnoverVs10d: 10.0, turnover1mAvg: 38, turnover1mAvgVnd: 980, turnoverVs1m: 15.7, d1: -0.5, d1m: 0.8, d3m: 2.1, d6m: 3.5, d12m: 8.0, ytd: 3.0, pe: 16.1, pb: 1.3, resistance: 260, support: 245, rsi: 50, ma20: 250, macd: 1.2, date: 'N/A' },
    { id: 'VN30', name: 'VN30', region: 'Vietnam', close: 1904.19, turnover: 250, turnoverVnd: 6350, turnover5dAvg: 240, turnover5dAvgVnd: 6100, turnoverVs5d: 4.2, turnover10dAvg: 235, turnover10dAvgVnd: 5980, turnoverVs10d: 6.4, turnover1mAvg: 220, turnover1mAvgVnd: 5600, turnoverVs1m: 13.6, d1: -2.0, d1m: 1.0, d3m: 3.2, d6m: 4.8, d12m: 9.0, ytd: 8.0, pe: 14.9, pb: 1.7, resistance: 1950, support: 1850, rsi: 52, ma20: 1880, macd: 4.5, date: 'N/A' },
    // USA
    { id: 'SPX', name: 'S&P 500', region: 'USA', close: 5700, turnover: 65000, turnover5dAvg: 64000, turnoverVs5d: 1.5, turnover10dAvg: 63000, turnoverVs10d: 3.2, turnover1mAvg: 62000, turnoverVs1m: 4.8, d1: -0.9, d1m: 2.1, d3m: 5.2, d6m: 10.5, d12m: 15.0, ytd: 8.0, pe: 26.0, pb: 5.0, resistance: 6000, support: 5600, rsi: 55, ma20: 5650, macd: 12.5, date: 'N/A' },
    { id: 'NASDAQ', name: 'Nasdaq', region: 'USA', close: 18000, turnover: 50000, turnover5dAvg: 49000, turnoverVs5d: 2.0, turnover10dAvg: 48000, turnoverVs10d: 4.1, turnover1mAvg: 47000, turnoverVs1m: 6.3, d1: -1.2, d1m: 1.5, d3m: 4.8, d6m: 9.5, d12m: 14.0, ytd: 6.0, pe: 32.0, pb: 7.0, resistance: 19000, support: 17500, rsi: 52, ma20: 17800, macd: 25.0, date: 'N/A' },
    { id: 'DJI', name: 'Dow Jones', region: 'USA', close: 43000, turnover: 14000, turnover5dAvg: 13800, turnoverVs5d: 1.4, turnover10dAvg: 13500, turnoverVs10d: 3.7, turnover1mAvg: 13000, turnoverVs1m: 7.7, d1: -0.5, ytd: 5.0, pe: 22.0, pb: 5.0, resistance: 45000, support: 42000, rsi: 54, ma20: 42500, macd: 85.0, date: 'N/A' },
    // Europe
    { id: 'FTSE', name: 'FTSE 100', region: 'UK', close: 8288, turnover: 2800, turnover5dAvg: 2750, turnoverVs5d: 1.8, turnover10dAvg: 2700, turnoverVs10d: 3.7, turnover1mAvg: 2600, turnoverVs1m: 7.7, d1: 0.1, ytd: 5.0, pe: 14.0, pb: 1.9, resistance: 8500, support: 8100, rsi: 53, ma20: 8200, macd: 12.0, date: 'N/A' },
    { id: 'DAX', name: 'DAX', region: 'Germany', close: 22000, turnover: 5000, turnover5dAvg: 4900, turnoverVs5d: 2.0, turnover10dAvg: 4800, turnoverVs10d: 4.2, turnover1mAvg: 4700, turnoverVs1m: 6.4, d1: 0.4, ytd: 14.0, pe: 17.0, pb: 1.8, resistance: 23000, support: 21000, rsi: 60, ma20: 21500, macd: 150.0, date: 'N/A' },
    { id: 'CAC40', name: 'CAC 40', region: 'France', close: 8200, turnover: 3500, turnover5dAvg: 3400, turnoverVs5d: 2.9, turnover10dAvg: 3300, turnoverVs10d: 6.1, turnover1mAvg: 3200, turnoverVs1m: 9.4, d1: 0.2, ytd: 8.0, pe: 16.0, pb: 1.7, resistance: 8500, support: 8000, rsi: 55, ma20: 8100, macd: 25.0, date: 'N/A' },
    // China
    { id: 'SSE', name: 'Shanghai (SSE)', region: 'China', close: 3300, turnover: 40000, turnover5dAvg: 39000, turnoverVs5d: 2.6, turnover10dAvg: 38000, turnoverVs10d: 5.3, turnover1mAvg: 37000, turnoverVs1m: 8.1, d1: 0.3, ytd: 2.0, pe: 13.0, pb: 1.3, resistance: 3500, support: 3100, rsi: 51, ma20: 3200, macd: 10.0, date: 'N/A' },
    { id: 'CSI300', name: 'CSI 300', region: 'China', close: 3900, turnover: 35000, turnover5dAvg: 34000, turnoverVs5d: 2.9, turnover10dAvg: 33000, turnoverVs10d: 6.1, turnover1mAvg: 32000, turnoverVs1m: 9.4, d1: 0.5, ytd: 3.0, pe: 14.0, pb: 1.5, resistance: 4100, support: 3700, rsi: 53, ma20: 3800, macd: 15.0, date: 'N/A' },
    { id: 'HSI', name: 'Hang Seng', region: 'Hong Kong', close: 25000, turnover: 7000, turnover5dAvg: 6800, turnoverVs5d: 2.9, turnover10dAvg: 6600, turnoverVs10d: 6.1, turnover1mAvg: 6400, turnoverVs1m: 9.4, d1: 1.0, ytd: 12.0, pe: 10.0, pb: 1.0, resistance: 27000, support: 24000, rsi: 58, ma20: 24500, macd: 120.0, date: 'N/A' },
    // Asia
    { id: 'N225', name: 'Nikkei 225', region: 'Japan', close: 38000, turnover: 18000, turnover5dAvg: 17500, turnoverVs5d: 2.9, turnover10dAvg: 17000, turnoverVs10d: 5.9, turnover1mAvg: 16500, turnoverVs1m: 9.1, d1: 0.4, ytd: 10.0, pe: 23.0, pb: 2.1, resistance: 40000, support: 36000, rsi: 54, ma5: 38000, ma20: 37500, macd: 250.0, techRating: 'Neutral', date: 'N/A' },
    { id: 'KOSPI', name: 'KOSPI', region: 'Korea', close: 2600, turnover: 8000, turnover5dAvg: 7800, turnoverVs5d: 2.6, turnover10dAvg: 7600, turnoverVs10d: 5.3, turnover1mAvg: 7400, turnoverVs1m: 8.1, d1: 0.2, ytd: 3.0, pe: 12.0, pb: 1.0, resistance: 2800, support: 2500, rsi: 50, ma5: 2600, ma20: 2550, macd: 15.0, techRating: 'Neutral', date: 'N/A' },
    { id: 'ASX200', name: 'ASX 200', region: 'Australia', close: 8200, turnover: 5000, turnover5dAvg: 4900, turnoverVs5d: 2.0, turnover10dAvg: 4800, turnoverVs10d: 4.2, turnover1mAvg: 4700, turnoverVs1m: 6.4, d1: 0.1, ytd: 4.0, pe: 18.0, pb: 2.2, resistance: 8500, support: 8000, rsi: 52, ma5: 8200, ma20: 8100, macd: 30.0, techRating: 'Neutral', date: 'N/A' },
    { id: 'STI', name: 'STI', region: 'Singapore', close: 3900, turnover: 1200, turnover5dAvg: 1150, turnoverVs5d: 4.3, turnover10dAvg: 1100, turnoverVs10d: 9.1, turnover1mAvg: 1050, turnoverVs1m: 14.3, d1: 0.3, ytd: 5.0, pe: 14.0, pb: 1.3, resistance: 4000, support: 3700, rsi: 53, ma5: 3900, ma20: 3850, macd: 10.0, techRating: 'Neutral', date: 'N/A' },
];

export default function MacroeconomicsTab({ data, timeFilter, customRange, timeFilterControl }) {
    const [subTab, setSubTab] = useState('Global');
    const [indices, setIndices] = useState(INITIAL_INDICES);
    const [loadingIndices, setLoadingIndices] = useState(false);

    // Fetch Live Indices
    useEffect(() => {
        const fetchLiveIndices = async () => {
            setLoadingIndices(true);
            try {
                const res = await fetch(`/api/daily-indices?t=${Date.now()}`, { cache: 'no-store' });
                if (res.ok) {
                    const d = await res.json();
                    if (d.indices) {
                        console.log('[FRONTEND] Received indices:', Object.keys(d.indices));
                        const live = Object.values(d.indices);
                        if (live.length > 0) {
                            const liveMap = Object.fromEntries(live.map(x => [x.id, x]));
                            setIndices(prev => {
                                // Merge: update matched rows with live data, keep others as fallback
                                const merged = prev.map(idx =>
                                    liveMap[idx.id] ? { ...idx, ...liveMap[idx.id] } : idx
                                );
                                // Append any live indices not yet in state
                                live.forEach(liveIdx => {
                                    if (!merged.find(m => m.id === liveIdx.id)) merged.push(liveIdx);
                                });
                                return merged;
                            });
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch live indices", e);
            } finally {
                setLoadingIndices(false);
            }
        };

        if (subTab === 'Global') {
            fetchLiveIndices();
        }
    }, [subTab]);

    // Money Market States
    const [dataSource, setDataSource] = useState('Quote');
    const [depositTenor, setDepositTenor] = useState('12M');
    const [selectedBanks, setSelectedBanks] = useState(['VPB', 'TCB', 'MBB', 'BID']);
    const [quoteData, setQuoteData] = useState([]);
    const [loadingQuote, setLoadingQuote] = useState(false);

    useEffect(() => {
        if (subTab === 'Money market') {
            const fetchQuotes = async () => {
                setLoadingQuote(true);
                try {
                    const res = await fetch('/api/daily-tracking?type=deposit_quote');
                    if (res.ok) {
                        const d = await res.json();
                        setQuoteData(d.deposit_quote || []);
                    }
                } catch (e) {
                    console.error("Failed to load quote data", e);
                } finally {
                    setLoadingQuote(false);
                }
            };
            fetchQuotes();
        }
    }, [subTab]);

    const toggleBank = (bank) => {
        setSelectedBanks(prev =>
            prev.includes(bank) ? prev.filter(b => b !== bank) : [...prev, bank]
        );
    };

    const getFilteredData = useCallback((arr) => {
        if (!arr || !arr.length) return [];
        let days = 3650;
        if (timeFilter === '1M') days = 30;
        else if (timeFilter === '3M') days = 90;
        else if (timeFilter === '6M') days = 180;
        else if (timeFilter === '1Y') days = 365;
        else if (timeFilter === 'YTD') {
            const now = new Date();
            days = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24));
        }
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];
        return arr.filter(d => d.date >= cutoffStr).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [timeFilter]);

    // Money Market Calculations (reusing from previous work)
    const depositChartData = useMemo(() => {
        if (!data) return [];
        let rawSource = [];
        if (dataSource === 'Quote') {
            rawSource = getFilteredData(quoteData);
            return rawSource.map(day => {
                const row = { date: day.date };
                selectedBanks.forEach(b => {
                    if (day.banks && day.banks[b] && day.banks[b][depositTenor]) {
                        row[b] = day.banks[b][depositTenor];
                    }
                });
                return row;
            });
        } else {
            const baseData = (dataSource === 'Retail' ? data.deposit : data.deposit_institution) || data.deposit || [];
            rawSource = getFilteredData(baseData).filter(d =>
                (d.tenor === depositTenor || d.tenor === depositTenor.toLowerCase()) && selectedBanks.includes(d.bank)
            );
            const grouped = {};
            rawSource.forEach(d => {
                if (!grouped[d.date]) grouped[d.date] = { date: d.date };
                grouped[d.date][d.bank] = d.rate;
            });
            return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
        }
    }, [dataSource, quoteData, data, depositTenor, selectedBanks, getFilteredData]);

    const treasuryChartData = useMemo(() => {
        if (!data || !data.treasury) return [];
        const raw = getFilteredData(data.treasury);
        const grouped = {};
        raw.forEach(d => {
            if (!grouped[d.date]) grouped[d.date] = { date: d.date };
            let key = 'State Treasury';
            if (d.instrument.toLowerCase().includes('omo')) key = 'OMO';
            if (d.instrument.toLowerCase().includes('citad')) key = 'CITAD';
            grouped[d.date][key] = d.rate;
        });
        return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [data, getFilteredData]);

    const customTooltipStyle = {
        backgroundColor: COLORS.cardBg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '8px',
        color: '#f8fafc',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
    };

    const renderSubTabs = () => (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '10px' }}>
            {['Global', 'Macro', 'Money market', 'Commodity', 'Crypto'].map(t => (
                <button
                    key={t}
                    onClick={() => setSubTab(t)}
                    style={{
                        background: subTab === t ? COLORS.teal : 'transparent',
                        color: subTab === t ? '#fff' : '#94a3b8',
                        border: `1px solid ${subTab === t ? COLORS.teal : '#1e293b'}`,
                        padding: '6px 16px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.1s'
                    }}
                >
                    {t}
                </button>
            ))}
        </div>
    );

    const [selectedCrypto, setSelectedCrypto] = useState(['BTC']);
    const [selectedCommodity, setSelectedCommodity] = useState(['GOLD']);
    const [chartType, setChartType] = useState('Absolute');
    const [showMA5, setShowMA5] = useState(false);
    const [showMA20, setShowMA20] = useState(false);
    const [showMA50, setShowMA50] = useState(false);
    const [showBB, setShowBB] = useState(false);
    const [showRSI, setShowRSI] = useState(false);

    const toggleSelection = (id, currentSelected, setSelection) => {
        if (currentSelected.includes(id)) {
            if (currentSelected.length > 1) setSelection(currentSelected.filter(item => item !== id));
        } else {
            setSelection([...currentSelected, id]);
        }
    };

    const getComparisonChartData = (selectedIds) => {
        const items = indices.filter(idx => selectedIds.includes(idx.id) && idx.history && idx.history.length > 0);
        if (items.length === 0) return [];
        let days = 3650;
        if (timeFilter === '1M') days = 30;
        else if (timeFilter === '3M') days = 90;
        else if (timeFilter === '6M') days = 180;
        else if (timeFilter === '1Y') days = 365;
        else if (timeFilter === 'YTD') {
            const now = new Date();
            days = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / (1000 * 60 * 60 * 24));
        }
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        const fullPreparedHistories = {};
        items.forEach(item => {
            const sortedHistory = [...item.history].sort((a, b) => a.date.localeCompare(b.date));
            const enrichedHistory = [];
            for (let i = 0; i < sortedHistory.length; i++) {
                const day = sortedHistory[i];
                const prev = i > 0 ? sortedHistory[i - 1] : null;
                const change = prev ? day.value - prev.value : 0;
                const dailyPct = prev ? (change / prev.value) * 100 : 0;

                let ma5 = null;
                if (i >= 4) {
                    const slice = sortedHistory.slice(i - 4, i + 1);
                    ma5 = slice.reduce((sum, h) => sum + h.value, 0) / 5;
                }

                let ma20 = null;
                let bbUpper = null;
                let bbLower = null;
                if (i >= 19) {
                    const slice = sortedHistory.slice(i - 19, i + 1);
                    ma20 = slice.reduce((sum, h) => sum + h.value, 0) / 20;

                    const variance = slice.reduce((sum, h) => sum + Math.pow(h.value - ma20, 2), 0) / 20;
                    const sd = Math.sqrt(variance);
                    bbUpper = ma20 + 2 * sd;
                    bbLower = ma20 - 2 * sd;
                }

                let ma50 = null;
                if (i >= 49) {
                    const slice = sortedHistory.slice(i - 49, i + 1);
                    ma50 = slice.reduce((sum, h) => sum + h.value, 0) / 50;
                }

                enrichedHistory.push({ ...day, dailyPct, change, ma5, ma20, ma50, bbUpper, bbLower });
            }

            let avgGain = 0;
            let avgLoss = 0;
            for (let i = 1; i < enrichedHistory.length; i++) {
                const change = enrichedHistory[i].change;
                const gain = change > 0 ? change : 0;
                const loss = change < 0 ? Math.abs(change) : 0;

                if (i <= 14) {
                    avgGain += gain;
                    avgLoss += loss;
                    if (i === 14) {
                        avgGain /= 14;
                        avgLoss /= 14;
                        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                        enrichedHistory[i].rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
                    }
                } else {
                    avgGain = ((avgGain * 13) + gain) / 14;
                    avgLoss = ((avgLoss * 13) + loss) / 14;
                    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                    enrichedHistory[i].rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
                }
            }

            fullPreparedHistories[item.id] = enrichedHistory;
        });

        const dateSet = new Set();
        const filteredHistories = {};

        items.forEach(item => {
            const filtered = fullPreparedHistories[item.id].filter(h => h.date >= cutoffStr);
            filteredHistories[item.id] = filtered;
            filtered.forEach(h => dateSet.add(h.date));
        });

        const sortedDates = Array.from(dateSet).sort();
        const isComparison = selectedIds.length > 1;

        const basePrices = {};
        items.forEach(item => {
            if (filteredHistories[item.id].length > 0) basePrices[item.id] = filteredHistories[item.id][0].value;
        });

        return sortedDates.map(date => {
            const row = { date };
            items.forEach(item => {
                const dayData = filteredHistories[item.id].find(h => h.date === date);
                if (dayData && basePrices[item.id]) {
                    if (showRSI && dayData.rsi) row[`${item.id}_RSI`] = dayData.rsi;

                    if (chartType === 'Daily Pct') {
                        row[item.id] = dayData.dailyPct;
                    } else if (chartType === 'Relative' || isComparison) {
                        row[item.id] = ((dayData.value - basePrices[item.id]) / basePrices[item.id]) * 100;
                        if (showMA5 && dayData.ma5) row[`${item.id}_MA5`] = ((dayData.ma5 - basePrices[item.id]) / basePrices[item.id]) * 100;
                        if (showMA20 && dayData.ma20) row[`${item.id}_MA20`] = ((dayData.ma20 - basePrices[item.id]) / basePrices[item.id]) * 100;
                        if (showMA50 && dayData.ma50) row[`${item.id}_MA50`] = ((dayData.ma50 - basePrices[item.id]) / basePrices[item.id]) * 100;
                        if (showBB && dayData.bbUpper) {
                            row[`${item.id}_BBUpper`] = ((dayData.bbUpper - basePrices[item.id]) / basePrices[item.id]) * 100;
                            row[`${item.id}_BBLower`] = ((dayData.bbLower - basePrices[item.id]) / basePrices[item.id]) * 100;
                        }
                    } else {
                        row[item.id] = dayData.value;
                        if (showMA5 && dayData.ma5) row[`${item.id}_MA5`] = dayData.ma5;
                        if (showMA20 && dayData.ma20) row[`${item.id}_MA20`] = dayData.ma20;
                        if (showMA50 && dayData.ma50) row[`${item.id}_MA50`] = dayData.ma50;
                        if (showBB && dayData.bbUpper) {
                            row[`${item.id}_BBUpper`] = dayData.bbUpper;
                            row[`${item.id}_BBLower`] = dayData.bbLower;
                        }
                    }
                }
            });
            return row;
        });
    };

    const cryptoChartData = useMemo(() => getComparisonChartData(selectedCrypto), [indices, selectedCrypto, timeFilter, chartType, showMA5, showMA20, showMA50, showBB, showRSI]);
    const commodityChartData = useMemo(() => getComparisonChartData(selectedCommodity), [indices, selectedCommodity, timeFilter, chartType, showMA5, showMA20, showMA50, showBB, showRSI]);

    const ASSET_COLORS = {
        'BTC': '#F7931A', 'ETH': '#627EEA', 'BNB': '#F3BA2F', 'SOL': '#00FFA3', 'XRP': '#23292F',
        'GOLD': '#FFD700', 'WTI': '#8B4513', 'COPPER': '#B87333', 'NATGAS': '#4169E1', 'SILVER': '#C0C0C0', 'WHEAT': '#F5DEB3'
    };

    const renderComparisonSection = (regionFilter, selectedIds, setSelectedIds, chartData) => {
        const availableItems = indices.filter(idx => idx.region === regionFilter);
        const isComparison = selectedIds.length > 1;

        if (availableItems.length === 0) {
            return <div style={{ color: COLORS.gray, fontSize: '13px', padding: '1rem', textAlign: 'center' }}>Loading {regionFilter} data...</div>;
        }

        return (
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 500px', minWidth: '0', maxWidth: '100%' }}>
                    <div className="card" style={{ padding: '0', overflow: 'hidden', border: `1px solid ${COLORS.border}`, borderRadius: '12px', background: COLORS.cardBg }}>
                        <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`, background: 'rgba(30, 41, 59, 0.4)' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>{regionFilter} Performance</h3>
                        </div>
                        <GlobalIndicatorsTable indices={availableItems} hideValuation={regionFilter === 'Crypto' || regionFilter === 'Commodity'} />
                    </div>
                </div>

                <div style={{ flex: '1 1 500px', minWidth: '0', maxWidth: '100%', height: showRSI ? '750px' : '600px' }}>
                    <div className="card" style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column', background: COLORS.cardBg, border: `1px solid ${COLORS.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '10px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {availableItems.map(item => {
                                    const isSelected = selectedIds.includes(item.id);
                                    const color = ASSET_COLORS[item.id] || COLORS.teal;
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => toggleSelection(item.id, selectedIds, setSelectedIds)}
                                            style={{
                                                border: `1px solid ${isSelected ? color : COLORS.border}`,
                                                background: isSelected ? `${color}20` : 'transparent',
                                                color: isSelected ? color : '#94a3b8',
                                                padding: '6px 14px',
                                                borderRadius: '20px',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {item.name}
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '20px', padding: '2px' }}>
                                    {['Absolute', 'Relative', 'Daily Pct'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setChartType(type)}
                                            style={{
                                                background: chartType === type ? COLORS.teal : 'transparent',
                                                color: chartType === type ? '#fff' : '#94a3b8',
                                                border: 'none',
                                                padding: '4px 12px',
                                                borderRadius: '18px',
                                                fontSize: '11px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                opacity: isComparison && type === 'Absolute' ? 0.3 : 1,
                                                transition: 'all 0.2s'
                                            }}
                                            disabled={isComparison && type === 'Absolute'}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                                {chartType !== 'Daily Pct' && (
                                    <>
                                        <button
                                            onClick={() => setShowMA5(!showMA5)}
                                            style={{ border: `1px solid ${showMA5 ? '#f59e0b' : COLORS.border}`, background: showMA5 ? 'rgba(245, 158, 11, 0.2)' : 'transparent', color: showMA5 ? '#f59e0b' : '#64748b', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                                        >
                                            MA5
                                        </button>
                                        <button
                                            onClick={() => setShowMA20(!showMA20)}
                                            style={{ border: `1px solid ${showMA20 ? '#10b981' : COLORS.border}`, background: showMA20 ? 'rgba(16, 185, 129, 0.2)' : 'transparent', color: showMA20 ? '#10b981' : '#64748b', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                                        >
                                            MA20
                                        </button>
                                        <button
                                            onClick={() => setShowMA50(!showMA50)}
                                            style={{ border: `1px solid ${showMA50 ? '#8b5cf6' : COLORS.border}`, background: showMA50 ? 'rgba(139, 92, 246, 0.2)' : 'transparent', color: showMA50 ? '#8b5cf6' : '#64748b', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                                        >
                                            MA50
                                        </button>
                                        <button
                                            onClick={() => setShowBB(!showBB)}
                                            style={{ border: `1px solid ${showBB ? '#0ea5e9' : COLORS.border}`, background: showBB ? 'rgba(14, 165, 233, 0.2)' : 'transparent', color: showBB ? '#0ea5e9' : '#64748b', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                                        >
                                            BB
                                        </button>
                                        <button
                                            onClick={() => setShowRSI(!showRSI)}
                                            style={{ border: `1px solid ${showRSI ? '#db2777' : COLORS.border}`, background: showRSI ? 'rgba(219, 39, 119, 0.2)' : 'transparent', color: showRSI ? '#db2777' : '#64748b', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                                        >
                                            RSI
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: (isComparison || chartType === 'Relative' || chartType === 'Daily Pct') ? -20 : 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                    <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={dtFormatter} minTickGap={30} />
                                    <YAxis
                                        stroke="#64748b"
                                        fontSize={10}
                                        tickFormatter={(v) => (chartType === 'Relative' || chartType === 'Daily Pct' || isComparison) ? `${v.toFixed(1)}%` : (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString())}
                                        domain={['auto', 'auto']}
                                    />
                                    <Tooltip
                                        contentStyle={customTooltipStyle}
                                        itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}
                                        labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}
                                        formatter={(value, name) => {
                                            const isPct = chartType === 'Relative' || chartType === 'Daily Pct' || isComparison;
                                            const formattedVal = isPct ? `${value.toFixed(2)}%` : value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

                                            let itemName = name;
                                            if (name.endsWith('_MA5')) {
                                                const baseId = name.replace('_MA5', '');
                                                const baseName = availableItems.find(a => a.id === baseId)?.name || baseId;
                                                itemName = `${baseName} (MA5)`;
                                            } else if (name.endsWith('_MA20')) {
                                                const baseId = name.replace('_MA20', '');
                                                const baseName = availableItems.find(a => a.id === baseId)?.name || baseId;
                                                itemName = `${baseName} (MA20)`;
                                            } else if (name.endsWith('_MA50')) {
                                                const baseId = name.replace('_MA50', '');
                                                const baseName = availableItems.find(a => a.id === baseId)?.name || baseId;
                                                itemName = `${baseName} (MA50)`;
                                            } else if (name.endsWith('_BBUpper') || name.endsWith('_BBLower')) {
                                                const baseId = name.replace('_BBUpper', '').replace('_BBLower', '');
                                                const baseName = availableItems.find(a => a.id === baseId)?.name || baseId;
                                                itemName = `${baseName} (BB)`;
                                            } else {
                                                itemName = availableItems.find(a => a.id === name)?.name || name;
                                            }
                                            return [formattedVal, itemName];
                                        }}
                                        labelFormatter={dtFormatter}
                                        separator=" : "
                                    />
                                    {selectedIds.map(id => (
                                        <React.Fragment key={id}>
                                            <Line type="monotone" dataKey={id} stroke={ASSET_COLORS[id] || COLORS.teal} strokeWidth={2} dot={false} isAnimationActive={false} />
                                            {showMA5 && chartType !== 'Daily Pct' && <Line type="monotone" dataKey={`${id}_MA5`} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} dot={false} isAnimationActive={false} activeDot={false} />}
                                            {showMA20 && chartType !== 'Daily Pct' && <Line type="monotone" dataKey={`${id}_MA20`} stroke="#10b981" strokeDasharray="5 5" strokeWidth={1.5} dot={false} isAnimationActive={false} activeDot={false} />}
                                            {showMA50 && chartType !== 'Daily Pct' && <Line type="monotone" dataKey={`${id}_MA50`} stroke="#8b5cf6" strokeDasharray="5 5" strokeWidth={1.5} dot={false} isAnimationActive={false} activeDot={false} />}
                                            {showBB && chartType !== 'Daily Pct' && (
                                                <>
                                                    <Line type="monotone" dataKey={`${id}_BBUpper`} stroke="rgba(14, 165, 233, 0.6)" strokeWidth={1} dot={false} isAnimationActive={false} activeDot={false} />
                                                    <Line type="monotone" dataKey={`${id}_BBLower`} stroke="rgba(14, 165, 233, 0.6)" strokeWidth={1} dot={false} isAnimationActive={false} activeDot={false} />
                                                </>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {showRSI && (
                            <div style={{ height: '150px', width: '100%', marginTop: '1rem' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: (isComparison || chartType === 'Relative' || chartType === 'Daily Pct') ? -20 : 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                        <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickFormatter={dtFormatter} minTickGap={30} hide />
                                        <YAxis stroke="#64748b" fontSize={10} domain={[0, 100]} ticks={[30, 50, 70]} />
                                        <Tooltip
                                            contentStyle={customTooltipStyle}
                                            itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}
                                            labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}
                                            labelFormatter={dtFormatter}
                                            separator=" : "
                                            formatter={(value, name) => {
                                                const baseId = name.replace('_RSI', '');
                                                const baseName = availableItems.find(a => a.id === baseId)?.name || baseId;
                                                return [value.toFixed(1), `${baseName} (RSI)`];
                                            }}
                                        />
                                        <ReferenceLine y={70} stroke="rgba(239, 68, 68, 0.5)" strokeDasharray="3 3" />
                                        <ReferenceLine y={30} stroke="rgba(16, 185, 129, 0.5)" strokeDasharray="3 3" />
                                        {selectedIds.map(id => (
                                            <Line key={`${id}_RSI`} type="monotone" dataKey={`${id}_RSI`} stroke={ASSET_COLORS[id] || COLORS.teal} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {renderSubTabs()}

            {(subTab === 'Macro' || subTab === 'Money market' || subTab === 'Commodity' || subTab === 'Crypto') && timeFilterControl}

            {subTab === 'Global' && (
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'start', flexWrap: 'wrap' }}>
                    {/* Main Indicators Table */}
                    <div style={{ flex: '1 1 500px', minWidth: '0', maxWidth: '100%' }}>
                        <div className="card" style={{ padding: '0', overflow: 'hidden', border: `1px solid ${COLORS.border}`, borderRadius: '12px', background: COLORS.cardBg }}>
                            <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 41, 59, 0.4)' }}>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>Global Indices</h3>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b' }}>Live Technical & Fundamental Benchmarks</p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '20px' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: COLORS.green, boxShadow: `0 0 8px ${COLORS.green}`, opacity: loadingIndices ? 0.4 : 1 }}></span>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: COLORS.green, letterSpacing: '0.05em' }}>{loadingIndices ? 'SYNCING...' : 'LIVE'}</span>
                                </div>
                            </div>
                            <GlobalIndicatorsTable indices={indices.filter(i => i.region !== 'Crypto' && i.region !== 'Commodity')} />
                        </div>
                    </div>

                    {/* Economic Calendar Sidebar */}
                    <div style={{ flex: '1 1 350px', minWidth: '0', maxWidth: '100%', height: '600px' }}>
                        <div className="card" style={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column', border: `1px solid ${COLORS.border}`, borderRadius: '12px', background: COLORS.cardBg }}>
                            <div style={{ padding: '1rem', borderBottom: `1px solid ${COLORS.border}`, background: 'rgba(30, 41, 59, 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>Economic Calendar</h3>
                                <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: '#64748b' }}>
                                    <span title="Actual"><strong>A:</strong> Actual</span>
                                    <span title="Forecast"><strong>F:</strong> Forecast</span>
                                    <span title="Previous"><strong>P:</strong> Previous</span>
                                </div>
                            </div>
                            <TradingViewCalendarWidget />
                        </div>
                    </div>
                </div>
            )}

            {subTab === 'Macro' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                    {[
                        { label: 'US 10Y Treasury Yield', symbol: 'TVC:US10Y' },
                        { label: 'DXY - US Dollar Index', symbol: 'CAPITALCOM:DXY' },
                        { label: 'Vietnam 10Y Bond Yield', symbol: 'TVC:VN10Y' },
                        { label: 'USD/VND', symbol: 'FX_IDC:USDVND' }
                    ].map(card => (
                        <div key={card.label} className="card" style={{ padding: '0', height: '350px', border: `1px solid ${COLORS.border}`, borderRadius: '12px' }}>
                            <div style={{ padding: '0.875rem 1rem', borderBottom: `1px solid ${COLORS.border}`, background: 'rgba(30, 41, 59, 0.4)' }}>
                                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{card.label}</h3>
                            </div>
                            <TradingViewMiniChartWidget symbol={card.symbol} timeFilter={timeFilter} />
                        </div>
                    ))}
                </div>
            )}

            {subTab === 'Money market' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <MoneyMarketTab timeFilter={timeFilter} customRange={customRange} />
                </div>
            )}

            {subTab === 'Commodity' && renderComparisonSection('Commodity', selectedCommodity, setSelectedCommodity, commodityChartData)}

            {subTab === 'Crypto' && renderComparisonSection('Crypto', selectedCrypto, setSelectedCrypto, cryptoChartData)}
        </div>
    );
}

// PREMIUM INDICATORS TABLE
function GlobalIndicatorsTable({ indices, hideValuation = false }) {
    const formatVal = (val) => {
        if (val == null || isNaN(val)) return '–';
        if (Math.abs(val) < 100) return val.toFixed(1);
        return Math.round(val).toLocaleString();
    };

    const getValueWithIcon = (val, isPercent = false) => {
        const isPositive = val > 0;
        const isZero = val === 0;
        const trend = isPositive ? 'up' : (isZero ? 'neutral' : 'down');
        const color = isPositive ? COLORS.green : (isZero ? COLORS.gray : COLORS.red);

        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '12px', color }}>
                    {isPositive && '+'}{val.toFixed(1)}{isPercent && '%'}
                </span>
                <TrendIcon trend={trend} />
            </div>
        );
    };

    const getTechRatingColor = (rating) => {
        if (!rating) return '#94a3b8';
        switch (rating) {
            case 'Strong Bullish': return COLORS.green;
            case 'Bullish': return '#4ade80';
            case 'Strong Bearish': return COLORS.red;
            case 'Bearish': return '#f87171';
            default: return '#94a3b8';
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '600px', background: COLORS.cardBg, maxWidth: '100%', position: 'relative' }}>
                <table style={{ width: '100%', minWidth: 'max-content', borderCollapse: 'separate', borderSpacing: 0, fontSize: '11px', color: '#94a3b8' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 12 }}>
                        <tr style={{ background: '#1e293b', textAlign: 'left' }}>
                            <th style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', borderBottom: `1px solid ${COLORS.border}`, position: 'sticky', left: 0, zIndex: 11, background: '#1e293b', width: '130px', minWidth: '130px' }}>Index</th>
                            <th style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', borderBottom: `1px solid ${COLORS.border}`, position: 'sticky', left: '130px', zIndex: 11, background: '#1e293b', width: '90px', minWidth: '90px' }}>Region</th>
                            <th style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}`, position: 'sticky', left: '220px', zIndex: 11, background: '#1e293b', width: '100px', minWidth: '100px' }}>Date</th>
                            <th style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'right', borderBottom: `1px solid ${COLORS.border}`, position: 'sticky', left: '320px', zIndex: 11, background: '#1e293b', width: '100px', minWidth: '100px' }}>Price</th>
                            <th colSpan="4" style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>Turnover</th>
                            <th colSpan="6" style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>Performance</th>
                            {!hideValuation && <th colSpan="2" style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>Valuation</th>}
                            <th colSpan="7" style={{ padding: '10px 16px', fontWeight: 600, color: '#cbd5e1', textAlign: 'center', borderLeft: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>Technical Benchmarks</th>
                        </tr>
                        <tr style={{ background: '#1e293b', textAlign: 'center', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            <th style={{ borderBottom: `1px solid ${COLORS.border}`, position: 'sticky', left: 0, zIndex: 11, background: '#1e293b' }}></th>
                            <th style={{ borderBottom: `1px solid ${COLORS.border}`, position: 'sticky', left: '130px', zIndex: 11, background: '#1e293b' }}></th>
                            <th style={{ borderBottom: `1px solid ${COLORS.border}`, position: 'sticky', left: '220px', zIndex: 11, background: '#1e293b' }}></th>
                            <th style={{ borderBottom: `1px solid ${COLORS.border}`, position: 'sticky', left: '320px', zIndex: 11, background: '#1e293b' }}></th>
                            <th style={{ padding: '6px', borderLeft: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>Value</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>5D Avg</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>10D Avg</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>1M Avg</th>
                            <th style={{ padding: '6px', borderLeft: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>1D</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>1M</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>3M</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>6M</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>12M</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>YTD</th>
                            {!hideValuation && (
                                <>
                                    <th style={{ padding: '6px', borderLeft: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>P/E</th>
                                    <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>P/B</th>
                                </>
                            )}
                            <th style={{ padding: '6px', borderLeft: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}` }}>Resistance</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>Support</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>RSI</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>MA(5)</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>MA(20)</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>MACD</th>
                            <th style={{ padding: '6px', borderBottom: `1px solid ${COLORS.border}` }}>Signal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {indices.map((row, i) => (
                            <tr key={i} className="table-row" style={{ borderBottom: `1px solid ${COLORS.border}`, transition: 'background 0.2s', '--row-bg': '#0f172a' }}>
                                <td style={{ padding: '8px 16px', fontWeight: 700, color: '#f1f5f9', fontSize: '13px', position: 'sticky', left: 0, zIndex: 5, background: 'var(--row-bg, #0f172a)' }}>{row.name}</td>
                                <td style={{ padding: '8px 16px', color: '#64748b', fontWeight: 500, position: 'sticky', left: '130px', zIndex: 5, background: 'var(--row-bg, #0f172a)' }}>{row.region}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'right', color: '#94a3b8', fontSize: '11px', position: 'sticky', left: '220px', zIndex: 5, background: 'var(--row-bg, #0f172a)' }}>{row.date === 'N/A' ? '–' : row.date}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: '#f8fafc', fontSize: '12px', position: 'sticky', left: '320px', zIndex: 5, background: 'var(--row-bg, #0f172a)' }}>
                                    {row.date === 'N/A' ? '–' : formatVal(row.close)}
                                </td>
                                <td style={{ padding: '8px 16px', textAlign: 'right', borderLeft: `1px solid ${COLORS.border}` }}>
                                    {row.turnover != null && row.date !== 'N/A' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                            <span style={{ fontWeight: 700, color: '#f8fafc' }}>
                                                {row.region === 'Vietnam' ? `${formatVal(row.turnoverVnd)}B` : `$${formatVal(row.turnover)}B`}
                                            </span>
                                            {row.region === 'Vietnam' && (
                                                <span style={{ fontSize: '9px', color: '#64748b' }}>${formatVal(row.turnover)}B</span>
                                            )}
                                        </div>
                                    ) : '–'}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                    {row.turnover5dAvg != null && row.date !== 'N/A' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                            <div style={{ fontWeight: 600, color: '#cbd5e1' }}>
                                                {row.region === 'Vietnam' ? `${formatVal(row.turnover5dAvgVnd)}B` : `$${formatVal(row.turnover5dAvg)}B`}
                                            </div>
                                            <div style={{ fontSize: '9px', fontWeight: 700, color: (row.turnoverVs5d || 0) >= 0 ? COLORS.green : COLORS.red }}>
                                                {row.turnoverVs5d != null ? `${row.turnoverVs5d >= 0 ? '+' : ''}${row.turnoverVs5d.toFixed(1)}%` : '–'}
                                            </div>
                                        </div>
                                    ) : '–'}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                    {row.turnover10dAvg != null && row.date !== 'N/A' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                            <div style={{ fontWeight: 600, color: '#cbd5e1' }}>
                                                {row.region === 'Vietnam' ? `${formatVal(row.turnover10dAvgVnd)}B` : `$${formatVal(row.turnover10dAvg)}B`}
                                            </div>
                                            <div style={{ fontSize: '9px', fontWeight: 700, color: (row.turnoverVs10d || 0) >= 0 ? COLORS.green : COLORS.red }}>
                                                {row.turnoverVs10d != null ? `${row.turnoverVs10d >= 0 ? '+' : ''}${row.turnoverVs10d.toFixed(1)}%` : '–'}
                                            </div>
                                        </div>
                                    ) : '–'}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                                    {row.turnover1mAvg != null && row.date !== 'N/A' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                            <div style={{ fontWeight: 600, color: '#cbd5e1' }}>
                                                {row.region === 'Vietnam' ? `${formatVal(row.turnover1mAvgVnd)}B` : `$${formatVal(row.turnover1mAvg)}B`}
                                            </div>
                                            <div style={{ fontSize: '9px', fontWeight: 700, color: (row.turnoverVs1m || 0) >= 0 ? COLORS.green : COLORS.red }}>
                                                {row.turnoverVs1m != null ? `${row.turnoverVs1m >= 0 ? '+' : ''}${row.turnoverVs1m.toFixed(1)}%` : '–'}
                                            </div>
                                        </div>
                                    ) : '–'}
                                </td>

                                <td style={{ padding: '8px 16px', textAlign: 'right', borderLeft: `1px solid ${COLORS.border}` }}>
                                    {row.date !== 'N/A' ? getValueWithIcon(row.d1, true) : '–'}
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.d1m != null && row.date !== 'N/A' ? getValueWithIcon(row.d1m, true) : '–'}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.d3m != null && row.date !== 'N/A' ? getValueWithIcon(row.d3m, true) : '–'}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.d6m != null && row.date !== 'N/A' ? getValueWithIcon(row.d6m, true) : '–'}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.d12m != null && row.date !== 'N/A' ? getValueWithIcon(row.d12m, true) : '–'}</td>
                                <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.ytd != null && row.date !== 'N/A' ? getValueWithIcon(row.ytd, true) : '–'}</td>

                                {!hideValuation && (
                                    <>
                                        <td style={{ padding: '8px 16px', textAlign: 'right', borderLeft: `1px solid ${COLORS.border}`, color: '#cbd5e1', fontWeight: 600 }}>{row.pe != null && row.date !== 'N/A' ? `${formatVal(row.pe)}x` : '–'}</td>
                                        <td style={{ padding: '8px 16px', textAlign: 'right', color: '#cbd5e1', fontWeight: 600 }}>{row.pb != null && row.date !== 'N/A' ? `${formatVal(row.pb)}x` : '–'}</td>
                                    </>
                                )}

                                <td style={{ padding: '8px 16px', textAlign: 'right', borderLeft: `1px solid ${COLORS.border}`, color: '#f1f5f9' }}>{row.resistance != null && row.date !== 'N/A' ? formatVal(row.resistance) : '–'}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'right', color: '#f1f5f9' }}>{row.support != null && row.date !== 'N/A' ? formatVal(row.support) : '–'}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: row.rsi > 70 ? COLORS.red : (row.rsi < 30 ? COLORS.green : '#cbd5e1') }}>{row.rsi != null && row.date !== 'N/A' ? formatVal(row.rsi) : '–'}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 600, color: row.trend === 'up' ? COLORS.green : (row.trend === 'down' ? COLORS.red : '#94a3b8') }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                        {row.ma5 != null && row.date !== 'N/A' ? formatVal(row.ma5) : '–'}
                                        {row.trend === 'up' && <span style={{ fontSize: '10px' }}>▲</span>}
                                        {row.trend === 'down' && <span style={{ fontSize: '10px' }}>▼</span>}
                                    </div>
                                </td>
                                <td style={{ padding: '8px 16px', textAlign: 'right', color: '#94a3b8' }}>{row.ma20 != null && row.date !== 'N/A' ? formatVal(row.ma20) : '–'}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'right', color: row.macd != null ? (String(row.macd).startsWith('-') ? COLORS.red : COLORS.green) : '#94a3b8', fontWeight: 600 }}>{row.macd != null && row.date !== 'N/A' ? formatVal(row.macd) : '–'}</td>
                                <td style={{ padding: '8px 16px', textAlign: 'right', fontWeight: 700, color: getTechRatingColor(row.techRating) }}>{row.techRating != null && row.date !== 'N/A' ? row.techRating : '–'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ padding: '16px', fontSize: '11px', color: '#94a3b8', borderTop: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(30, 41, 59, 0.2)' }}>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <strong>MA(5) Trend:</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: COLORS.green }}>▲ Green:</span> Uptrend & above MA(20) (or near +/- 0.5%)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: COLORS.red }}>▼ Red:</span> Downtrend & below MA(20) (or near +/- 0.5%)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: '#94a3b8' }}>Grey:</span> Neutral (no clear trend crossover)
                    </div>
                </div>

                <div style={{ borderTop: `1px dashed rgba(255,255,255,0.1)`, paddingTop: '12px' }}>
                    <strong style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1' }}>Technical Rating (Signal):</strong>
                    <div style={{ lineHeight: '1.5' }}>
                        The <strong>Signal</strong> grades each market from <em>Strong Bearish</em> to <em>Strong Bullish</em> based on a combined score of 4 technical pillars:
                        <br />
                        <span style={{ color: COLORS.green }}>+1 Point</span> each for: MA(5) uptrend, MACD &gt; 0, RSI in healthy uptrend (50-70), and positive price action confirmed by rising Volume (Turnover &gt; 5D Avg).
                        <br />
                        <span style={{ color: COLORS.red }}>-1 Point</span> each for: MA(5) downtrend, MACD &lt; 0, RSI in healthy downtrend (30-50), and negative price action confirmed by rising Volume.
                    </div>
                </div>
            </div>

            <style jsx>{`
                .table-row:hover, .table-row:hover td {
                    background-color: rgba(30, 41, 59, 1) !important;
                    --row-bg: rgba(30, 41, 59, 1);
                }
                td, th { white-space: nowrap; }
            `}</style>
        </div>
    );
}

// TradingView Widgets
function TradingViewCalendarWidget() {
    const containerRef = useRef(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Cleanup existing content
        container.innerHTML = '';

        const script = document.createElement('script');
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "width": "100%", "height": "100%", "colorTheme": "dark", "isTransparent": true, "locale": "en",
            "importanceFilter": "-1,0,1", "currencyFilter": "USD,VND,EUR,JPY,GBP,CNY"
        });
        container.appendChild(script);

        return () => {
            if (container) container.innerHTML = '';
        };
    }, []);
    return <div ref={containerRef} style={{ height: '100%', width: '100%', overflow: 'hidden' }} />;
}

function TradingViewMiniChartWidget({ symbol, timeFilter }) {
    const containerRef = useRef(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.innerHTML = '';

        let dateRange = "12M";
        if (timeFilter === '1M') dateRange = "1M";
        else if (timeFilter === '3M') dateRange = "3M";
        else if (timeFilter === '6M') dateRange = "6M";
        else if (timeFilter === 'YTD') dateRange = "YTD";
        else if (timeFilter === '1Y') dateRange = "12M";
        else if (timeFilter === 'ALL') dateRange = "ALL";

        const script = document.createElement('script');
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "symbol": symbol, "width": "100%", "height": "100%", "locale": "en", "dateRange": dateRange,
            "colorTheme": "dark", "isTransparent": true, "autosize": true, "largeChartUrl": ""
        });
        container.appendChild(script);

        return () => {
            if (container) container.innerHTML = '';
        };
    }, [symbol, timeFilter]);
    return <div ref={containerRef} style={{ height: '100%', width: '100%', overflow: 'hidden' }} />;
}
