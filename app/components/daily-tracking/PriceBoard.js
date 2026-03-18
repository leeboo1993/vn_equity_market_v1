'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import UnifiedTickerChartModal from './UnifiedTickerChartModal';

// Specialized Hook to compare previous and current values to trigger CSS flashes
// Fixed to avoid accessing ref during render
function usePrevious(value) {
    const [prev, setPrev] = useState(value);
    const currentRef = useRef(value);

    useEffect(() => {
        if (currentRef.current !== value) {
            setPrev(currentRef.current);
            currentRef.current = value;
        }
    }, [value]);

    return prev;
}

// Reusable Cell component that automatically flashes green/red when its value changes
const LiveCell = ({ value, formatter, style, comparePrice, currentPrice }) => {
    const prevValue = usePrevious(value);
    const [flashClass, setFlashClass] = useState('');

    useEffect(() => {
        if (prevValue !== undefined && value !== prevValue && value !== 0 && prevValue !== 0) {
            // Determine flash color. If comparePrice is passed, use it relative to previous, otherwise just absolute change
            const isUp = currentPrice ? currentPrice > comparePrice : value > prevValue;

            // Use setTimeout to avoid synchronous setState warning inside useEffect mount
            const flashTimer = setTimeout(() => {
                setFlashClass(isUp ? 'flash-green' : 'flash-red');
            }, 0);

            // Remove flash class after animation completes (750ms)
            const clearTimer = setTimeout(() => setFlashClass(''), 750);

            return () => {
                clearTimeout(flashTimer);
                clearTimeout(clearTimer);
            };
        }
    }, [value, prevValue, currentPrice, comparePrice]);

    return (
        <span className={flashClass} style={style}>
            {value ? (formatter ? formatter(value) : value) : '-'}
        </span>
    );
};

// Sector Mappings (Approximated for VN30)
const SECTORS = {
    'VN30': ['ACB', 'BCM', 'BID', 'BVH', 'CTG', 'FPT', 'GAS', 'GVR', 'HDB', 'HPG', 'MBB', 'MSN', 'MWG', 'PLX', 'POW', 'SAB', 'SHB', 'SSB', 'SSI', 'STB', 'TCB', 'TPB', 'VCB', 'VHM', 'VIB', 'VIC', 'VJC', 'VNM', 'VPB', 'VRE'],
    'Banking': ['ACB', 'BID', 'CTG', 'HDB', 'MBB', 'SHB', 'SSB', 'STB', 'TCB', 'TPB', 'VCB', 'VIB', 'VPB'],
    'Broker': ['SSI'],
    'Real Estate': ['BCM', 'VHM', 'VIC', 'VRE'],
    'Retail': ['MWG', 'MSN'], // MSN sometimes grouped here
    'O&G': ['GAS', 'PLX'],
    'Metals': ['HPG'],
    'VIC': ['VIC'],
    'GEX': ['GEX'] // Note: GEX is not currently in VN30, but adding for exact parity
};

export default function PriceBoard() {
    const [prices, setPrices] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('VN30');

    // Watchlist State
    const [watchlist, setWatchlist] = useState([]);
    const [watchInput, setWatchInput] = useState('');
    const [watchlistWeights, setWatchlistWeights] = useState({});
    const [margin, setMargin] = useState(1.0); // 1.0 = 100% (No margin)

    // Custom Sectors State
    const [customSectors, setCustomSectors] = useState({});
    const [sectorInput, setSectorInput] = useState('');
    const [newSectorInput, setNewSectorInput] = useState(''); // For Admins creating brand new tabs

    // Session & User Role
    const [session, setSession] = useState(null);
    const [chartTicker, setChartTicker] = useState(null); // Chart modal state

    // Load Session
    useEffect(() => {
        fetch('/api/auth/session')
            .then(res => res.json())
            .then(data => {
                if (data && Object.keys(data).length > 0) {
                    setSession(data);
                }
            })
            .catch(err => console.error('Error loading session', err));
    }, []);

    const isAdmin = session?.user?.role === 'admin';

    // Load watchlist and weights from API on mount
    useEffect(() => {
        // Load Watchlist
        fetch('/api/watchlist')
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) {
                    if (data.watchlist) setWatchlist(data.watchlist);
                    if (data.weights) setWatchlistWeights(data.weights);
                    if (data.margin !== undefined) setMargin(parseFloat(data.margin));
                }
            })
            .catch(err => console.error('Error loading watchlist from API', err));

        // Load Global Sectors
        fetch('/api/sectors')
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) {
                    setCustomSectors(data);
                }
            })
            .catch(err => console.error('Error loading sectors from API', err));
    }, []);

    const saveWatchlistToAPI = async (newWatchlist, newWeights, newMargin) => {
        try {
            await fetch('/api/watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    watchlist: newWatchlist,
                    weights: newWeights,
                    margin: newMargin
                })
            });
        } catch (err) {
            console.error('Error saving watchlist to API', err);
        }
    };

    const saveSectorsToAPI = async (newSectors) => {
        try {
            await fetch('/api/sectors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSectors)
            });
        } catch (err) {
            console.error('Error saving sectors to API', err);
        }
    };

    const handleUpdateMargin = (m) => {
        const val = parseFloat(m) || 1.0;
        setMargin(val);
        saveWatchlistToAPI(watchlist, watchlistWeights, val);
    };

    // Active Tickers based on selected tab
    const getActiveTickers = useCallback(() => {
        if (activeTab === 'Watchlist') return watchlist;

        const baseTickers = SECTORS[activeTab] || [];
        const additionalTickers = customSectors[activeTab] || [];

        // Combine base and additional, preserving order
        const combined = [...baseTickers, ...additionalTickers];

        // Remove tickers that have been explicitly deleted by admin
        // We'll store deleted tickers as negative entries in `customSectors`, e.g., "-VNM"
        const deletedTickers = additionalTickers.filter(t => t.startsWith('-')).map(t => t.substring(1));
        const activeAdditions = additionalTickers.filter(t => !t.startsWith('-'));

        const finalTickers = [...baseTickers, ...activeAdditions].filter(t => !deletedTickers.includes(t));

        // Deduplicate
        return Array.from(new Set(finalTickers));
    }, [activeTab, watchlist, customSectors]);

    const activeTickers = getActiveTickers();

    const fetchLivePrices = useCallback(async () => {
        // Only fetch if window is visible
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
            return;
        }

        try {
            // OPTIMIZATION: Only fetch indices + current tab tickers + watchlist
            // Instead of Object.values(customSectors).flat() (which fetches everything)
            const activeTabTickers = getActiveTickers();
            const allTickers = Array.from(new Set(['VNINDEX', 'VN30', 'VN30F1M', 'VN30F2M', ...activeTabTickers, ...watchlist]));

            if (allTickers.length === 0) {
                setLoading(false);
                return;
            }

            const res = await fetch('/api/live-prices?tickers=' + allTickers.join(','));
            if (!res.ok) throw new Error('Failed to fetch prices');
            const data = await res.json();

            setPrices(prev => ({ ...prev, ...data.prices }));
            setError(null);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [getActiveTickers, watchlist]);

    // Polling interval
    useEffect(() => {
        fetchLivePrices(); // Initial fetch

        // Polling logic with visibility check listener
        const interval = setInterval(fetchLivePrices, 10000); // Increased to 10s to save usage

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchLivePrices();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [activeTab, watchlist, fetchLivePrices]); // Also re-bind on tab change to get fresh data immediately

    // Watchlist Controls
    const handleAddWatchlist = (e) => {
        if (e) e.preventDefault();
        if (!watchInput.trim()) return;

        const symbol = watchInput.trim().toUpperCase();
        if (!watchlist.includes(symbol)) {
            const newList = [...watchlist, symbol];
            setWatchlist(newList);
            saveWatchlistToAPI(newList, watchlistWeights, margin);
        }
        setWatchInput('');
    };

    // Sector Customization Controls
    const handleAddCustomSectorTicker = (e) => {
        if (e) e.preventDefault();
        if (!sectorInput.trim() || activeTab === 'Watchlist') return;

        const symbol = sectorInput.trim().toUpperCase();
        const existingCustom = customSectors[activeTab] || [];

        // If it was previously deleted, remove the negative entry
        let newCustomList = existingCustom;
        if (newCustomList.includes(`-${symbol}`)) {
            newCustomList = newCustomList.filter(s => s !== `-${symbol}`);
        } else if (!newCustomList.includes(symbol)) {
            newCustomList = [...newCustomList, symbol];
        }

        const newCustomMap = {
            ...customSectors,
            [activeTab]: newCustomList
        };
        setCustomSectors(newCustomMap);
        saveSectorsToAPI(newCustomMap);
        setSectorInput('');
    };

    const handleCreateNewSector = (e) => {
        if (e) e.preventDefault();
        if (!newSectorInput.trim()) return;

        const newSectorName = newSectorInput.trim();
        // Don't overwrite existing base sectors or existing custom sectors
        if (SECTORS[newSectorName] || customSectors[newSectorName]) {
            alert('Sector name already exists.');
            return;
        }

        const newCustomMap = {
            ...customSectors,
            [newSectorName]: [] // Initialize empty
        };
        setCustomSectors(newCustomMap);
        saveSectorsToAPI(newCustomMap);
        setNewSectorInput('');
        setActiveTab(newSectorName); // Optionally jump to the new tab
    };

    const handleDeleteCustomSector = (e, sectorName) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation(); // Don't trigger tab click
        }
        if (confirm(`Are you sure you want to completely delete the custom sector "${sectorName}"?`)) {
            const newCustomMap = { ...customSectors };
            delete newCustomMap[sectorName];
            setCustomSectors(newCustomMap);
            saveSectorsToAPI(newCustomMap);
            if (activeTab === sectorName) {
                setActiveTab('VN30'); // fallback to default
            }
        }
    };

    const handleRemoveCustomSectorTicker = (symbol) => {
        const existingCustom = customSectors[activeTab] || [];
        const baseTickers = SECTORS[activeTab] || [];

        let newCustomList = [...existingCustom];

        if (newCustomList.includes(symbol)) {
            // It was a user-added custom ticker
            newCustomList = newCustomList.filter(s => s !== symbol);
        } else if (baseTickers.includes(symbol)) {
            // It was a base ticker, need to add a negative entry
            if (!newCustomList.includes(`-${symbol}`)) {
                newCustomList.push(`-${symbol}`);
            }
        }

        const newCustomMap = {
            ...customSectors,
            [activeTab]: newCustomList
        };
        setCustomSectors(newCustomMap);
        saveSectorsToAPI(newCustomMap);
    };

    const handleRemoveWatchlist = (symbol) => {
        const newList = watchlist.filter(s => s !== symbol);
        setWatchlist(newList);

        // Clean up associated weight
        const newWeights = { ...watchlistWeights };
        delete newWeights[symbol];
        setWatchlistWeights(newWeights);

        saveWatchlistToAPI(newList, newWeights, margin);
    };

    const handleUpdateWatchlistWeight = (symbol, weightStr) => {
        const newWeights = { ...watchlistWeights };
        if (weightStr === '' || isNaN(weightStr)) {
            delete newWeights[symbol]; // default to equal weight if cleared
        } else {
            newWeights[symbol] = parseFloat(weightStr);
        }
        setWatchlistWeights(newWeights);
        saveWatchlistToAPI(watchlist, newWeights, margin);
    };

    // Generic Market Cap weights for Index weighting (normalized/relative)
    const MARKET_CAPS = {
        // VN30 / Big Caps
        'VCB': 480, 'BID': 240, 'VHM': 190, 'GAS': 180, 'VIC': 175, 'VPB': 140, 'VNM': 135, 'FPT': 125, 'TCB': 120, 'HPG': 115,
        'CTG': 110, 'MBB': 85, 'MSN': 80, 'MWG': 75, 'STB': 65, 'ACB': 60, 'VRE': 55, 'HDB': 50, 'VIB': 45, 'TPB': 40, 'POW': 35,
        'PLX': 30, 'GVR': 45, 'SHB': 40, 'SSB': 35, 'VJC': 50, 'SAB': 45, 'BVH': 30, 'BCM': 25,
        // Others
        'GEX': 25, 'DGC': 35, 'NLG': 20, 'KDH': 22, 'PVD': 15, 'PVS': 18, 'SSI': 40, 'HCM': 15, 'VCI': 20, 'VND': 25
    };

    // Calculate Sector Performance
    const getSectorPerformance = (sectorName) => {
        let tickers = [];
        if (sectorName === 'Watchlist') {
            tickers = watchlist;
        } else {
            const baseT = SECTORS[sectorName] || [];
            const addT = customSectors[sectorName] || [];
            tickers = Array.from(new Set([...baseT, ...addT]));
        }

        if (tickers.length === 0) return null;

        let totalWeightInInput = 0;
        let weightedSum = 0;
        let validTickersFound = false;

        // Pre-calculate total weight for normalization or cash balance
        if (sectorName === 'Watchlist') {
            tickers.forEach(t => {
                if (watchlistWeights[t] !== undefined && !isNaN(watchlistWeights[t])) {
                    totalWeightInInput += watchlistWeights[t];
                } else {
                    totalWeightInInput += (100 / (tickers.length || 1)); // Default fallback if none specified
                }
            });
        }

        tickers.forEach(ticker => {
            const data = prices[ticker];
            if (data && data.price && data.ref) {
                const diffPct = (data.price - data.ref) / data.ref * 100;

                // Determine weight
                let weight = 1; // Default to equal weighting
                if (sectorName === 'Watchlist') {
                    // Check if explicit weight is set
                    const inputW = (watchlistWeights[ticker] !== undefined && !isNaN(watchlistWeights[ticker])) ? watchlistWeights[ticker] : (100 / tickers.length);
                    // If total exceeds 100, normalize it. Else use as is (treated as percentage of total portfolio)
                    weight = totalWeightInInput > 100 ? (inputW / totalWeightInInput) * 100 : inputW;
                } else {
                    // Standard Sector: Use Market Cap Weighting
                    weight = MARKET_CAPS[ticker] || 1; // Fallback to 1 if unknown
                }

                weightedSum += diffPct * weight;
                validTickersFound = true;
            }
        });

        if (!validTickersFound) return null;

        let res;
        if (sectorName === 'Watchlist') {
            // we use 100 as base for percentage-based portfolio
            // Cash at 0% return is implicit if totalWeightInInput < 100
            const portfolioReturn = (weightedSum / 100);
            res = portfolioReturn * margin;
        } else {
            // For sectors, we use strict weighted average based on constituents
            let sectorTotalW = 0;
            tickers.forEach(t => sectorTotalW += (MARKET_CAPS[t] || 1));
            res = (weightedSum / sectorTotalW);
        }

        return res.toFixed(2);
    };

    // Formatters
    const formatPrice = (v) => v ? (v / 1000).toFixed(2) : '-';
    // Format volume to strictly K/M suffix like screenshot (e.g. 134.5K, 6.5M)
    const formatVolString = (v) => {
        if (!v || v === 0) return '-';
        if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
        if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
        return v;
    };

    const formatPct = (v) => {
        if (v === undefined || v === null) return '-';
        const n = parseFloat(v);
        return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
    };

    const getColorClass = (price, ref, ceil, floor) => {
        if (!price || !ref) return '#5f6368'; // gray for empty/null in light theme
        const p = parseFloat(price);
        const r = parseFloat(ref);
        const c = parseFloat(ceil);
        const f = parseFloat(floor);

        if (p === c) return PURPLE; // CEIL purple/magenta
        if (p === f) return CYAN; // FLOOR cyan
        if (p > r) return GREEN; // UP green
        if (p < r) return RED; // DOWN red
        return YELLOW; // REF yellow
    };

    // Derived style colors
    const GREEN = '#00ff7f';
    const RED = '#ff4444';
    const YELLOW = '#eab308';
    const PURPLE = '#d946ef'; // CEIL magenta
    const CYAN = '#06b6d4'; // FLOOR cyan
    const BLUE_BG = '#0d1117';
    const BORDER = '#222222';
    const HEADER_BG = '#1a1a1a';
    const HEADER_TEXT = '#888888';
    const TEXT_DEFAULT = '#cccccc';
    const BG_CARD = '#111111';
    const ROW_HOVER = '#222222';
    const FLASH_GREEN = 'rgba(0, 255, 127, 0.3)';
    const FLASH_RED = 'rgba(255, 68, 68, 0.3)';

    return (
        <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: TEXT_DEFAULT, fontFamily: 'Inter, sans-serif' }}>

            {/* Global CSS for the Dark table grid and flash animations */}
            <style jsx global>{`
                .pb-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                    background: ${BG_CARD};
                    color: ${TEXT_DEFAULT};
                }
                .pb-th {
                    background-color: ${HEADER_BG};
                    color: ${HEADER_TEXT};
                    padding: 8px 4px;
                    font-weight: 600;
                    border: 1px solid ${BORDER};
                    text-transform: uppercase;
                    white-space: nowrap;
                    font-size: 10px;
                    letter-spacing: 0.02em;
                }
                .pb-td {
                    padding: 6px 4px;
                    border-bottom: 1px solid ${BORDER};
                    border-right: 1px dotted #333;
                    text-align: right;
                    white-space: nowrap;
                    transition: background-color 0.15s ease;
                }
                .pb-td-left, .pb-th-left {
                    text-align: left;
                    padding-left: 10px;
                }
                .pb-td-center, .pb-th-center {
                    text-align: center;
                }
                .pb-row {
                    position: relative;
                }
                .pb-row:hover {
                    background-color: ${ROW_HOVER};
                }
                
                /* Improved Delete Button Visibility on Hover */
                .admin-delete-btn {
                    margin-left: 8px;
                    color: #f59e0b;
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    opacity: 0;
                    transition: opacity 0.2s ease, transform 0.2s ease, color 0.15s ease;
                    font-size: 16px;
                    line-height: 1;
                    font-weight: 800;
                    padding: 0 4px;
                    display: inline-block;
                    vertical-align: middle;
                }
                .pb-row:hover .admin-delete-btn {
                    opacity: 1;
                }
                .admin-delete-btn:hover {
                    color: #ff4444;
                    transform: scale(1.3);
                }

                /* Group separators */
                .pb-group-border {
                    border-left: 1px solid ${BORDER};
                }
                .pb-match-bg {
                    background-color: #161616; /* Slight highlight for the match column block */
                }
                
                /* Flash animations */
                @keyframes flashUp {
                    0% { background-color: rgba(0, 255, 127, 0.4); color: white; }
                    100% { background-color: transparent; }
                }
                @keyframes flashDown {
                    0% { background-color: rgba(255, 68, 68, 0.4); color: white; }
                    100% { background-color: transparent; }
                }
                .flash-green {
                    animation: flashUp 0.75s ease-out;
                    padding: 2px 4px;
                    border-radius: 2px;
                }
                .flash-red {
                    animation: flashDown 0.75s ease-out;
                    padding: 2px 4px;
                    border-radius: 2px;
                }
                
                /* Hide scrollbar for pills */
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
            `}</style>

            <div style={{ padding: '0px 16px 16px 16px' }}>

                {/* Header Top Controls */}
                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', fontWeight: '500' }}>
                        <div style={{ color: GREEN, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '8px', height: '8px', backgroundColor: GREEN, borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 6px ' + GREEN }}></span>
                            {loading ? 'Connecting...' : 'Live'}
                        </div>

                        {(prices['VNINDEX']?.date) && (
                            <span style={{ color: HEADER_TEXT, fontSize: '12px', fontWeight: 'normal' }}>
                                (As of Data: {prices['VNINDEX'].date} {prices['VNINDEX'].time ? prices['VNINDEX'].time : ''})
                            </span>
                        )}

                        <button
                            onClick={fetchLivePrices}
                            style={{ background: '#222', color: '#fff', border: '1px solid #444', padding: '3px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                        >
                            Force Refresh
                        </button>
                    </div>
                </div>

                {/* Index Cards Row */}
                <div className="priceboard-index-cards">
                    {/* VNINDEX */}
                    <div style={{ border: '1px solid ' + BORDER, borderRadius: '6px', padding: '12px', background: BG_CARD }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <span style={{ fontWeight: '600', fontSize: '14px', color: '#f59e0b' }}>VN-INDEX</span>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: (Number(prices['VNINDEX']?.change || 0) >= 0 ? GREEN : RED) }}>
                                {Number(prices['VNINDEX']?.change || 0) >= 0 ? '↑' : '↓'}
                            </span>
                            <span style={{ fontSize: '15px', fontWeight: 'bold', color: (Number(prices['VNINDEX']?.change || 0) >= 0 ? GREEN : RED) }}>
                                {prices['VNINDEX']?.price !== undefined ? Number(prices['VNINDEX'].price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}
                            </span>
                            <span style={{ fontSize: '13px', color: (Number(prices['VNINDEX']?.change || 0) >= 0 ? GREEN : RED) }}>
                                ({Number(prices['VNINDEX']?.change || 0).toFixed(2)} {Number(prices['VNINDEX']?.pctChange || 0).toFixed(2)}%)
                            </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#ddd', marginBottom: '6px' }}>
                            {prices['VNINDEX']?.totalVol ? Number(prices['VNINDEX'].totalVol).toLocaleString() : '--'} <span style={{ color: '#f59e0b', fontWeight: '600' }}>CP</span> {prices['VNINDEX']?.totalVal ? (Number(prices['VNINDEX'].totalVal) / 1000000000).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '--'} <span style={{ color: '#f59e0b', fontWeight: '600' }}>VND bn</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#ddd' }}>
                            <span style={{ color: GREEN, fontWeight: 'bold' }}>↑ {prices['VNINDEX']?.advances || 0}</span>
                            <span style={{ color: '#d946ef' }}>({prices['VNINDEX']?.ceilings || 0})</span>
                            <span style={{ color: YELLOW, fontSize: '10px' }}>■</span>
                            <span style={{ color: YELLOW, fontWeight: 'bold' }}>{prices['VNINDEX']?.noChanges || 0}</span>
                            <span style={{ color: RED, fontWeight: 'bold' }}>↓ {prices['VNINDEX']?.declines || 0}</span>
                            <span style={{ color: '#06b6d4' }}>({prices['VNINDEX']?.floors || 0})</span>
                            <span style={{ marginLeft: 'auto', color: '#888', fontSize: '12px' }}>{loading ? 'Loading' : 'Closed'}</span>
                        </div>
                    </div>
                    {/* VN30 */}
                    <div style={{ border: '1px solid ' + BORDER, borderRadius: '6px', padding: '12px', background: BG_CARD }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <span style={{ fontWeight: '600', fontSize: '14px', color: '#f59e0b' }}>VN30</span>
                            <span style={{ fontSize: '14px', fontWeight: 'bold', color: (Number(prices['VN30']?.change || 0) >= 0 ? GREEN : RED) }}>
                                {Number(prices['VN30']?.change || 0) >= 0 ? '↑' : '↓'}
                            </span>
                            <span style={{ fontSize: '15px', fontWeight: 'bold', color: (Number(prices['VN30']?.change || 0) >= 0 ? GREEN : RED) }}>
                                {prices['VN30']?.price !== undefined ? Number(prices['VN30'].price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}
                            </span>
                            <span style={{ fontSize: '13px', color: (Number(prices['VN30']?.change || 0) >= 0 ? GREEN : RED) }}>
                                ({Number(prices['VN30']?.change || 0).toFixed(2)} {Number(prices['VN30']?.pctChange || 0).toFixed(2)}%)
                            </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#ddd', marginBottom: '6px' }}>
                            {prices['VN30']?.totalVol ? Number(prices['VN30'].totalVol).toLocaleString() : '--'} <span style={{ color: '#f59e0b', fontWeight: '600' }}>CP</span> {prices['VN30']?.totalVal ? (Number(prices['VN30'].totalVal) / 1000000000).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '--'} <span style={{ color: '#f59e0b', fontWeight: '600' }}>VND bn</span>
                        </div>
                        {/* Only show breadth if there is actual data, as SSI API often returns 0 for VN30 index breadth */}
                        {(Number(prices['VN30']?.advances) > 0 || Number(prices['VN30']?.declines) > 0 || Number(prices['VN30']?.noChanges) > 0) ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#ddd' }}>
                                <span style={{ color: GREEN, fontWeight: 'bold' }}>↑ {prices['VN30']?.advances || 0}</span>
                                <span style={{ color: '#d946ef' }}>({prices['VN30']?.ceilings || 0})</span>
                                <span style={{ color: YELLOW, fontSize: '10px' }}>■</span>
                                <span style={{ color: YELLOW, fontWeight: 'bold' }}>{prices['VN30']?.noChanges || 0}</span>
                                <span style={{ color: RED, fontWeight: 'bold' }}>↓ {prices['VN30']?.declines || 0}</span>
                                <span style={{ color: '#06b6d4' }}>({prices['VN30']?.floors || 0})</span>
                                <span style={{ marginLeft: 'auto', color: '#888', fontSize: '12px' }}>{loading ? 'Loading' : 'Closed'}</span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontSize: '13px', color: '#ddd' }}>
                                <span style={{ color: '#888', fontSize: '12px' }}>{loading ? 'Loading' : 'Closed'}</span>
                            </div>
                        )}
                    </div>
                    {/* VN30F1M */}
                    <div style={{ border: '1px solid ' + BORDER, borderRadius: '6px', padding: '12px', background: BG_CARD }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '600', fontSize: '13px', color: HEADER_TEXT, display: 'flex', alignItems: 'center', gap: '4px' }}>VN30F1M <span style={{ fontSize: '10px', border: '1px solid #444', padding: '0 3px', borderRadius: '3px' }}>C</span></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
                            <span style={{ fontSize: '18px', fontWeight: 'bold', color: (Number(prices['VN30F1M']?.change || 0) >= 0 ? GREEN : RED) }}>
                                {prices['VN30F1M']?.price !== undefined ? Number(prices['VN30F1M'].price).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '--'}
                            </span>
                            <span style={{ fontSize: '12px', color: (Number(prices['VN30F1M']?.change || 0) >= 0 ? GREEN : RED), fontWeight: '500' }}>
                                {Number(prices['VN30F1M']?.change || 0) > 0 ? '+' : ''}{Number(prices['VN30F1M']?.change || 0).toFixed(1)} ({Number(prices['VN30F1M']?.change || 0) > 0 ? '+' : ''}{(Number(prices['VN30F1M']?.pctChange || 0)).toFixed(2)}%)
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: HEADER_TEXT, fontWeight: '600' }}>
                            <div>VOL<br /><span style={{ fontSize: '12px', color: '#fff' }}>{prices['VN30F1M']?.totalVol ? (prices['VN30F1M'].totalVol >= 1000 ? (prices['VN30F1M'].totalVol / 1000).toFixed(1) + 'K' : prices['VN30F1M'].totalVol.toLocaleString()) : '--'}</span></div>
                            <div>HIGH<br /><span style={{ fontSize: '12px', color: GREEN }}>{prices['VN30F1M']?.high ? Number(prices['VN30F1M'].high).toFixed(1) : '--'}</span></div>
                            <div>LOW<br /><span style={{ fontSize: '12px', color: RED }}>{prices['VN30F1M']?.low ? Number(prices['VN30F1M'].low).toFixed(1) : '--'}</span></div>
                            <div>REF<br /><span style={{ fontSize: '12px', color: YELLOW }}>{prices['VN30F1M']?.ref ? Number(prices['VN30F1M'].ref).toFixed(1) : '--'}</span></div>
                        </div>
                    </div>
                    {/* VN30F2M */}
                    <div style={{ border: '1px solid ' + BORDER, borderRadius: '6px', padding: '12px', background: BG_CARD }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '600', fontSize: '13px', color: HEADER_TEXT, display: 'flex', alignItems: 'center', gap: '4px' }}>VN30F2M <span style={{ fontSize: '10px', border: '1px solid #444', padding: '0 3px', borderRadius: '3px' }}>C</span></span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
                            <span style={{ fontSize: '18px', fontWeight: 'bold', color: (Number(prices['VN30F2M']?.change || 0) >= 0 ? GREEN : RED) }}>
                                {prices['VN30F2M']?.price !== undefined ? Number(prices['VN30F2M'].price).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '--'}
                            </span>
                            <span style={{ fontSize: '12px', color: (Number(prices['VN30F2M']?.change || 0) >= 0 ? GREEN : RED), fontWeight: '500' }}>
                                {Number(prices['VN30F2M']?.change || 0) > 0 ? '+' : ''}{Number(prices['VN30F2M']?.change || 0).toFixed(1)} ({Number(prices['VN30F2M']?.change || 0) > 0 ? '+' : ''}{(Number(prices['VN30F2M']?.pctChange || 0)).toFixed(2)}%)
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: HEADER_TEXT, fontWeight: '600' }}>
                            <div>VOL<br /><span style={{ fontSize: '12px', color: '#fff' }}>{prices['VN30F2M']?.totalVol ? (prices['VN30F2M'].totalVol >= 1000 ? (prices['VN30F2M'].totalVol / 1000).toFixed(1) + 'K' : prices['VN30F2M'].totalVol.toLocaleString()) : '--'}</span></div>
                            <div>HIGH<br /><span style={{ fontSize: '12px', color: GREEN }}>{prices['VN30F2M']?.high ? Number(prices['VN30F2M'].high).toFixed(1) : '--'}</span></div>
                            <div>LOW<br /><span style={{ fontSize: '12px', color: RED }}>{prices['VN30F2M']?.low ? Number(prices['VN30F2M'].low).toFixed(1) : '--'}</span></div>
                            <div>REF<br /><span style={{ fontSize: '12px', color: YELLOW }}>{prices['VN30F2M']?.ref ? Number(prices['VN30F2M'].ref).toFixed(1) : '--'}</span></div>
                        </div>
                    </div>
                </div>

                {/* Filter Pills */}
                <div className="hide-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', border: '1px solid ' + BORDER, borderRadius: '8px', padding: '8px', background: BG_CARD, marginBottom: '16px' }}>
                    {(() => {
                        // Combine base sectors with any custom sector keys that aren't already base sectors
                        const customKeys = Object.keys(customSectors).filter(k => !Object.keys(SECTORS).includes(k));
                        const allTabs = Object.keys(SECTORS).concat(customKeys).concat(['Watchlist']);

                        return allTabs.map(tab => {
                            const perf = getSectorPerformance(tab);
                            const perfColor = perf > 0 ? GREEN : perf < 0 ? RED : '#eab308';
                            const perfStr = perf === null ? '' : `${perf > 0 ? '+' : ''}${perf}%`;
                            const isActive = activeTab === tab;
                            const isPureCustom = customKeys.includes(tab);

                            return (
                                <div
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        backgroundColor: isActive ? '#065f46' : 'transparent',
                                        color: isActive ? '#fff' : HEADER_TEXT,
                                        transition: 'all 0.2s',
                                        position: 'relative'
                                    }}
                                >
                                    {tab}
                                    {isAdmin && isPureCustom && (
                                        <button
                                            onClick={(e) => handleDeleteCustomSector(e, tab)}
                                            style={{
                                                position: 'absolute',
                                                top: '-4px',
                                                right: '-4px',
                                                background: '#ff4444',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '50%',
                                                width: '14px',
                                                height: '14px',
                                                fontSize: '10px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                padding: 0
                                            }}
                                            title={`Delete ${tab} sector`}
                                        >
                                            ×
                                        </button>
                                    )}
                                    {perf !== null && (
                                        <span style={{ fontSize: '11px', fontWeight: '500', marginTop: '2px', color: isActive ? '#a7f3d0' : perfColor }}>
                                            {perfStr}
                                        </span>
                                    )}
                                </div>
                            );
                        });
                    })()}
                </div>

                {/* Main Table */}
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '450px', border: '1px solid ' + BORDER, borderRadius: '8px', background: BG_CARD }}>
                    <table className="pb-table">
                        <thead>
                            <tr>
                                <th className="pb-th pb-th-left" rowSpan="2" style={{ width: '60px', borderBottom: '1px solid ' + BORDER }}>Symbol</th>
                                <th className="pb-th pb-th-center" rowSpan="2" style={{ borderBottom: '1px solid ' + BORDER, color: '#eab308' }}>Ref</th>
                                <th className="pb-th pb-th-center" rowSpan="2" style={{ borderBottom: '1px solid ' + BORDER, color: '#9333ea' }}>Ceil</th>
                                <th className="pb-th pb-th-center" rowSpan="2" style={{ borderBottom: '1px solid ' + BORDER, color: '#06b6d4' }}>Floor</th>
                                <th className="pb-th pb-th-center pb-group-border" rowSpan="2" style={{ borderBottom: '1px solid ' + BORDER, color: HEADER_TEXT }}>Total Vol</th>

                                <th className="pb-th pb-th-center pb-group-border" colSpan="6" style={{ color: '#38bdf8' }}>Bids</th>
                                <th className="pb-th pb-th-center pb-group-border pb-match-bg" colSpan="3" style={{ color: '#fff' }}>Match</th>
                                <th className="pb-th pb-th-center pb-group-border" colSpan="6" style={{ color: '#38bdf8' }}>Asks</th>

                                <th className="pb-th pb-th-center pb-group-border" colSpan="3" style={{ color: HEADER_TEXT }}>Range</th>
                                <th className="pb-th pb-th-center pb-group-border" colSpan="2" style={{ color: HEADER_TEXT }}>Foreign</th>
                            </tr>
                            <tr>
                                {/* Bids */}
                                <th className="pb-th pb-group-border">P3</th>
                                <th className="pb-th">V3</th>
                                <th className="pb-th">P2</th>
                                <th className="pb-th">V2</th>
                                <th className="pb-th">P1</th>
                                <th className="pb-th">V1</th>

                                {/* Match */}
                                <th className="pb-th pb-group-border pb-match-bg">Price</th>
                                <th className="pb-th pb-match-bg">Vol</th>
                                <th className="pb-th pb-match-bg">+/- %</th>

                                {/* Asks */}
                                <th className="pb-th pb-group-border">P1</th>
                                <th className="pb-th">V1</th>
                                <th className="pb-th">P2</th>
                                <th className="pb-th">V2</th>
                                <th className="pb-th">P3</th>
                                <th className="pb-th">V3</th>

                                {/* Range */}
                                <th className="pb-th pb-group-border">High</th>
                                <th className="pb-th">Avg</th>
                                <th className="pb-th">Low</th>

                                {/* Foreign */}
                                <th className="pb-th pb-group-border">Buy</th>
                                <th className="pb-th">Sell</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeTickers.length === 0 ? (
                                <tr>
                                    <td colSpan="17" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>No symbols found. {activeTab === 'Watchlist' && 'Add some to your Watchlist below!'}</td>
                                </tr>
                            ) : activeTickers.map(ticker => {
                                const d = prices[ticker] || {};
                                const ref = d.ref || 0;
                                const ceil = d.ceil || 0;
                                const floor = d.floor || 0;
                                const matchPrice = d.price || 0;
                                const matchVol = d.matchVol || 0;

                                // Fake volume logic removed, use exact volume
                                const fv = (v) => v;

                                const colorClass = matchPrice > ref ? GREEN : (matchPrice < ref ? RED : '#eab308');
                                const diffPct = matchPrice && ref ? (((matchPrice - ref) / ref) * 100).toFixed(2) : 0;
                                const pctColor = parseFloat(diffPct) > 0 ? GREEN : (parseFloat(diffPct) < 0 ? RED : '#eab308');

                                const symbolColor = getColorClass(matchPrice, ref, ceil, floor);

                                return (
                                    <tr key={ticker} className="pb-row" style={{ position: 'relative' }}>
                                        <td className="pb-td pb-td-left" style={{ color: symbolColor, fontWeight: 'bold' }}>
                                            <span 
                                                style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                                onClick={() => setChartTicker(ticker)}
                                            >
                                                {ticker}
                                            </span>
                                            {/* Delete Button for Watchlist */}
                                            {activeTab === 'Watchlist' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveWatchlist(ticker); }}
                                                    className="admin-delete-btn"
                                                    title="Remove from Watchlist"
                                                >
                                                    ×
                                                </button>
                                            )}
                                            {/* Admin Delete Button for Sectors */}
                                            {isAdmin && activeTab !== 'Watchlist' && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRemoveCustomSectorTicker(ticker); }}
                                                    className="admin-delete-btn"
                                                    title="Remove from Sector"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </td>

                                        {/* Reference, Ceil, Floor */}
                                        <td className="pb-td" style={{ color: '#eab308' }}>{formatPrice(ref)}</td>
                                        <td className="pb-td" style={{ color: '#9333ea' }}>{formatPrice(ceil)}</td>
                                        <td className="pb-td" style={{ color: '#06b6d4' }}>{formatPrice(floor)}</td>

                                        {/* Total Vol */}
                                        <td className="pb-td pb-group-border" style={{ color: '#fff' }}>{formatVolString(d.totalVol)}</td>

                                        {/* Bids */}
                                        <td className="pb-td pb-group-border" style={{ color: getColorClass(d.b3p, ref, ceil, floor) }}>
                                            <LiveCell value={d.b3p} formatter={formatPrice} currentPrice={d.b3p} comparePrice={ref} />
                                        </td>
                                        <td className="pb-td" style={{ color: HEADER_TEXT }}><LiveCell value={d.b3v || fv(d.b3v)} formatter={formatVolString} /></td>

                                        <td className="pb-td" style={{ color: getColorClass(d.b2p, ref, ceil, floor) }}>
                                            <LiveCell value={d.b2p} formatter={formatPrice} currentPrice={d.b2p} comparePrice={ref} />
                                        </td>
                                        <td className="pb-td" style={{ color: HEADER_TEXT }}><LiveCell value={d.b2v || fv(d.b2v)} formatter={formatVolString} /></td>

                                        <td className="pb-td" style={{ color: getColorClass(d.b1p, ref, ceil, floor) }}>
                                            <LiveCell value={d.b1p} formatter={formatPrice} currentPrice={d.b1p} comparePrice={ref} />
                                        </td>
                                        <td className="pb-td" style={{ color: HEADER_TEXT }}><LiveCell value={d.b1v || fv(d.b1v)} formatter={formatVolString} /></td>

                                        {/* Match */}
                                        <td className="pb-td pb-group-border pb-match-bg" style={{ color: colorClass, fontWeight: 'bold' }}>
                                            <LiveCell value={matchPrice} formatter={formatPrice} currentPrice={matchPrice} comparePrice={ref} />
                                        </td>
                                        <td className="pb-td pb-match-bg" style={{ color: HEADER_TEXT }}>
                                            <LiveCell value={matchVol} formatter={formatVolString} />
                                        </td>
                                        <td className="pb-td pb-match-bg" style={{ color: pctColor }}>
                                            <LiveCell value={diffPct} formatter={formatPct} currentPrice={matchPrice} comparePrice={ref} />
                                        </td>

                                        {/* Asks */}
                                        <td className="pb-td pb-group-border" style={{ color: getColorClass(d.a1p, ref, ceil, floor) }}>
                                            <LiveCell value={d.a1p} formatter={formatPrice} currentPrice={d.a1p} comparePrice={ref} />
                                        </td>
                                        <td className="pb-td" style={{ color: HEADER_TEXT }}><LiveCell value={d.a1v || fv(d.a1v)} formatter={formatVolString} /></td>

                                        <td className="pb-td" style={{ color: getColorClass(d.a2p, ref, ceil, floor) }}>
                                            <LiveCell value={d.a2p} formatter={formatPrice} currentPrice={d.a2p} comparePrice={ref} />
                                        </td>
                                        <td className="pb-td" style={{ color: HEADER_TEXT }}><LiveCell value={d.a2v || fv(d.a2v)} formatter={formatVolString} /></td>

                                        <td className="pb-td" style={{ color: getColorClass(d.a3p, ref, ceil, floor) }}>
                                            <LiveCell value={d.a3p} formatter={formatPrice} currentPrice={d.a3p} comparePrice={ref} />
                                        </td>
                                        <td className="pb-td" style={{ color: HEADER_TEXT }}><LiveCell value={d.a3v || fv(d.a3v)} formatter={formatVolString} /></td>

                                        {/* Range (High, Avg, Low) */}
                                        <td className="pb-td pb-group-border" style={{ color: getColorClass(d.high, ref, ceil, floor) }}>
                                            <LiveCell value={d.high} formatter={formatPrice} currentPrice={d.high} comparePrice={ref} />
                                        </td>
                                        <td className="pb-td" style={{ color: getColorClass(d.avg, ref, ceil, floor) }}>
                                            <LiveCell value={d.avg} formatter={formatPrice} currentPrice={d.avg} comparePrice={ref} />
                                        </td>
                                        <td className="pb-td" style={{ color: getColorClass(d.low, ref, ceil, floor) }}>
                                            <LiveCell value={d.low} formatter={formatPrice} currentPrice={d.low} comparePrice={ref} />
                                        </td>

                                        {/* Foreign Trades */}
                                        <td className="pb-td pb-group-border" style={{ color: '#fff' }}>{formatVolString(d.fBuy)}</td>
                                        <td className="pb-td" style={{ color: '#fff' }}>{formatVolString(d.fSell)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Watchlist Manager (Only visible in Watchlist tab) */}
                {activeTab === 'Watchlist' && (
                    <div style={{ marginTop: '24px', border: '1px solid ' + BORDER, borderRadius: '8px', padding: '24px', background: BG_CARD, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0', color: '#fff' }}>Portfolio Manager</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' }}>
                                <span style={{ color: HEADER_TEXT }}>Margin:</span>
                                <select
                                    value={margin}
                                    onChange={(e) => handleUpdateMargin(e.target.value)}
                                    style={{ background: '#1a1a1a', color: '#fff', border: '1px solid ' + BORDER, borderRadius: '4px', padding: '2px 8px', outline: 'none' }}
                                >
                                    <option value="1.0">100% (Cash only)</option>
                                    <option value="1.5">150% (Margin)</option>
                                    <option value="2.0">200% (Duo Margin)</option>
                                </select>
                            </div>
                        </div>

                        <form onSubmit={handleAddWatchlist} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                            <input
                                type="text"
                                value={watchInput}
                                onChange={e => setWatchInput(e.target.value)}
                                placeholder="ENTER SYMBOL (E.G., VNM)"
                                style={{
                                    flex: 1,
                                    padding: '12px 16px',
                                    borderRadius: '6px',
                                    border: '1px solid #14886b',
                                    fontSize: '14px',
                                    outline: 'none',
                                    background: 'transparent',
                                    color: '#fff'
                                }}
                            />
                            <button
                                type="submit"
                                style={{
                                    backgroundColor: '#14886b',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '0 24px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Add
                            </button>
                        </form>

                        {/* Watchlist Weight Sum & Warning */}
                        {watchlist.length > 0 && (() => {
                            const total = watchlist.reduce((sum, sym) => sum + (watchlistWeights[sym] || (100 / watchlist.length)), 0);
                            return (
                                <div style={{ marginBottom: '16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: HEADER_TEXT }}>Allocated Capital: </span>
                                    <span style={{ color: total > 100 ? RED : GREEN, fontWeight: 'bold' }}>{total.toFixed(0)}%</span>
                                    {total < 100 && (
                                        <span style={{ color: HEADER_TEXT, fontStyle: 'italic' }}>— Remaining {(100 - total).toFixed(0)}% is Cash (0% return)</span>
                                    )}
                                    {total > 100 && (
                                        <span style={{ color: RED, fontStyle: 'italic' }}>— Warning: Total exceeds 100% limit. ACB max allowed: {(100 - (total - (watchlistWeights['ACB'] || 0))).toFixed(0)}% (Calculation will auto-normalize).</span>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Watchlist Active Chips */}
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {watchlist.map(sym => (
                                <div key={sym} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    backgroundColor: '#1a1a1a',
                                    border: '1px solid ' + BORDER,
                                    color: '#fff',
                                    fontSize: '13px',
                                    fontWeight: '600'
                                }}>
                                    {sym}
                                    <div style={{ display: 'flex', alignItems: 'center', background: '#0a0a0a', borderRadius: '4px', padding: '2px 4px', marginLeft: '4px' }}>
                                        <input
                                            type="number"
                                            placeholder="Eq"
                                            title="Weight (%)"
                                            value={watchlistWeights[sym] !== undefined ? watchlistWeights[sym] : ''}
                                            onChange={(e) => handleUpdateWatchlistWeight(sym, e.target.value)}
                                            style={{
                                                width: '36px',
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#a3a3a3',
                                                fontSize: '11px',
                                                textAlign: 'center',
                                                outline: 'none',
                                                MozAppearance: 'textfield' // Firefox hide arrows
                                            }}
                                        />
                                        <span style={{ fontSize: '10px', color: '#666' }}>%</span>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveWatchlist(sym)}
                                        style={{
                                            background: '#444',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '16px',
                                            height: '16px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '10px',
                                            cursor: 'pointer',
                                            padding: 0
                                        }}
                                        title="Remove ticker"
                                    >×</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Custom Sector Manager (Visible on specific sectors to append stocks) */}
                {activeTab !== 'Watchlist' && isAdmin && (
                    <div style={{ marginTop: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        {/* Manage Current Sector Tickers */}
                        <div style={{ flex: 1, minWidth: '300px', border: '1px solid ' + BORDER, borderRadius: '8px', padding: '24px', background: BG_CARD, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0', color: '#fff' }}>Customize `{activeTab}` Sector Group</h2>
                            </div>
                            <form onSubmit={handleAddCustomSectorTicker} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                <input
                                    type="text"
                                    value={sectorInput}
                                    onChange={e => setSectorInput(e.target.value)}
                                    placeholder={`ADD STOCK TO ${activeTab.toUpperCase()} SQUAD... (E.G. HPG)`}
                                    style={{
                                        flex: 1,
                                        padding: '12px 16px',
                                        borderRadius: '6px',
                                        border: '1px solid #00a884',
                                        fontSize: '14px',
                                        outline: 'none',
                                        background: 'transparent',
                                        color: '#fff'
                                    }}
                                />
                                <button
                                    type="submit"
                                    style={{
                                        backgroundColor: '#00a884',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '0 24px',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Add
                                </button>
                            </form>

                            {/* Custom Appended Chips */}
                            {customSectors[activeTab] && customSectors[activeTab].length > 0 && (
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
                                    <span style={{ color: HEADER_TEXT, fontSize: '13px', display: 'flex', alignItems: 'center' }}>Added to {activeTab}:</span>
                                    {customSectors[activeTab].map(sym => (
                                        <div key={sym} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '6px 12px',
                                            borderRadius: '8px',
                                            backgroundColor: '#1a1a1a',
                                            border: '1px solid #00a884',
                                            color: '#00a884',
                                            fontSize: '13px',
                                            fontWeight: '600'
                                        }}>
                                            {sym}
                                            <button
                                                onClick={() => handleRemoveCustomSectorTicker(sym)}
                                                style={{
                                                    background: 'transparent',
                                                    color: '#00a884',
                                                    border: 'none',
                                                    borderRadius: '50%',
                                                    width: '16px',
                                                    height: '16px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '14px',
                                                    cursor: 'pointer',
                                                    padding: 0
                                                }}
                                                title="Remove custom ticker"
                                            >×</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Create Brand New Sector */}
                        <div style={{ flex: 1, minWidth: '300px', border: '1px solid ' + BORDER, borderRadius: '8px', padding: '24px', background: BG_CARD, boxShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0', color: '#fff' }}>Create a New Sector</h2>
                            </div>
                            <form onSubmit={handleCreateNewSector} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                                <input
                                    type="text"
                                    value={newSectorInput}
                                    onChange={e => setNewSectorInput(e.target.value)}
                                    placeholder="Enter new sector name (e.g. Logistics)"
                                    style={{
                                        flex: 1,
                                        padding: '12px 16px',
                                        borderRadius: '6px',
                                        border: '1px solid #00a884',
                                        fontSize: '14px',
                                        background: '#0a0a0a',
                                        color: '#fff',
                                        outline: 'none'
                                    }}
                                />
                                <button
                                    type="submit"
                                    style={{
                                        backgroundColor: '#14886b',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '0 24px',
                                        fontWeight: '600',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Create Sector
                                </button>
                            </form>
                            <p style={{ fontSize: '12px', color: '#888', margin: 0 }}>Create a completely new sector tab for the priceboard. Once created, select the tab and use the tools on the left to add stocks to it.</p>
                        </div>

                    </div>
                )}
            </div>

            {/* General Ticker Chart Modal */}
            {chartTicker && (
                <UnifiedTickerChartModal 
                    ticker={chartTicker} 
                    onClose={() => setChartTicker(null)} 
                />
            )}
        </div>
    );
}
