'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import ForecastTable from './ForecastTable';
import UnifiedComparisonTable from './UnifiedComparisonTable';
import BrokerComparison from './BrokerComparison';
import PeerComparison from './PeerComparison';
import ReportDetailErrorBoundary from './ReportDetailErrorBoundary';
import Header from './Header';

ChartJS.register(ArcElement, Tooltip, Legend);

ChartJS.register(ArcElement, Tooltip, Legend);

// === Helpers ===
const safeToFixed = (val, digits = 1) => {
    if (val == null || isNaN(val)) return '-';
    // If val is string, try parse
    const num = Number(val);
    if (isNaN(num)) return '-';
    return num.toFixed(digits);
};

const getQuarterFromDate = (dateString) => {
    if (!dateString || dateString.length !== 6) return null;

    // User confirmed JSON uses YYMMDD format
    // Try YYMMDD first
    const yy = parseInt(dateString.substring(0, 2));
    const mm = parseInt(dateString.substring(2, 4));
    const dd = parseInt(dateString.substring(4, 6));
    const year_yymmdd = 2000 + yy;

    // Check if YYMMDD gives reasonable year (2000-2027)
    const isValidYYMMDD = (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && year_yymmdd <= 2027);

    if (isValidYYMMDD) {
        const quarter = Math.ceil(mm / 3);
        return { quarter, year: year_yymmdd, label: `Q${quarter} ${year_yymmdd}` };
    }

    // If year > 2027 (e.g., "311223" -> 2031), try DDMMYY interpretation  
    const dd2 = parseInt(dateString.substring(0, 2));
    const mm2 = parseInt(dateString.substring(2, 4));
    const yy2 = parseInt(dateString.substring(4, 6));
    const year_ddmmyy = 2000 + yy2;

    if (mm2 >= 1 && mm2 <= 12 && dd2 >= 1 && dd2 <= 31 && year_ddmmyy <= 2027) {
        const quarter = Math.ceil(mm2 / 3);
        return { quarter, year: year_ddmmyy, label: `Q${quarter} ${year_ddmmyy}` };
    }

    // Invalid future date
    return null;
};

// Get previous quarter label from a quarter label like "Q4 2025"
const getPreviousQuarterLabel = (quarterLabel) => {
    if (!quarterLabel || quarterLabel === 'All') return null;
    const [qPart, yearPart] = quarterLabel.split(' ');
    let quarter = parseInt(qPart.replace('Q', ''));
    let year = parseInt(yearPart);

    if (quarter === 1) {
        quarter = 4;
        year = year - 1;
    } else {
        quarter = quarter - 1;
    }

    return `Q${quarter} ${year}`;
};

const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 6) return dateStr || '-';
    const yy = dateStr.substring(0, 2);
    const mm = dateStr.substring(2, 4);
    const dd = dateStr.substring(4, 6);
    return `${dd}/${mm}/20${yy}`;
};

// Determine Call Type (Buy/Hold/Sell)
const getCallType = (call) => {
    if (!call || call === 'No Rating') return 'No Rating';
    const c = call.toLowerCase();
    if (c === 'neutral') return 'Hold'; // Map standard Neutral to Hold logic for summary
    if (['buy', 'outperform', 'add', 'accumulate', 'overweight'].some(k => c.includes(k))) return 'Buy';
    if (['sell', 'underperform', 'reduce', 'underweight'].some(k => c.includes(k))) return 'Sell';
    return 'Hold';
};

// Get recommendation pill styling
const getRecommendationStyle = (recommendation) => {
    const normalizedRec = recommendation?.toLowerCase() || '';

    // Buy/Outperform -> Green
    if (['buy', 'outperform', 'add', 'accumulate', 'overweight'].some(k => normalizedRec.includes(k))) {
        return {
            backgroundColor: '#00ff7f',
            color: 'black',
            border: 'none'
        };
    }

    // Sell/Underperform -> Red
    if (['sell', 'underperform', 'reduce', 'underweight'].some(k => normalizedRec.includes(k))) {
        return {
            backgroundColor: '#ff4444',
            color: 'white',
            border: 'none'
        };
    }

    // Neutral/Hold -> Dark grey
    if (['neutral', 'hold', 'market perform'].some(k => normalizedRec.includes(k))) {
        return {
            backgroundColor: '#4A5568',
            color: 'white',
            border: 'none'
        };
    }

    // No Rating -> Just border, no background
    return {
        backgroundColor: 'transparent',
        color: 'white',
        border: '1px solid #3A3A3C'
    };
};

const getTickerCallsSummary = (ticker, reports) => {
    const tickerReports = reports.filter(r => r.info_of_report.ticker === ticker);

    // Group by broker and keep only the latest report from each
    const brokerLatestMap = {};
    tickerReports.forEach(r => {
        const broker = r.info_of_report.issued_company || 'Unknown';
        const date = r.info_of_report.date_of_issue;

        if (!brokerLatestMap[broker] || date > brokerLatestMap[broker].info_of_report.date_of_issue) {
            brokerLatestMap[broker] = r;
        }
    });

    // Count recommendations from each broker's latest report only
    // Skip "No Rating" as it's not a real recommendation
    let buy = 0, hold = 0, sell = 0;
    Object.values(brokerLatestMap).forEach(r => {
        const type = getCallType(r.recommendation?.recommendation);
        if (type === 'Buy') buy++;
        else if (type === 'Sell') sell++;
        else if (type === 'Hold') hold++;
        // Skip 'No Rating' - don't count it
    });

    // Return JSX for colored display - no separators, more compact
    const element = (
        <span style={{ fontSize: '0.75rem' }}>
            <span style={{ color: '#00ff7f' }}>{buy}▲</span>
            <span style={{ color: '#666' }}> {hold}○ </span>
            <span style={{ color: '#ff6666' }}>{sell}▼</span>
        </span>
    );
    return { buy, hold, sell, str: `${buy}▲ ${hold}○ ${sell}▼`, element };
};

const getPreviousReport = (currentReport, allReports) => {
    if (!currentReport || !allReports) return null;
    const ticker = currentReport.info_of_report.ticker;
    // Filter reports for the same ticker
    const tickerReports = allReports
        .filter(r => r.info_of_report.ticker === ticker)
        .sort((a, b) => b.info_of_report.date_of_issue.localeCompare(a.info_of_report.date_of_issue)); // Descending date

    const currentIndex = tickerReports.findIndex(r => r.info_of_report.source_file === currentReport.info_of_report.source_file);
    if (currentIndex === -1) return null;

    // Find the next report that has a valid target price
    for (let i = currentIndex + 1; i < tickerReports.length; i++) {
        if (tickerReports[i].recommendation?.target_price != null) {
            return tickerReports[i];
        }
    }
    return null;
};

const getFinancialValue = (report, key) => {
    if (!report?.forecast_summary) return null;
    if (key === 'revenue') return report.forecast_summary.revenue || report.forecast_summary.net_revenue || report.forecast_summary.total_operating_income || null;
    return report.forecast_summary[key];
};

const calculateChange = (curr, prev) => {
    if (curr == null || prev == null || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
};

// Helper for Color Logic
const getPerfColorClass = (value) => {
    if (value == null) return 'text-white'; // Default fallback
    if (value > 0.5) return 'text-[#00ff7f]'; // Green
    if (value < -0.5) return 'text-[#ff6666]'; // Red
    return 'text-gray-500'; // Dark Grey / Neutral for -0.5 to 0.5
};

// Helper for Company Name
const getCompanyName = (ticker) => {
    const map = {
        'FPT': 'FPT Corporation (HSX: FPT)',
        // Add others if known, otherwise default
    };
    return map[ticker] || ticker;
};

export default function Dashboard({ reports: propReports, shouldFetchData }) {
    // === Validation Function ===
    const validateReport = (report) => {
        try {
            // Basic required fields
            if (!report || !report.id) return false;
            if (!report.info_of_report) return false;
            if (!report.recommendation) return false;

            // Check forecast_table structure if present
            if (report.forecast_table) {
                const ft = report.forecast_table;

                // Validate columns array exists
                if (ft.columns && Array.isArray(ft.columns)) {
                    // Check for null/undefined columns
                    for (let i = 0; i < ft.columns.length; i++) {
                        if (ft.columns[i] == null || ft.columns[i] === '') {
                            console.warn(`Invalid report ${report.id}: missing column at index ${i}`);
                            return false;
                        }
                    }

                    // If it has rows array, validate each row has proper structure
                    if (ft.rows && Array.isArray(ft.rows)) {
                        for (const row of ft.rows) {
                            // Check if values array exists and validate bounds
                            if (row.values && Array.isArray(row.values)) {
                                // Values array should not exceed columns length
                                if (row.values.length > ft.columns.length) {
                                    console.warn(`Invalid report ${report.id}: row has ${row.values.length} values but only ${ft.columns.length} columns`);
                                    return false;
                                }
                            }
                            // For flat object format, validate that year columns exist as keys
                            else if (!row.values) {
                                // Check that row has properties for year columns
                                const yearColumns = ft.columns.filter(c => /^\d{4}F?$/.test(c));
                                // At least some year data should exist
                                const hasYearData = yearColumns.some(col => row[col] != null);
                                if (yearColumns.length > 0 && !hasYearData && !row.metric && !row.item) {
                                    // Row has no metric identifier and no year data
                                    console.warn(`Invalid report ${report.id}: row missing data and identifiers`);
                                    return false;
                                }
                            }
                        }
                    }
                }
            }

            return true;
        } catch (error) {
            console.warn(`Report validation failed for ${report?.id}:`, error);
            return false;
        }
    };

    // === State ===
    const [reports, setReports] = useState(() => {
        // Filter propReports on initial load
        return (propReports || []).filter(validateReport);
    });
    const [isLoading, setIsLoading] = useState(shouldFetchData);
    const [selectedReportId, setSelectedReportId] = useState(null);

    useEffect(() => {
        if (shouldFetchData) {
            setIsLoading(true);
            // Add timestamp to bypass browser cache and ensure fresh data
            fetch(`/reports.json?t=${new Date().getTime()}`)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    if (Array.isArray(data)) {
                        // Filter out invalid reports before setting state
                        const validReports = data.filter(validateReport);
                        const invalidCount = data.length - validReports.length;
                        if (invalidCount > 0) {
                            console.log(`Filtered out ${invalidCount} invalid reports`);
                        }
                        setReports(validReports.reverse()); // Match previous reverse logic
                    }
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error("Failed to load reports:", err);
                    setIsLoading(false);
                    // Optionally set error state to show UI message
                });
        }
    }, [shouldFetchData]);

    // Fallback or loading indicator?
    // The rest of the code uses 'filteredReports' derived from 'reports' (which should be 'reports' now)
    // We need to verify 'filteredReports' uses 'reports'.
    // BUT the prop `reports` was used in `useMemo` hooks. I need to change them to use `reports` state.

    // === Derived Data ===
    // Update dependencies from 'reports' to 'reports'

    const [selectedHistYear, setSelectedHistYear] = useState(null);
    const [comparisonMode, setComparisonMode] = useState('historical'); // 'historical' | 'peers'
    const [rankingMode, setRankingMode] = useState('buy'); // 'buy' | 'sell'
    const [minRecommendations, setMinRecommendations] = useState(1); // Minimum number of recommendations to show
    const [coverageHorizon, setCoverageHorizon] = useState('6M'); // '3M' | '6M' | '1Y'
    const [coverageBrokers, setCoverageBrokers] = useState([]); // Empty = all brokers
    const [hoveredCoverageRow, setHoveredCoverageRow] = useState(null); // Which row is hovered for tooltip
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, align: 'bottom' });

    const handleMouseEnter = (e, row) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const bottomHalf = e.clientY > window.innerHeight / 2;
        setTooltipPos({
            x: e.clientX,
            y: e.clientY,
            align: bottomHalf ? 'top' : 'bottom'
        });
        setHoveredCoverageRow(row);
    };

    // Helper to format date from YYMMDD to DD/MM/YYYY
    const formatDate = (dateValue) => {
        if (!dateValue) return '-';
        // Convert to string and pad to 6 digits if needed
        const dateStr = String(dateValue).padStart(6, '0');
        if (dateStr.length !== 6) return '-';

        const yy = dateStr.substring(0, 2);
        const mm = dateStr.substring(2, 4);
        const dd = dateStr.substring(4, 6);

        // Assume 20xx for years
        const yyyy = '20' + yy;
        return `${dd}/${mm}/${yyyy}`;
    };
    const [sortConfig, setSortConfig] = useState({ key: 'date_of_issue', direction: 'desc' });

    // Reset selectedHistYear when report changes
    useEffect(() => {
        setSelectedHistYear(null);
    }, [selectedReportId]);

    // Filters
    const [filterTicker, setFilterTicker] = useState('All');
    const [filterBroker, setFilterBroker] = useState('All');
    const [filterSector, setFilterSector] = useState('All');
    const [filterPeriod, setFilterPeriod] = useState('All');

    // Update filterPeriod to latest when reports are loaded
    useEffect(() => {
        if (reports.length > 0 && filterPeriod === 'All') {
            const dates = reports.map(r => getQuarterFromDate(r.info_of_report?.date_of_issue)).filter(Boolean);
            if (dates.length > 0) {
                const max = dates.reduce((prev, curr) => {
                    const pVal = prev.year * 10 + prev.quarter;
                    const cVal = curr.year * 10 + curr.quarter;
                    return cVal > pVal ? curr : prev;
                });
                if (max) setFilterPeriod(max.label);
            }
        }
    }, [reports, filterPeriod]);

    // Checkbox filter
    const [shouldFilterTargets, setShouldFilterTargets] = useState(true);

    // Tabs
    const [activeTab, setActiveTab] = useState('rec');

    // === Derived Data ===
    const uniqueTickers = useMemo(() => [...new Set(reports.map(r => r.info_of_report.ticker))].sort(), [reports]);
    const uniqueBrokers = useMemo(() => [...new Set(reports.map(r => r.info_of_report.issued_company))]
        .filter(b => b && b.length < 15) // Filter out messy data (long company names mistakenly in issuer field)
        .sort(), [reports]);
    const uniqueSectors = useMemo(() => [...new Set(reports.map(r => r.info_of_report.sector).filter(s => s && s.trim()))].sort(), [reports]);

    const uniqueQuarters = useMemo(() => {
        const set = new Set(reports.map(r => {
            const q = getQuarterFromDate(r.info_of_report.date_of_issue);
            return q ? q.label : null;
        }).filter(Boolean));
        // Sort descending (Newest first) - parsing the "Qx YYYY" string
        return Array.from(set).sort((a, b) => {
            const [qA, yA] = a.split(' ');
            const [qB, yB] = b.split(' ');
            const valA = parseInt(yA) * 10 + parseInt(qA.replace('Q', ''));
            const valB = parseInt(yB) * 10 + parseInt(qB.replace('Q', ''));
            return valB - valA; // Descending
        });
    }, [reports]);

    const filteredReports = useMemo(() => {
        return reports.filter(r => {
            const mTicker = filterTicker === 'All' || r.info_of_report.ticker === filterTicker;
            const mBroker = filterBroker === 'All' || r.info_of_report.issued_company === filterBroker;
            const mSector = filterSector === 'All' || r.info_of_report.sector === filterSector;
            let mPeriod = true;
            if (filterPeriod !== 'All') {
                const q = getQuarterFromDate(r.info_of_report.date_of_issue);
                mPeriod = q && q.label === filterPeriod;
            }
            // Target Price Filter strict
            let mTarget = true;
            if (shouldFilterTargets) {
                const tp = r.recommendation?.target_price;
                const numericTp = Number(tp);
                mTarget = tp != null && !isNaN(numericTp) && numericTp > 0;
            }

            return mTicker && mBroker && mSector && mPeriod && mTarget;
        });
    }, [reports, filterTicker, filterBroker, filterSector, filterPeriod, shouldFilterTargets]);

    // Separate filtered reports for rankings (Top 10 lists)
    // This excludes the "Has Target Price" checkbox filter to ensure rankings are consistent
    const filteredReportsForRankings = useMemo(() => {
        return reports.filter(r => {
            const mTicker = filterTicker === 'All' || r.info_of_report.ticker === filterTicker;
            const mBroker = filterBroker === 'All' || r.info_of_report.issued_company === filterBroker;
            const mSector = filterSector === 'All' || r.info_of_report.sector === filterSector;
            let mPeriod = true;
            if (filterPeriod !== 'All') {
                const q = getQuarterFromDate(r.info_of_report.date_of_issue);
                mPeriod = q && q.label === filterPeriod;
            }
            // NO target price filter for rankings
            return mTicker && mBroker && mSector && mPeriod;
        });
    }, [reports, filterTicker, filterBroker, filterSector, filterPeriod]);

    const sortedReports = useMemo(() => {
        let sortableItems = [...filteredReports];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;

                // Helper to extract value based on key
                if (sortConfig.key === 'date_of_issue') {
                    aValue = a.info_of_report.date_of_issue;
                    bValue = b.info_of_report.date_of_issue;
                } else if (sortConfig.key === 'ticker') {
                    aValue = a.info_of_report.ticker;
                    bValue = b.info_of_report.ticker;
                } else if (sortConfig.key === 'recommendation') {
                    // Custom Rank: Buy > Neutral > Sell > No Rating
                    const rank = {
                        'Buy': 3, 'Outperform': 3,
                        'Neutral': 2, 'Hold': 2,
                        'Sell': 1, 'Underperform': 1,
                        'No Rating': 0, '-': 0
                    };
                    // Determine display rec first to handle no-target-price logic if needed, 
                    // but better to use raw rec and handle nulls
                    // Re-using logic from display:
                    const getRec = (r) => {
                        const tp = r.recommendation?.target_price;
                        const hasTP = tp != null && tp !== '-' && tp !== 0 && tp !== '0';
                        return hasTP ? (r.recommendation?.recommendation || '-') : 'No Rating';
                    };
                    aValue = rank[getRec(a)] ?? 0;
                    bValue = rank[getRec(b)] ?? 0;
                } else {
                    // Numeric keys in recommendation object
                    aValue = a.recommendation?.[sortConfig.key];
                    bValue = b.recommendation?.[sortConfig.key];

                    // Handle nulls/undefined for numbers - push to bottom?
                    // Let's treat null as -Infinity for desc sort? Or just handled by comparison.
                    if (aValue == null || aValue === '-') aValue = -999999;
                    if (bValue == null || bValue === '-') bValue = -999999;
                }

                ChartJS.register(ArcElement, Tooltip, Legend);

                // Helper for Color Logic
                const getPerfColorClass = (value) => {
                    if (value == null) return 'text-white'; // Default fallback
                    if (value > 0.5) return 'text-[#00ff7f]'; // Green
                    if (value < -0.5) return 'text-[#ff6666]'; // Red
                    return 'text-gray-500'; // Dark Grey / Neutral for -0.5 to 0.5
                };

                // Helper for Company Name
                const getCompanyName = (ticker) => {
                    const map = {
                        'FPT': 'FPT Corporation (HSX: FPT)',
                        // Add others if known, otherwise default
                    };
                    return map[ticker] || ticker;
                };
                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredReports, sortConfig]);

    const handleSort = (key) => {
        let direction = 'desc';
        // For text-heavy columns default to asc? No, usually Date/Upside default Desc. Ticker default Asc.
        // Let's keep logic simple: toggle.
        // If sorting same key, toggle.
        if (sortConfig.key === key) {
            direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // Default direction for new key
            // Ticker -> Asc, Date -> Desc, Numbers -> Desc
            if (key === 'ticker') direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const selectedReport = sortedReports.find(r => r.id === selectedReportId) || sortedReports[0];

    // Stats
    const reportsWithUpside = filteredReports.filter(r => r.recommendation?.upside != null);
    const avgUpside = reportsWithUpside.length > 0
        ? (reportsWithUpside.reduce((acc, curr) => acc + curr.recommendation.upside, 0) / reportsWithUpside.length * 100)
        : 0;

    const topCalls = [...filteredReports]
        .sort((a, b) => (b.recommendation?.upside_at_call ?? -999) - (a.recommendation?.upside_at_call ?? -999))
        .slice(0, 10);

    const chartData = useMemo(() => {
        let buy = 0, hold = 0, sell = 0;
        filteredReports.forEach(r => {
            const t = getCallType(r.recommendation?.recommendation);
            if (t === 'Buy') buy++; else if (t === 'Sell') sell++; else hold++;
        });
        return {
            labels: ['Buy', 'Hold', 'Sell'],
            datasets: [{
                data: [buy, hold, sell],
                backgroundColor: ['#00ff7f', '#aaa', '#ff6666'],
                borderWidth: 0,
                cutout: '70%',
            }]
        };
    }, [filteredReports]);

    // Calculate coverage changes comparing current quarter with previous quarters based on horizon
    const coverageChanges = useMemo(() => {
        if (filterPeriod === 'All') {
            return { newCoverage: [], dropped: [], upgraded: [], downgraded: [], tpIncreased: [], tpDecreased: [] };
        }

        // Determine number of quarters to look back based on horizon
        const quartersToLookBack = coverageHorizon === '3M' ? 1 : coverageHorizon === '6M' ? 2 : 4;

        // Build list of past quarter labels
        const pastQuarterLabels = [];
        let currentLabel = filterPeriod;
        for (let i = 0; i < quartersToLookBack; i++) {
            currentLabel = getPreviousQuarterLabel(currentLabel);
            if (currentLabel) pastQuarterLabels.push(currentLabel);
        }

        if (pastQuarterLabels.length === 0) {
            return { newCoverage: [], dropped: [], upgraded: [], downgraded: [], tpIncreased: [], tpDecreased: [] };
        }

        const prevQuarterLabel = pastQuarterLabels[0]; // Most recent previous quarter for upgrade/downgrade

        // Get reports from current quarter
        // Filter by selected brokers if any are selected
        const brokerFilter = (r) => coverageBrokers.length === 0 || coverageBrokers.includes(r.info_of_report.issued_company);

        // Get reports from current quarter
        const currentQuarterReports = reports.filter(r => {
            const q = getQuarterFromDate(r.info_of_report.date_of_issue);
            return q && q.label === filterPeriod && brokerFilter(r);
        });

        // Get reports from the previous quarter only (for upgrade/downgrade comparison)
        const prevQuarterReports = reports.filter(r => {
            const q = getQuarterFromDate(r.info_of_report.date_of_issue);
            return q && q.label === prevQuarterLabel && brokerFilter(r);
        });


        // Helper function to get latest report for each ticker-broker combination
        const getBrokerLatest = (reports) => {
            const map = {};
            reports.forEach(r => {
                const key = `${r.info_of_report.ticker}_${r.info_of_report.issued_company}`;
                if (!map[key] || r.info_of_report.date_of_issue > map[key].info_of_report.date_of_issue) {
                    map[key] = r;
                }
            });
            return map;
        };


        // Get all reports within the lookback period (NOT including current quarter)
        const lookbackQuarters = [...pastQuarterLabels];
        const periodReports = reports.filter(r => {
            const q = getQuarterFromDate(r.info_of_report.date_of_issue);
            return q && lookbackQuarters.includes(q.label) && brokerFilter(r);
        });

        // Get latest report for each ticker-broker in the lookback period
        const periodLatest = getBrokerLatest(periodReports);
        const periodKeys = new Set(Object.keys(periodLatest));

        // Get latest report for each ticker-broker in current quarter
        const currentLatest = getBrokerLatest(currentQuarterReports);
        const currentKeys = new Set(Object.keys(currentLatest));

        // New coverage: in current quarter but NOT in the lookback period
        const newCoverage = [...currentKeys].filter(k => !periodKeys.has(k)).map(k => {
            const r = currentLatest[k];
            return {
                ticker: r.info_of_report.ticker,
                broker: r.info_of_report.issued_company,
                date: r.info_of_report.date_of_issue,
                upside: r.recommendation?.upside || 0
            };
        });

        // Dropped: in the lookback period but NOT in current quarter
        const dropped = [...periodKeys].filter(k => !currentKeys.has(k)).map(k => {
            const r = periodLatest[k];
            return {
                ticker: r.info_of_report.ticker,
                broker: r.info_of_report.issued_company,
                date: r.info_of_report.date_of_issue,
                upside: r.recommendation?.upside || 0
            };
        });

        // For those in both, compare recommendations and target prices
        const upgraded = [];
        const downgraded = [];

        const recRank = (rec) => {
            const type = getCallType(rec);
            if (type === 'Buy') return 3;
            if (type === 'Hold') return 2;
            if (type === 'Sell') return 1;
            return 0;
        };

        [...currentKeys].filter(k => periodKeys.has(k)).forEach(k => {
            const curr = currentLatest[k];
            const period = periodLatest[k];

            const currRec = curr.recommendation?.recommendation;
            const periodRec = period.recommendation?.recommendation;
            const currRank = recRank(currRec);
            const periodRank = recRank(periodRec);

            // Check for rating changes
            const hasRatingUpgrade = currRank > periodRank && currRank > 0 && periodRank > 0;
            const hasRatingDowngrade = currRank < periodRank && currRank > 0 && periodRank > 0;

            // Check for target price changes
            const currTP = curr.recommendation?.target_price;
            const periodTP = period.recommendation?.target_price;
            const hasTpChange = currTP && periodTP && currTP !== periodTP;
            const tpChange = hasTpChange ? ((currTP - periodTP) / periodTP * 100).toFixed(1) : null;

            // Merge rating upgrades and TP increases into "upgraded"
            if (hasRatingUpgrade || (hasTpChange && currTP > periodTP)) {
                upgraded.push({
                    ticker: curr.info_of_report.ticker,
                    broker: curr.info_of_report.issued_company,
                    date: curr.info_of_report.date_of_issue,
                    upside: curr.recommendation?.upside || 0,
                    type: hasRatingUpgrade ? 'rating' : 'tp',
                    from: hasRatingUpgrade ? periodRec : null,
                    to: hasRatingUpgrade ? currRec : null,
                    change: hasTpChange && currTP > periodTP ? `+${tpChange}%` : null
                });
            }

            // Merge rating downgrades and TP decreases into "downgraded"
            if (hasRatingDowngrade || (hasTpChange && currTP < periodTP)) {
                downgraded.push({
                    ticker: curr.info_of_report.ticker,
                    broker: curr.info_of_report.issued_company,
                    date: curr.info_of_report.date_of_issue,
                    upside: curr.recommendation?.upside || 0,
                    type: hasRatingDowngrade ? 'rating' : 'tp',
                    from: hasRatingDowngrade ? periodRec : null,
                    to: hasRatingDowngrade ? currRec : null,
                    change: hasTpChange && currTP < periodTP ? `${tpChange}%` : null
                });
            }
        });

        console.log('Coverage changes:', {
            filterPeriod,
            horizon: coverageHorizon,
            prevQuarter: prevQuarterLabel,
            currentReports: currentQuarterReports.length,
            pastHorizonReports: periodReports.length,
            newCoverage: newCoverage.length,
            dropped: dropped.length,
            upgraded: upgraded.length,
            downgraded: downgraded.length
        });

        return { newCoverage, dropped, upgraded, downgraded };
    }, [reports, filterPeriod, coverageHorizon, coverageBrokers]);

    // Helper to get Risks safely (checking multiple possible keys or array format)
    const getRisks = (report) => {
        if (report.risk_assessment) return report.risk_assessment;
        if (report.risks) return report.risks;
        if (report.risk) return report.risk;
        // Sometimes it might be in thesis? but current JSON seems to separate them or not have it.
        return null;
    };



    return (
        <>
            <Header title="Company Research Panel">
                <CustomSelect
                    options={uniqueTickers} value={filterTicker} onChange={setFilterTicker} placeholder="All Tickers"
                />
                <CustomSelect
                    options={uniqueBrokers} value={filterBroker} onChange={setFilterBroker} placeholder="All brokers"
                />
                <CustomSelect
                    options={uniqueSectors} value={filterSector} onChange={setFilterSector} placeholder="All sectors"
                />
                <CustomSelect
                    options={uniqueQuarters} value={filterPeriod} onChange={setFilterPeriod} placeholder="All Periods"
                />
            </Header>

            <main className="dashboard-grid">
                {/* COLUMN 1 */}
                <section className="column">
                    <div className="card">

                        <div className="section-block">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3 className="section-title" style={{ margin: 0 }}>Top 10 stocks</h3>
                                <div style={{
                                    backgroundColor: '#2C2C2E',
                                    borderRadius: '10px',
                                    padding: '3px',
                                    display: 'inline-flex',
                                    gap: '0',
                                    border: '1px solid #3A3A3C'
                                }}>
                                    <button
                                        onClick={() => setRankingMode('buy')}
                                        style={{
                                            backgroundColor: rankingMode === 'buy' ? '#00ff7f' : 'transparent',
                                            color: rankingMode === 'buy' ? 'black' : 'white',
                                            padding: '4px 12px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            outline: 'none',
                                            fontSize: '10px',
                                            fontWeight: '400',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        Top Buy
                                    </button>
                                    <button
                                        onClick={() => setRankingMode('sell')}
                                        style={{
                                            backgroundColor: rankingMode === 'sell' ? '#ff6666' : 'transparent',
                                            color: 'white',
                                            padding: '4px 12px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            outline: 'none',
                                            fontSize: '10px',
                                            fontWeight: '400',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        Top Sell
                                    </button>
                                    <button
                                        onClick={() => setRankingMode('coverage')}
                                        style={{
                                            backgroundColor: rankingMode === 'coverage' ? '#666' : 'transparent',
                                            color: 'white',
                                            padding: '4px 12px',
                                            borderRadius: '8px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            outline: 'none',
                                            fontSize: '10px',
                                            fontWeight: '400',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        Top Coverage
                                    </button>
                                </div>
                            </div>
                            <div className="table-wrapper">
                                <table className="mini-table">
                                    <thead>
                                        <tr>
                                            <th>Ticker</th>
                                            <th>Target price</th>
                                            <th>Recommendation</th>
                                            <th>Avg. Upside</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            // === USE filteredReportsForRankings for Top 10 ===
                                            // This ensures rankings use all filters EXCEPT "Has Target Price" checkbox

                                            // Aggregate by ticker - calculate average upside and target price
                                            const reportsWithUpside = filteredReportsForRankings.filter(r =>
                                                r.recommendation?.upside_at_call != null &&
                                                r.recommendation?.target_price != null
                                            );

                                            // Group by ticker
                                            const tickerMap = {};
                                            reportsWithUpside.forEach(r => {
                                                const ticker = r.info_of_report.ticker;
                                                const broker = r.info_of_report.issued_company || 'Unknown';
                                                if (!tickerMap[ticker]) {
                                                    tickerMap[ticker] = {
                                                        ticker,
                                                        reports: [],
                                                        brokers: new Set(),
                                                        totalUpside: 0,
                                                        totalTargetPrice: 0,
                                                        count: 0,
                                                        latestReport: r // Keep track for click handling
                                                    };
                                                }
                                                tickerMap[ticker].reports.push(r);
                                                tickerMap[ticker].brokers.add(broker);
                                                tickerMap[ticker].totalUpside += r.recommendation.upside_at_call;
                                                tickerMap[ticker].totalTargetPrice += r.recommendation.target_price;
                                                tickerMap[ticker].count++;
                                                // Update latestReport if this one is more recent
                                                if (r.info_of_report.date_of_issue > tickerMap[ticker].latestReport.info_of_report.date_of_issue) {
                                                    tickerMap[ticker].latestReport = r;
                                                }
                                            });

                                            // Calculate averages and broker count
                                            const tickerData = Object.values(tickerMap).map(t => ({
                                                ...t,
                                                avgUpside: t.totalUpside / t.count,
                                                avgTargetPrice: Math.round(t.totalTargetPrice / t.count),
                                                brokerCount: t.brokers.size
                                            }));

                                            // Filter and sort based on ranking mode
                                            // Apply minimum recommendations filter
                                            let rankedTickers;
                                            if (rankingMode === 'buy') {
                                                rankedTickers = tickerData
                                                    .filter(t => t.avgUpside > 0 && t.count >= minRecommendations)
                                                    .sort((a, b) => b.avgUpside - a.avgUpside)
                                                    .slice(0, 10);
                                            } else if (rankingMode === 'sell') {
                                                rankedTickers = tickerData
                                                    .filter(t => t.avgUpside < 0 && t.count >= minRecommendations)
                                                    .sort((a, b) => a.avgUpside - b.avgUpside)
                                                    .slice(0, 10);
                                            } else {
                                                // Coverage mode - sort by number of unique brokers
                                                rankedTickers = tickerData
                                                    .sort((a, b) => b.brokerCount - a.brokerCount)
                                                    .slice(0, 10);
                                            }

                                            return rankedTickers.map((t) => {
                                                const summary = getTickerCallsSummary(t.ticker, filteredReportsForRankings);
                                                const isPositive = t.avgUpside >= 0;
                                                return (
                                                    <tr key={t.ticker} onClick={() => setSelectedReportId(t.latestReport.id)}>
                                                        <td>{t.ticker}</td>
                                                        <td>{t.avgTargetPrice?.toLocaleString() || '-'}</td>
                                                        <td>{summary.element}</td>
                                                        <td className={isPositive ? 'text-green' : 'text-red'}>
                                                            {(isPositive ? '+' : '') + safeToFixed(t.avgUpside, 1) + '%'}
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="section-block">
                            {/* Row 1: Title + Time Horizon */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                <h3 className="section-title" style={{ margin: 0 }}>Broker coverage</h3>
                                <div style={{
                                    backgroundColor: '#2C2C2E',
                                    borderRadius: '8px',
                                    padding: '2px',
                                    display: 'inline-flex',
                                    gap: '0',
                                    border: '1px solid #3A3A3C'
                                }}>
                                    {['3M', '6M', '1Y'].map(h => (
                                        <button
                                            key={h}
                                            onClick={() => setCoverageHorizon(h)}
                                            style={{
                                                backgroundColor: coverageHorizon === h ? '#666' : 'transparent',
                                                color: 'white',
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                outline: 'none',
                                                fontSize: '9px',
                                                fontWeight: '400'
                                            }}
                                        >
                                            {h}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Row 2: Broker Filter */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '9px', color: '#666' }}>Brokers:</span>
                                {coverageBrokers.length === 0 ? (
                                    <span style={{ fontSize: '9px', color: '#999' }}>All</span>
                                ) : (
                                    coverageBrokers.map(b => (
                                        <span
                                            key={b}
                                            onClick={() => setCoverageBrokers(coverageBrokers.filter(x => x !== b))}
                                            style={{
                                                backgroundColor: '#3A3A3C',
                                                color: 'white',
                                                padding: '2px 8px',
                                                borderRadius: '10px',
                                                fontSize: '9px',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {b} ×
                                        </span>
                                    ))
                                )}
                                <select
                                    value=""
                                    onChange={(e) => {
                                        const broker = e.target.value;
                                        if (broker && !coverageBrokers.includes(broker)) {
                                            setCoverageBrokers([...coverageBrokers, broker]);
                                        }
                                    }}
                                    style={{
                                        backgroundColor: 'transparent',
                                        color: '#00ff7f',
                                        border: 'none',
                                        fontSize: '9px',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        appearance: 'none',
                                        WebkitAppearance: 'none',
                                        padding: '0'
                                    }}
                                >
                                    <option value="" style={{ backgroundColor: '#1a1a1a' }}>+ Add</option>
                                    {uniqueBrokers.filter(b => !coverageBrokers.includes(b)).map(b => (
                                        <option key={b} value={b} style={{ backgroundColor: '#1a1a1a' }}>{b}</option>
                                    ))}
                                </select>
                                {coverageBrokers.length > 0 && (
                                    <span
                                        onClick={() => setCoverageBrokers([])}
                                        style={{ fontSize: '9px', color: '#ff6666', cursor: 'pointer' }}
                                    >
                                        Reset
                                    </span>
                                )}
                            </div>
                            <div className="table-wrapper" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                <table className="mini-table">
                                    <thead><tr><th>Type</th><th>Details</th><th>Δ</th></tr></thead>
                                    <tbody>
                                        {/* New Coverage */}
                                        {coverageChanges.newCoverage.length > 0 && (
                                            <tr>
                                                <td>New</td>
                                                <td
                                                    style={{ fontSize: '9px', cursor: 'pointer' }}
                                                    onMouseEnter={(e) => handleMouseEnter(e, 'new')}
                                                    onMouseLeave={() => setHoveredCoverageRow(null)}
                                                >
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {[...new Set(coverageChanges.newCoverage.map(c => c.ticker))].slice(0, 4).map((ticker, i) => (
                                                            <span key={i} style={{ padding: '2px 6px', backgroundColor: '#2a3a2a', borderRadius: '4px', fontSize: '8px' }}>{ticker}</span>
                                                        ))}
                                                        {[...new Set(coverageChanges.newCoverage.map(c => c.ticker))].length > 4 &&
                                                            <span style={{ padding: '2px 6px', backgroundColor: '#333', borderRadius: '4px', fontSize: '8px', color: '#888' }}>+{[...new Set(coverageChanges.newCoverage.map(c => c.ticker))].length - 4}</span>}
                                                    </div>
                                                    {hoveredCoverageRow === 'new' && (
                                                        <div style={{
                                                            position: 'fixed',
                                                            left: tooltipPos.x + 15,
                                                            top: tooltipPos.align === 'bottom' ? tooltipPos.y + 15 : 'auto',
                                                            bottom: tooltipPos.align === 'top' ? (window.innerHeight - tooltipPos.y + 15) : 'auto',
                                                            zIndex: 9999,
                                                            backgroundColor: '#0a0a0a',
                                                            border: '2px solid #555',
                                                            borderRadius: '8px',
                                                            padding: '14px',
                                                            minWidth: '250px',
                                                            maxWidth: '450px',
                                                            maxHeight: '300px',
                                                            overflowY: 'auto',
                                                            boxShadow: '0 8px 32px rgba(0,0,0,0.9)'
                                                        }}>
                                                            <div style={{ fontSize: '11px', color: '#fff', marginBottom: '12px', fontWeight: 'bold', textAlign: 'left' }}>New Coverage ({coverageChanges.newCoverage.length})</div>
                                                            {Object.entries(coverageChanges.newCoverage.reduce((acc, c) => {
                                                                acc[c.broker] = acc[c.broker] || [];
                                                                acc[c.broker].push(c);
                                                                return acc;
                                                            }, {})).map(([broker, items], i) => (
                                                                <div key={i} style={{ marginBottom: '12px', textAlign: 'left' }}>
                                                                    <div style={{ fontSize: '10px', color: '#00ff7f', fontWeight: 'bold', marginBottom: '6px' }}>{broker}</div>
                                                                    {items.sort((a, b) => new Date(b.date) - new Date(a.date)).map((item, j) => {
                                                                        return (
                                                                            <div key={j} style={{
                                                                                fontSize: '9px',
                                                                                color: '#ddd',
                                                                                paddingLeft: '8px',
                                                                                marginBottom: '3px',
                                                                                display: 'flex',
                                                                                gap: '4px'
                                                                            }}>
                                                                                <span style={{ minWidth: '35px' }}>{item.ticker}</span>
                                                                                <span style={{ color: '#666' }}>|</span>
                                                                                <span style={{ minWidth: '80px' }}>Upside: {item.upside > 0 ? '+' : ''}{item.upside.toFixed(1)}%</span>
                                                                                <span style={{ color: '#666' }}>|</span>
                                                                                <span>{formatDate(item.date)}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-green">+{[...new Set(coverageChanges.newCoverage.map(c => c.ticker))].length}</td>
                                            </tr>
                                        )}
                                        {/* Dropped */}
                                        {coverageChanges.dropped.length > 0 && (
                                            <tr>
                                                <td>Dropped</td>
                                                <td
                                                    style={{ fontSize: '9px', cursor: 'pointer' }}
                                                    onMouseEnter={(e) => handleMouseEnter(e, 'dropped')}
                                                    onMouseLeave={() => setHoveredCoverageRow(null)}
                                                >
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {[...new Set(coverageChanges.dropped.map(c => c.ticker))].slice(0, 4).map((ticker, i) => (
                                                            <span key={i} style={{ padding: '2px 6px', backgroundColor: '#3a2a2a', borderRadius: '4px', fontSize: '8px' }}>{ticker}</span>
                                                        ))}
                                                        {[...new Set(coverageChanges.dropped.map(c => c.ticker))].length > 4 &&
                                                            <span style={{ padding: '2px 6px', backgroundColor: '#333', borderRadius: '4px', fontSize: '8px', color: '#888' }}>+{[...new Set(coverageChanges.dropped.map(c => c.ticker))].length - 4}</span>}
                                                    </div>
                                                    {hoveredCoverageRow === 'dropped' && (
                                                        <div style={{
                                                            position: 'fixed',
                                                            left: tooltipPos.x + 15,
                                                            top: tooltipPos.align === 'bottom' ? tooltipPos.y + 15 : 'auto',
                                                            bottom: tooltipPos.align === 'top' ? (window.innerHeight - tooltipPos.y + 15) : 'auto',
                                                            zIndex: 9999,
                                                            backgroundColor: '#0a0a0a',
                                                            border: '2px solid #555',
                                                            borderRadius: '8px',
                                                            padding: '14px',
                                                            minWidth: '250px',
                                                            maxWidth: '450px',
                                                            maxHeight: '300px',
                                                            overflowY: 'auto',
                                                            boxShadow: '0 8px 32px rgba(0,0,0,0.9)'
                                                        }}>
                                                            <div style={{ fontSize: '11px', color: '#fff', marginBottom: '12px', fontWeight: 'bold', textAlign: 'left' }}>Dropped Coverage ({coverageChanges.dropped.length})</div>
                                                            {Object.entries(coverageChanges.dropped.reduce((acc, c) => {
                                                                acc[c.broker] = acc[c.broker] || [];
                                                                acc[c.broker].push(c);
                                                                return acc;
                                                            }, {})).map(([broker, items], i) => (
                                                                <div key={i} style={{ marginBottom: '12px', textAlign: 'left' }}>
                                                                    <div style={{ fontSize: '10px', color: '#ff6666', fontWeight: 'bold', marginBottom: '6px' }}>{broker}</div>
                                                                    {items.sort((a, b) => new Date(b.date) - new Date(a.date)).map((item, j) => {
                                                                        return (
                                                                            <div key={j} style={{
                                                                                fontSize: '9px',
                                                                                color: '#ddd',
                                                                                paddingLeft: '8px',
                                                                                marginBottom: '3px',
                                                                                display: 'flex',
                                                                                gap: '4px'
                                                                            }}>
                                                                                <span style={{ minWidth: '35px' }}>{item.ticker}</span>
                                                                                <span style={{ color: '#666' }}>|</span>
                                                                                <span style={{ minWidth: '80px' }}>Upside: {item.upside > 0 ? '+' : ''}{item.upside.toFixed(1)}%</span>
                                                                                <span style={{ color: '#666' }}>|</span>
                                                                                <span>{formatDate(item.date)}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-red">-{[...new Set(coverageChanges.dropped.map(c => c.ticker))].length}</td>
                                            </tr>
                                        )}
                                        {/* Upgraded */}
                                        {coverageChanges.upgraded.length > 0 && (
                                            <tr>
                                                <td>Upgraded</td>
                                                <td
                                                    style={{ fontSize: '9px', cursor: 'pointer' }}
                                                    onMouseEnter={(e) => handleMouseEnter(e, 'upgraded')}
                                                    onMouseLeave={() => setHoveredCoverageRow(null)}
                                                >
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {coverageChanges.upgraded.slice(0, 4).map((c, i) => (
                                                            <span key={i} style={{ padding: '2px 6px', backgroundColor: '#2a3a2a', borderRadius: '4px', fontSize: '8px' }}>{c.ticker}</span>
                                                        ))}
                                                        {coverageChanges.upgraded.length > 4 &&
                                                            <span style={{ padding: '2px 6px', backgroundColor: '#333', borderRadius: '4px', fontSize: '8px', color: '#888' }}>+{coverageChanges.upgraded.length - 4}</span>}
                                                    </div>
                                                    {hoveredCoverageRow === 'upgraded' && (
                                                        <div style={{
                                                            position: 'fixed',
                                                            left: tooltipPos.x + 15,
                                                            top: tooltipPos.align === 'bottom' ? tooltipPos.y + 15 : 'auto',
                                                            bottom: tooltipPos.align === 'top' ? (window.innerHeight - tooltipPos.y + 15) : 'auto',
                                                            zIndex: 9999,
                                                            backgroundColor: '#0a0a0a',
                                                            border: '2px solid #555',
                                                            borderRadius: '8px',
                                                            padding: '14px',
                                                            minWidth: '300px',
                                                            maxWidth: '450px',
                                                            maxHeight: '300px',
                                                            overflowY: 'auto',
                                                            boxShadow: '0 8px 32px rgba(0,0,0,0.9)'
                                                        }}>
                                                            <div style={{ fontSize: '11px', color: '#fff', marginBottom: '12px', fontWeight: 'bold', textAlign: 'left' }}>Upgraded ({coverageChanges.upgraded.length})</div>
                                                            {Object.entries(coverageChanges.upgraded.reduce((acc, c) => {
                                                                acc[c.broker] = acc[c.broker] || [];
                                                                acc[c.broker].push(c);
                                                                return acc;
                                                            }, {})).map(([broker, items], i) => (
                                                                <div key={i} style={{ marginBottom: '12px', textAlign: 'left' }}>
                                                                    <div style={{ fontSize: '10px', color: '#00ff7f', fontWeight: 'bold', marginBottom: '6px' }}>{broker}</div>
                                                                    {items.sort((a, b) => new Date(b.date) - new Date(a.date)).map((item, j) => {
                                                                        const detail = item.type === 'rating' ? `${item.from?.split(' ')[0]}→${item.to?.split(' ')[0]}` : item.change;
                                                                        return (
                                                                            <div key={j} style={{
                                                                                fontSize: '9px',
                                                                                color: '#ddd',
                                                                                paddingLeft: '8px',
                                                                                marginBottom: '3px',
                                                                                display: 'flex',
                                                                                gap: '4px'
                                                                            }}>
                                                                                <span style={{ minWidth: '35px' }}>{item.ticker}</span>
                                                                                <span style={{ minWidth: '80px' }}>{detail ? `(${detail})` : ''}</span>
                                                                                <span style={{ color: '#666' }}>|</span>
                                                                                <span style={{ minWidth: '80px' }}>Upside: {item.upside > 0 ? '+' : ''}{item.upside.toFixed(1)}%</span>
                                                                                <span style={{ color: '#666' }}>|</span>
                                                                                <span>{formatDate(item.date)}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-green">+{coverageChanges.upgraded.length}</td>
                                            </tr>
                                        )}
                                        {/* Downgraded */}
                                        {coverageChanges.downgraded.length > 0 && (
                                            <tr>
                                                <td>Downgraded</td>
                                                <td
                                                    style={{ fontSize: '9px', cursor: 'pointer' }}
                                                    onMouseEnter={(e) => handleMouseEnter(e, 'downgraded')}
                                                    onMouseLeave={() => setHoveredCoverageRow(null)}
                                                >
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                        {coverageChanges.downgraded.slice(0, 4).map((c, i) => (
                                                            <span key={i} style={{ padding: '2px 6px', backgroundColor: '#3a2a2a', borderRadius: '4px', fontSize: '8px' }}>{c.ticker}</span>
                                                        ))}
                                                        {coverageChanges.downgraded.length > 4 &&
                                                            <span style={{ padding: '2px 6px', backgroundColor: '#333', borderRadius: '4px', fontSize: '8px', color: '#888' }}>+{coverageChanges.downgraded.length - 4}</span>}
                                                    </div>
                                                    {hoveredCoverageRow === 'downgraded' && (
                                                        <div style={{
                                                            position: 'fixed',
                                                            left: tooltipPos.x + 15,
                                                            top: tooltipPos.align === 'bottom' ? tooltipPos.y + 15 : 'auto',
                                                            bottom: tooltipPos.align === 'top' ? (window.innerHeight - tooltipPos.y + 15) : 'auto',
                                                            zIndex: 9999,
                                                            backgroundColor: '#0a0a0a',
                                                            border: '2px solid #555',
                                                            borderRadius: '8px',
                                                            padding: '14px',
                                                            minWidth: '300px',
                                                            maxWidth: '450px',
                                                            maxHeight: '300px',
                                                            overflowY: 'auto',
                                                            boxShadow: '0 8px 32px rgba(0,0,0,0.9)'
                                                        }}>
                                                            <div style={{ fontSize: '11px', color: '#fff', marginBottom: '12px', fontWeight: 'bold', textAlign: 'left' }}>Downgraded ({coverageChanges.downgraded.length})</div>
                                                            {Object.entries(coverageChanges.downgraded.reduce((acc, c) => {
                                                                acc[c.broker] = acc[c.broker] || [];
                                                                acc[c.broker].push(c);
                                                                return acc;
                                                            }, {})).map(([broker, items], i) => (
                                                                <div key={i} style={{ marginBottom: '12px', textAlign: 'left' }}>
                                                                    <div style={{ fontSize: '10px', color: '#ff6666', fontWeight: 'bold', marginBottom: '6px' }}>{broker}</div>
                                                                    {items.sort((a, b) => new Date(b.date) - new Date(a.date)).map((item, j) => {
                                                                        const detail = item.type === 'rating' ? `${item.from?.split(' ')[0]}→${item.to?.split(' ')[0]}` : item.change;
                                                                        return (
                                                                            <div key={j} style={{
                                                                                fontSize: '9px',
                                                                                color: '#ddd',
                                                                                paddingLeft: '8px',
                                                                                marginBottom: '3px',
                                                                                display: 'flex',
                                                                                gap: '4px'
                                                                            }}>
                                                                                <span style={{ minWidth: '35px' }}>{item.ticker}</span>
                                                                                <span style={{ minWidth: '80px' }}>{detail ? `(${detail})` : ''}</span>
                                                                                <span style={{ color: '#666' }}>|</span>
                                                                                <span style={{ minWidth: '80px' }}>Upside: {item.upside > 0 ? '+' : ''}{item.upside.toFixed(1)}%</span>
                                                                                <span style={{ color: '#666' }}>|</span>
                                                                                <span>{formatDate(item.date)}</span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="text-red">-{coverageChanges.downgraded.length}</td>
                                            </tr>
                                        )}


                                        {/* No changes */}
                                        {coverageChanges.newCoverage.length === 0 &&
                                            coverageChanges.dropped.length === 0 &&
                                            coverageChanges.upgraded.length === 0 &&
                                            coverageChanges.downgraded.length === 0 && (
                                                <tr><td colSpan="3" style={{ textAlign: 'center', color: '#666' }}>No changes from previous quarter</td></tr>
                                            )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </section>

                {/* COLUMN 2 */}
                <section className="column">
                    <div className="card">
                        <div className="mb-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                            <h2 className="card-title mb-0" style={{ fontSize: '12px', display: 'inline-block', verticalAlign: 'middle' }}>Company reports</h2>
                            <label className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity" style={{ display: 'flex', alignItems: 'center' }}>
                                <input
                                    type="checkbox"
                                    checked={shouldFilterTargets}
                                    onChange={(e) => setShouldFilterTargets(e.target.checked)}
                                    // Native checkbox for debugging state
                                    style={{ width: '16px', height: '16px', accentColor: '#666' }}
                                />
                                <span className="text-[#666] text-xs font-medium" style={{ lineHeight: '16px' }}>Has Target Price</span>
                            </label>
                        </div>
                        <div className="table-wrapper overflow-y-auto relative custom-scrollbar" style={{ maxHeight: '485px' }}>
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th style={{ position: 'sticky', left: 0, top: 0, zIndex: 50, backgroundColor: '#141414', textAlign: 'left' }} className="shadow-sm cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('date_of_issue')}>
                                            Date {sortConfig.key === 'date_of_issue' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th style={{ position: 'sticky', top: 0, zIndex: 50, backgroundColor: '#141414', textAlign: 'left' }} className="shadow-sm cursor-pointer hover:text-white transition-colors" onClick={() => handleSort('ticker')}>
                                            Ticker {sortConfig.key === 'ticker' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="sticky-col-header shadow-sm cursor-pointer hover:text-white transition-colors" style={{ textAlign: 'left' }} onClick={() => handleSort('broker')}>
                                            Broker {sortConfig.key === 'broker' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="sticky-col-header shadow-sm cursor-pointer hover:text-white transition-colors" style={{ textAlign: 'left', width: '1%', whiteSpace: 'nowrap' }} onClick={() => handleSort('recommendation')}>
                                            Recommendation {sortConfig.key === 'recommendation' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="sticky-col-header shadow-sm cursor-pointer hover:text-white transition-colors" style={{ textAlign: 'right' }} onClick={() => handleSort('target_price')}>
                                            Target price {sortConfig.key === 'target_price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        {/* Price (Call) removed as requested */}
                                        <th className="sticky-col-header shadow-sm cursor-pointer hover:text-white transition-colors" style={{ textAlign: 'right' }} onClick={() => handleSort('price_now')}>
                                            Current Price {sortConfig.key === 'price_now' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="sticky-col-header shadow-sm cursor-pointer hover:text-white transition-colors" style={{ textAlign: 'right' }} onClick={() => handleSort('upside_at_call')}>
                                            Upside (Call) {sortConfig.key === 'upside_at_call' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="sticky-col-header shadow-sm cursor-pointer hover:text-white transition-colors" style={{ textAlign: 'right' }} onClick={() => handleSort('upside_now')}>
                                            Upside (Now) {sortConfig.key === 'upside_now' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="sticky-col-header shadow-sm cursor-pointer hover:text-white transition-colors" style={{ textAlign: 'right' }} onClick={() => handleSort('target_price_change')}>
                                            TP Change {sortConfig.key === 'target_price_change' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="sticky-col-header shadow-sm cursor-pointer hover:text-white transition-colors" style={{ textAlign: 'right' }} onClick={() => handleSort('performance_since_call')}>
                                            Since Call {sortConfig.key === 'performance_since_call' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="sticky-col-header shadow-sm cursor-pointer hover:text-white transition-colors" style={{ textAlign: 'right' }} onClick={() => handleSort('return_1m')}>
                                            1M {sortConfig.key === 'return_1m' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="sticky-col-header shadow-sm cursor-pointer hover:text-white transition-colors" style={{ textAlign: 'right' }} onClick={() => handleSort('return_3m')}>
                                            3M {sortConfig.key === 'return_3m' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="sticky-col-header shadow-sm cursor-pointer hover:text-white transition-colors" style={{ textAlign: 'right' }} onClick={() => handleSort('return_6m')}>
                                            6M {sortConfig.key === 'return_6m' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                        <th className="sticky-col-header shadow-sm cursor-pointer hover:text-white transition-colors" style={{ textAlign: 'right' }} onClick={() => handleSort('return_1y')}>
                                            1Y {sortConfig.key === 'return_1y' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody style={{ fontSize: '10px' }}>
                                    {sortedReports.map(r => {
                                        // key logic change: if no target price, treat as No Rating
                                        const tp = r.recommendation?.target_price;
                                        const hasTP = tp != null && tp !== '-' && tp !== 0 && tp !== '0';
                                        const displayRec = hasTP ? (r.recommendation?.recommendation || '-') : 'No Rating';

                                        // Get pill styling
                                        const recStyle = getRecommendationStyle(displayRec);

                                        // Fallback logic for returns
                                        const perfCall = r.recommendation?.performance_since_call;
                                        const val1m = r.recommendation?.return_1m != null ? r.recommendation.return_1m : perfCall;
                                        const val3m = r.recommendation?.return_3m != null ? r.recommendation.return_3m : perfCall;
                                        const val6m = r.recommendation?.return_6m != null ? r.recommendation.return_6m : perfCall;
                                        const val1y = r.recommendation?.return_1y != null ? r.recommendation.return_1y : perfCall;

                                        return (
                                            <tr key={r.id} className={`${selectedReportId === r.id ? 'selected' : ''} group`} onClick={() => setSelectedReportId(r.id)}>
                                                <td style={{ position: 'sticky', left: 0, zIndex: 40, backgroundColor: '#1e1e1e', textAlign: 'left' }}>{formatDate(r.info_of_report.date_of_issue)}</td>
                                                <td style={{ textAlign: 'left' }}>{r.info_of_report.ticker}</td>
                                                <td style={{ textAlign: 'left' }}>{r.info_of_report.issued_company ? `${r.info_of_report.issued_company} Research` : '-'}</td>
                                                <td style={{ textAlign: 'left' }}>
                                                    <span style={{
                                                        ...recStyle,
                                                        padding: '3px 10px',
                                                        borderRadius: '9999px',
                                                        fontWeight: 'bold',
                                                        fontSize: '10px',
                                                        display: 'inline-block'
                                                    }}>
                                                        {displayRec}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }} className="text-gray-300">
                                                    {r.recommendation?.target_price?.toLocaleString() || '-'}
                                                </td>
                                                {/* Price (Call) Removed */}
                                                <td style={{ textAlign: 'right' }} className="text-blue-400 font-medium">{r.recommendation?.price_now?.toLocaleString() || '-'}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {r.recommendation?.upside_at_call != null
                                                        ? safeToFixed(r.recommendation.upside_at_call, 1) + '%'
                                                        : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {r.recommendation?.upside_now != null
                                                        ? r.recommendation.upside_now.toFixed(1) + '%'
                                                        : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {r.recommendation?.target_price_change != null
                                                        ? r.recommendation.target_price_change.toFixed(1) + '%'
                                                        : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right' }} className={`${perfCall > 0 ? 'text-green-400' : perfCall < 0 ? 'text-red-400' : ''}`}>
                                                    {perfCall != null
                                                        ? perfCall.toFixed(1) + '%'
                                                        : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right' }} className={`font-semibold ${getPerfColorClass(val1m)}`}>
                                                    {val1m != null ? val1m.toFixed(1) + '%' : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right' }} className={`font-semibold ${getPerfColorClass(val3m)}`}>
                                                    {val3m != null ? val3m.toFixed(1) + '%' : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right' }} className={`font-semibold ${getPerfColorClass(val6m)}`}>
                                                    {val6m != null ? val6m.toFixed(1) + '%' : '-'}
                                                </td>
                                                <td style={{ textAlign: 'right' }} className={`font-semibold ${getPerfColorClass(val1y)}`}>
                                                    {val1y != null ? val1y.toFixed(1) + '%' : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section >

                {/* COLUMN 3 */}
                <section className="column">
                    <div className="card">
                        {selectedReport && selectedReport.info_of_report && selectedReport.recommendation ? (
                            <ReportDetailErrorBoundary key={selectedReport.id} reportData={selectedReport}>
                                <>
                                    <h2 className="card-title text-xl" style={{ marginBottom: '12px' }}>
                                        {selectedReport.info_of_report.stock_name || selectedReport.info_of_report.covered_stock || selectedReport.info_of_report.ticker}
                                        {selectedReport.info_of_report.exchange && ` (${selectedReport.info_of_report.exchange}: ${selectedReport.info_of_report.ticker})`}
                                    </h2>
                                    <div className="text-sm text-gray-400" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '5px', marginBottom: '12px' }}>
                                        {(() => {
                                            const tp = selectedReport.recommendation?.target_price;
                                            const hasTP = tp != null && tp !== '-' && tp !== 0 && tp !== '0';
                                            const displayRec = hasTP ? (selectedReport.recommendation?.recommendation || '-') : 'No Rating';
                                            const recStyle = getRecommendationStyle(displayRec);
                                            const upside = selectedReport.recommendation?.upside_at_call;
                                            const upsideStr = upside != null ? `(${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%)` : '';

                                            return (
                                                <>
                                                    {selectedReport.info_of_report.sector && (
                                                        <>
                                                            <span className="text-gray-400">{selectedReport.info_of_report.sector}</span>
                                                            <span className="text-gray-600">|</span>
                                                        </>
                                                    )}
                                                    <span style={{
                                                        ...recStyle,
                                                        padding: '3px 10px',
                                                        borderRadius: '9999px',
                                                        fontWeight: 'bold',
                                                        fontSize: '10px',
                                                        display: 'inline-block'
                                                    }}>
                                                        {displayRec}
                                                    </span>
                                                    <span className="text-white" style={{ fontWeight: 500 }}>
                                                        {tp?.toLocaleString() || '-'} {upsideStr}
                                                    </span>
                                                </>
                                            );
                                        })()}
                                    </div>

                                    <div style={{
                                        backgroundColor: '#2C2C2E',
                                        borderRadius: '10px',
                                        padding: '4px',
                                        display: 'flex',
                                        gap: '0',
                                        border: '1px solid #3A3A3C',
                                        marginBottom: '12px',
                                        overflowX: 'auto',
                                        maxWidth: '100%'
                                    }} className="hidden-scrollbar">
                                        <button
                                            onClick={() => setActiveTab('rec')}
                                            className="transition-all"
                                            style={{
                                                backgroundColor: activeTab === 'rec' ? '#00ff7f' : 'transparent',
                                                color: activeTab === 'rec' ? 'black' : 'white',
                                                padding: '6px 16px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                outline: 'none',
                                                fontSize: '10px',
                                                fontWeight: '400',
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0
                                            }}
                                        >
                                            Recommendation
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('inv')}
                                            className="transition-all"
                                            style={{
                                                backgroundColor: activeTab === 'inv' ? '#00ff7f' : 'transparent',
                                                color: activeTab === 'inv' ? 'black' : 'white',
                                                padding: '6px 16px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                outline: 'none',
                                                fontSize: '10px',
                                                fontWeight: '400',
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0
                                            }}
                                        >
                                            Investment summary
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('company')}
                                            className="transition-all"
                                            style={{
                                                backgroundColor: activeTab === 'company' ? '#00ff7f' : 'transparent',
                                                color: activeTab === 'company' ? 'black' : 'white',
                                                padding: '6px 16px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                outline: 'none',
                                                fontSize: '10px',
                                                fontWeight: '400',
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0
                                            }}
                                        >
                                            Company update
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('analyst')}
                                            className="transition-all"
                                            style={{
                                                backgroundColor: activeTab === 'analyst' ? '#00ff7f' : 'transparent',
                                                color: activeTab === 'analyst' ? 'black' : 'white',
                                                padding: '6px 16px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                outline: 'none',
                                                fontSize: '10px',
                                                fontWeight: '400',
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0
                                            }}
                                        >
                                            Analyst view
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('fin')}
                                            className="transition-all"
                                            style={{
                                                backgroundColor: activeTab === 'fin' ? '#00ff7f' : 'transparent',
                                                color: activeTab === 'fin' ? 'black' : 'white',
                                                padding: '6px 16px',
                                                borderRadius: '8px',
                                                border: 'none',
                                                cursor: 'pointer',
                                                outline: 'none',
                                                fontSize: '10px',
                                                fontWeight: '400',
                                                whiteSpace: 'nowrap',
                                                flexShrink: 0
                                            }}
                                        >
                                            Financials
                                        </button>
                                    </div>

                                    <div className="overflow-y-auto relative custom-scrollbar pr-2 pb-2 block" style={{ maxHeight: '485px', overflowY: 'auto', display: 'block' }}>
                                        <div className={`detail-tab-content ${activeTab === 'rec' ? 'active' : ''}`}>
                                            <h3 className="section-title">Price performance</h3>
                                            <div className="overflow-x-auto">
                                                <table className="mini-table w-full table-fixed">
                                                    <thead>
                                                        <tr>
                                                            <th className="text-left" style={{ width: '20%' }}>1M</th>
                                                            <th className="text-left" style={{ width: '20%' }}>3M</th>
                                                            <th className="text-left" style={{ width: '20%' }}>6M</th>
                                                            <th className="text-left" style={{ width: '20%' }}>1Y</th>
                                                            <th className="text-left" style={{ width: '20%' }}>Since call</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(() => {
                                                            const rec = selectedReport.recommendation || {};
                                                            const perfCall = rec.performance_since_call;

                                                            const val1m = rec.return_1m != null ? rec.return_1m : perfCall;
                                                            const val3m = rec.return_3m != null ? rec.return_3m : perfCall;
                                                            const val6m = rec.return_6m != null ? rec.return_6m : perfCall;
                                                            const val1y = rec.return_1y != null ? rec.return_1y : perfCall;

                                                            return (
                                                                <tr>
                                                                    <td className={`text-left ${getPerfColorClass(val1m)}`}>
                                                                        {val1m != null ? val1m.toFixed(1) + '%' : '-'}
                                                                    </td>
                                                                    <td className={`text-left ${getPerfColorClass(val3m)}`}>
                                                                        {val3m != null ? val3m.toFixed(1) + '%' : '-'}
                                                                    </td>
                                                                    <td className={`text-left ${getPerfColorClass(val6m)}`}>
                                                                        {val6m != null ? val6m.toFixed(1) + '%' : '-'}
                                                                    </td>
                                                                    <td className={`text-left ${getPerfColorClass(val1y)}`}>
                                                                        {val1y != null ? val1y.toFixed(1) + '%' : '-'}
                                                                    </td>
                                                                    <td className={`text-left ${getPerfColorClass(perfCall)}`}>
                                                                        {perfCall != null ? perfCall.toFixed(1) + '%' : '-'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })()}
                                                    </tbody>
                                                </table>

                                            </div>

                                            {/* Mode Selector - Always Visible */}
                                            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', marginTop: '12px', width: '100%' }}>
                                                <div style={{
                                                    backgroundColor: '#2C2C2E',
                                                    borderRadius: '10px',
                                                    padding: '4px',
                                                    display: 'inline-flex',
                                                    gap: '0',
                                                    border: '1px solid #3A3A3C'
                                                }}>
                                                    <button
                                                        onClick={() => setComparisonMode('historical')}
                                                        className="transition-all"
                                                        style={{
                                                            backgroundColor: comparisonMode === 'historical' ? '#00ff7f' : 'transparent',
                                                            color: comparisonMode === 'historical' ? 'black' : 'white',
                                                            padding: '6px 16px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            outline: 'none',
                                                            fontSize: '10px',
                                                            fontWeight: '400',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        Historicals
                                                    </button>
                                                    <button
                                                        onClick={() => setComparisonMode('brokers')}
                                                        className="transition-all"
                                                        style={{
                                                            backgroundColor: comparisonMode === 'brokers' ? '#00ff7f' : 'transparent',
                                                            color: comparisonMode === 'brokers' ? 'black' : 'white',
                                                            padding: '6px 16px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            outline: 'none',
                                                            fontSize: '10px',
                                                            fontWeight: '400',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        Brokers
                                                    </button>
                                                    <button
                                                        onClick={() => setComparisonMode('peers')}
                                                        className="transition-all"
                                                        style={{
                                                            backgroundColor: comparisonMode === 'peers' ? '#00ff7f' : 'transparent',
                                                            color: comparisonMode === 'peers' ? 'black' : 'white',
                                                            padding: '6px 16px',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            outline: 'none',
                                                            fontSize: '10px',
                                                            fontWeight: '400',
                                                            whiteSpace: 'nowrap'
                                                        }}
                                                    >
                                                        Peers
                                                    </button>
                                                </div>

                                                {/* Forecast Year Selector - Far Right */}
                                                {(() => {
                                                    const getAvailableForecastYears = (rep) => {
                                                        if (!rep || !rep.forecast_table || !rep.forecast_table.columns) return [];

                                                        // Get report date to determine which years are forecasts
                                                        const reportDate = rep.info_of_report?.date_of_issue || '250101'; // Default to 2025
                                                        const reportYear = 2000 + parseInt(reportDate.substring(0, 2));

                                                        // Helper to normalize year formats
                                                        const normalizeYear = (yearStr) => {
                                                            const str = yearStr.toString();

                                                            // Match patterns like "2025F", "2025", "12/25", "12-25"
                                                            const fourDigit = str.match(/(\d{4})/);
                                                            if (fourDigit) return fourDigit[1];

                                                            const twoDigit = str.match(/(\d{2})[\/\-]?(\d{2})/);
                                                            if (twoDigit) return `20${twoDigit[2]}`;

                                                            return null;
                                                        };

                                                        // Get all years from columns and normalize them
                                                        const allYears = rep.forecast_table.columns
                                                            .map(c => {
                                                                const normalized = normalizeYear(c);
                                                                if (!normalized) return null;
                                                                return {
                                                                    original: c,
                                                                    normalized: normalized,
                                                                    numeric: parseInt(normalized)
                                                                };
                                                            })
                                                            .filter(y => y !== null && !isNaN(y.numeric))
                                                            .sort((a, b) => a.numeric - b.numeric);

                                                        // Get unique years (in case of duplicates)
                                                        const uniqueYears = [];
                                                        const seen = new Set();
                                                        for (const y of allYears) {
                                                            if (!seen.has(y.numeric)) {
                                                                seen.add(y.numeric);
                                                                uniqueYears.push(y);
                                                            }
                                                        }

                                                        // Filter forecast years (>= report year)
                                                        const forecastYears = uniqueYears.filter(y => y.numeric >= reportYear);

                                                        // If we have at least 4 forecast years, return them
                                                        if (forecastYears.length >= 4) {
                                                            return forecastYears.slice(0, 4).map(y => y.original);
                                                        }

                                                        // Otherwise, backfill with historical years
                                                        const historicalYears = uniqueYears.filter(y => y.numeric < reportYear).reverse();
                                                        const neededHistorical = 4 - forecastYears.length;
                                                        const backfillYears = historicalYears.slice(0, neededHistorical).reverse();
                                                        const combined = [...backfillYears, ...forecastYears];

                                                        return combined.map(y => y.original);
                                                    };

                                                    const availableYears = getAvailableForecastYears(selectedReport);
                                                    if (availableYears.length === 0) return null;

                                                    // Helper to display year without any suffix (E, A, F, etc.)
                                                    const displayYear = (year) => {
                                                        const str = year.toString();
                                                        // Extract just the numeric year
                                                        const fourDigit = str.match(/(\d{4})/);
                                                        if (fourDigit) return fourDigit[1];

                                                        const twoDigit = str.match(/(\d{2})[\/\-]?(\d{2})/);
                                                        if (twoDigit) return `20${twoDigit[2]}`;

                                                        // Remove all alphabetic characters
                                                        return str.replace(/[A-Za-z]/g, '');
                                                    };

                                                    return (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{ fontSize: '10px', color: '#888', whiteSpace: 'nowrap' }}>Forecast Year:</span>
                                                            <select
                                                                value={selectedHistYear || availableYears[availableYears.length - 1] || ''}
                                                                onChange={(e) => setSelectedHistYear(e.target.value)}
                                                                style={{
                                                                    backgroundColor: '#2C2C2E',
                                                                    color: 'white',
                                                                    border: '1px solid #3A3A3C',
                                                                    borderRadius: '8px',
                                                                    padding: '6px 12px',
                                                                    fontSize: '10px',
                                                                    cursor: 'pointer',
                                                                    outline: 'none'
                                                                }}
                                                            >
                                                                {availableYears.map(year => (
                                                                    <option key={year} value={year}>
                                                                        {displayYear(year)}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    );
                                                })()}
                                            </div>

                                            {/* Unified Comparison Table for all modes */}
                                            <div className="mt-4">
                                                <UnifiedComparisonTable
                                                    mode={comparisonMode}
                                                    currentReport={selectedReport}
                                                    allReports={reports}
                                                    selectedYear={selectedHistYear}
                                                />
                                            </div>

                                            {/* Old historical rendering hidden for reference */}
                                            {comparisonMode === 'historical' && false && (
                                                <div className="overflow-x-auto mt-4" style={{ display: 'none' }}>
                                                    {(() => {
                                                        try {
                                                            // 1. Get Comparisons
                                                            // Function to parse date
                                                            const parseDateDate = (dStr) => {
                                                                if (!dStr) return new Date(0);
                                                                const y = 2000 + parseInt(dStr.substring(0, 2));
                                                                const m = parseInt(dStr.substring(2, 4)) - 1;
                                                                const d = parseInt(dStr.substring(4, 6));
                                                                return new Date(y, m, d);
                                                            };
                                                            const currentRepDate = parseDateDate(selectedReport.info_of_report?.date_of_issue);
                                                            const oneYearAgo = new Date(currentRepDate);
                                                            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

                                                            let comparisonReports = [];

                                                            if (comparisonMode === 'peers') {
                                                                // === PEERS MODE ===
                                                                // 1. All reports for Ticker
                                                                // 2. Within 1 year
                                                                // 3. Latest per Broker
                                                                const candidates = (reports || []).filter(r => {
                                                                    // Add null safety for all property accesses
                                                                    if (!r || !r.info_of_report) return false;

                                                                    const rDate = parseDateDate(r.info_of_report.date_of_issue);
                                                                    if (!rDate) return false;

                                                                    // Ticker match
                                                                    if (r.info_of_report.ticker !== selectedReport.info_of_report.ticker) return false;
                                                                    // Date window (< 1 year from NOW or Selected Report? User said <1 year, assuming relative to Selected)
                                                                    // Let's use relative to Selected Report to be consistent with "historical context". 
                                                                    // Actually, for "Peer Comparison", usually it's "Current market view". 
                                                                    // But let's stick to "Relative to Selected Report" for consistency, or "Relative to Today"? 
                                                                    // If I view an old report, I probably want to see its peers *at that time*. 
                                                                    // So relative to Selected is safer.
                                                                    if (rDate > currentRepDate || rDate < oneYearAgo) return false;

                                                                    const hasTP = r.recommendation?.target_price != null;
                                                                    const hasForecast = r.forecast_table != null || r.forecast_summary != null;
                                                                    return hasTP || hasForecast;
                                                                });

                                                                const latestPerBroker = {};
                                                                candidates.forEach(r => {
                                                                    // Add null safety for broker name
                                                                    const broker = r?.info_of_report?.issued_company;
                                                                    if (!broker) return; // Skip if no broker name

                                                                    if (!latestPerBroker[broker] || parseDateDate(latestPerBroker[broker].info_of_report.date_of_issue) < parseDateDate(r.info_of_report.date_of_issue)) {
                                                                        latestPerBroker[broker] = r;
                                                                    }
                                                                });

                                                                // Sort alphabetically by Broker, but put Selected Report's broker first? Or just Alpha.
                                                                comparisonReports = Object.values(latestPerBroker).sort((a, b) => {
                                                                    const brokerA = a?.info_of_report?.issued_company || '';
                                                                    const brokerB = b?.info_of_report?.issued_company || '';
                                                                    return brokerA.localeCompare(brokerB);
                                                                });

                                                            } else {
                                                                // === HISTORICAL MODE (Existing Logic) ===
                                                                const comparisonReportsRaw = (reports || [])
                                                                    .filter(r => {
                                                                        // Add null safety for all property accesses
                                                                        if (!r || !r.info_of_report) return false;

                                                                        const rDate = parseDateDate(r.info_of_report.date_of_issue);
                                                                        if (!rDate) return false;

                                                                        if (r.info_of_report.issued_company !== selectedReport.info_of_report.issued_company) return false;
                                                                        if (r.info_of_report.ticker !== selectedReport.info_of_report.ticker) return false;
                                                                        if (rDate > currentRepDate || rDate < oneYearAgo) return false;
                                                                        const hasTP = r.recommendation?.target_price != null;
                                                                        const hasForecast = r.forecast_table != null || r.forecast_summary != null;
                                                                        return hasTP || hasForecast;
                                                                    })
                                                                    .sort((a, b) => parseDateDate(a.info_of_report.date_of_issue) - parseDateDate(b.info_of_report.date_of_issue));

                                                                const reportsByQuarter = {};
                                                                comparisonReportsRaw.forEach(r => {
                                                                    const d = parseDateDate(r.info_of_report.date_of_issue);
                                                                    const q = Math.floor(d.getMonth() / 3) + 1;
                                                                    const key = `${d.getFullYear()}-Q${q}`;
                                                                    if (!reportsByQuarter[key] || parseDateDate(reportsByQuarter[key].info_of_report.date_of_issue) < d) {
                                                                        reportsByQuarter[key] = r;
                                                                    }
                                                                });
                                                                comparisonReports = Object.values(reportsByQuarter);
                                                            }
                                                            // Common End logic
                                                            // Ensure selected report is in logic? 
                                                            // The filters above include it (<= currentRepDate).

                                                            // For financials logic:
                                                            // We need to know who is "Latest" to determine available years.
                                                            const latestReport = comparisonReports.length > 0 ? comparisonReports[comparisonReports.length - 1] : selectedReport;

                                                            // For change calculation:
                                                            // In Peers mode: Change vs what? Maybe vs Avg? Or no change col?
                                                            // "every other row is the same". Recommendation, TP, etc.
                                                            // Change column in peers usually irrelevant or vs prev rating.
                                                            // I will KEEP the `prevToLatestReport` variable but it might be undefined in Peers mode or meaningless.
                                                            // Actually, let's just null it for Peers to avoid confusing "Change" arrows between different brokers.
                                                            const prevToLatestReport = comparisonMode === 'historical' && comparisonReports.length > 1 ? comparisonReports[comparisonReports.length - 2] : null;

                                                            // 2. Determine Available Years & Target Year
                                                            const getAvailableForecastYears = (rep) => {
                                                                if (!rep || !rep.forecast_table || !rep.forecast_table.columns) return [];
                                                                // Columns usually ["Year", "2023", "2024A", "2025F", "2026F"...]
                                                                // Filter for anything looking like a year (4 digits)
                                                                const allYears = rep.forecast_table.columns.filter(c => c.toString().match(/\d{4}/));

                                                                // Parse and sort all available years
                                                                const parsedYears = allYears.map(y => ({
                                                                    original: y,
                                                                    numeric: parseInt(y.toString().replace(/\D/g, ''))
                                                                })).sort((a, b) => a.numeric - b.numeric);

                                                                // Get forecast years (2025+) first
                                                                const forecastYears = parsedYears.filter(y => y.numeric >= 2025);

                                                                // If we have 4+ forecast years, return only those
                                                                if (forecastYears.length >= 4) {
                                                                    return forecastYears.map(y => y.original);
                                                                }

                                                                // Otherwise, backfill with historical years to reach minimum 4
                                                                const historicalYears = parsedYears.filter(y => y.numeric < 2025).reverse(); // Most recent first
                                                                const neededHistorical = 4 - forecastYears.length;
                                                                const backfillYears = historicalYears.slice(0, neededHistorical).reverse(); // Back to chronological

                                                                // Combine: historical (ascending) + forecast (ascending)
                                                                const combined = [...backfillYears, ...forecastYears];
                                                                return combined.map(y => y.original);
                                                            };

                                                            const availableYears = getAvailableForecastYears(latestReport);
                                                            // Default to the last one (furthest year) if no selection
                                                            const targetYear = selectedHistYear || (availableYears.length > 0 ? availableYears[availableYears.length - 1] : null);

                                                            // 3. Helper to get Matching Data
                                                            const getFinancialsForYear = (rep, key, tYear) => {
                                                                // Add comprehensive null safety
                                                                if (!rep) return null;
                                                                if (!rep.forecast_table) return null;
                                                                if (!rep.forecast_table.columns || !Array.isArray(rep.forecast_table.columns)) return null;
                                                                if (!rep.forecast_table.rows || !Array.isArray(rep.forecast_table.rows)) return null;

                                                                if (tYear && rep.forecast_table) {
                                                                    try {
                                                                        const cols = rep.forecast_table.columns || [];
                                                                        const tYearClean = tYear.replace(/[A-Za-z]/g, ''); // e.g. "2025" or "12-25"

                                                                        // Normalize Year finding (match 2025 or 25)
                                                                        let colIndex = cols.findIndex(c => c.toString().includes(tYearClean));
                                                                        if (colIndex === -1 && tYearClean.length === 4) {
                                                                            const shortYear = tYearClean.substring(2);
                                                                            colIndex = cols.findIndex(c => c.toString().includes(shortYear));
                                                                        }

                                                                        if (colIndex !== -1 && colIndex < cols.length) {
                                                                            const colName = cols[colIndex];
                                                                            // Additional safety: ensure column name exists
                                                                            if (!colName) {
                                                                                console.warn(`Column at index ${colIndex} is undefined for report ${rep.id}`);
                                                                                return null;
                                                                            }
                                                                            const isMatch = (r) => {
                                                                                const rKey = r.metric || r.item || r.name;
                                                                                return rKey && (rKey === key || rKey.toLowerCase() === key.toLowerCase());
                                                                            };

                                                                            // 1. Top-level row match
                                                                            const row = rep.forecast_table.rows.find(r => isMatch(r));
                                                                            if (row) {
                                                                                if (row.values && Array.isArray(row.values)) {
                                                                                    if (colIndex >= 0 && colIndex < row.values.length) return row.values[colIndex];
                                                                                }
                                                                                if (row[colName] !== undefined) return row[colName];
                                                                            }

                                                                            // 2. Row-per-Year Match (HSC style)
                                                                            // Loop through rows to find one that matches the Year Column Name
                                                                            const yearRow = rep.forecast_table.rows.find(r => r.Year && r.Year.toString() === colName.toString());
                                                                            if (yearRow) {
                                                                                if (yearRow[key] !== undefined) return yearRow[key];
                                                                                const categories = ['balance_sheet', 'income_statement', 'cash_flow', 'key_ratios'];
                                                                                for (const cat of categories) {
                                                                                    if (yearRow[cat] && yearRow[cat][key] !== undefined) return yearRow[cat][key];
                                                                                }
                                                                            }
                                                                        }
                                                                    } catch (e) {
                                                                        console.error("Error parsing financials:", e);
                                                                    }
                                                                }
                                                                return null;
                                                            };

                                                            // 4. Render Row Helper
                                                            const renderHistoricalRow = (label, key, isPercent = false, isFinancial = false, isText = false) => {
                                                                // Check data density - count non-null values
                                                                let filledCount = 0;
                                                                const totalColumns = comparisonReports.length;

                                                                for (const rep of comparisonReports) {
                                                                    let val = null;
                                                                    if (isFinancial) {
                                                                        val = getFinancialsForYear(rep, key, targetYear);
                                                                    } else if (key === 'recommendation') {
                                                                        val = rep.recommendation?.recommendation;
                                                                    } else {
                                                                        val = rep.recommendation?.[key];
                                                                    }

                                                                    if (val !== null && val !== undefined && val !== '' && val !== '-') {
                                                                        filledCount++;
                                                                    }
                                                                }

                                                                // Hide row only if ALL columns are empty
                                                                if (filledCount === 0) {
                                                                    return null;
                                                                }

                                                                // ... same calculation logic ...
                                                                // Calculate Change only for the last 2 reports
                                                                let valLatest = null;
                                                                let valPrev = null;

                                                                if (isFinancial) { // EPS, Revenue, etc.
                                                                    valLatest = getFinancialsForYear(latestReport, key, targetYear);
                                                                    valPrev = getFinancialsForYear(prevToLatestReport, key, targetYear);
                                                                } else if (key === 'recommendation') {
                                                                    valLatest = latestReport?.recommendation?.recommendation;
                                                                    valPrev = prevToLatestReport?.recommendation?.recommendation;
                                                                } else if (key === 'target_price') {
                                                                    valLatest = latestReport?.recommendation?.target_price;
                                                                    valPrev = prevToLatestReport?.recommendation?.target_price;
                                                                } else if (key === 'upside_at_call') {
                                                                    valLatest = latestReport?.recommendation?.upside_at_call;
                                                                    valPrev = null; // Don't calc delta for Upside? Actually user requested it enabled.
                                                                    // Let's enable it if we have Prev
                                                                    valPrev = prevToLatestReport?.recommendation?.upside_at_call;
                                                                } else if (key === 'performance_since_call') {
                                                                    valLatest = latestReport?.recommendation?.performance_since_call;
                                                                    valPrev = prevToLatestReport?.recommendation?.performance_since_call;
                                                                }

                                                                // For financial metrics, check if latest value is an outlier
                                                                let latestIsOutlier = false;
                                                                if (isFinancial) {
                                                                    const allValues = comparisonReports.map(rep => {
                                                                        const v = getFinancialsForYear(rep, key, targetYear);
                                                                        return v != null && !isNaN(v) ? v : null;
                                                                    }).filter(v => v != null);

                                                                    const sorted = [...allValues].sort((a, b) => a - b);
                                                                    const mid = Math.floor(sorted.length / 2);
                                                                    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

                                                                    if (median != null && valLatest != null && allValues.length >= 3) {
                                                                        const deviation = Math.abs(valLatest - median) / Math.abs(median);
                                                                        latestIsOutlier = deviation > 0.30;
                                                                    }
                                                                }

                                                                // Calculate Delta (skip if latest is outlier)
                                                                let change = null;
                                                                // Ensure calculateChange is available. If not, define it locally.
                                                                const calcChangeLocal = (a, b) => {
                                                                    if (b === 0) return null;
                                                                    return ((a - b) / Math.abs(b)) * 100; // Use Abs(b) for correct sign? Standard formula: (New-Old)/|Old| unless Old is negative, then it's tricky. 
                                                                    // Let's assume standard formula.
                                                                };

                                                                if (latestIsOutlier) {
                                                                    change = null;
                                                                } else if (!isText && !isFinancial && (key === 'target_price' || key === 'upside_at_call' || key === 'performance_since_call') && valLatest && valPrev) {
                                                                    // For Upside/Perf (%), the change is just simple difference or % change?
                                                                    // Ideally simple difference (pp) for % metrics, but user asked for "Deltas enabled".
                                                                    // Existing code used `calculateChange` which is % change.
                                                                    // Let's stick to % change for now to be consistent, or if valPrev is %, % change of % is weird.
                                                                    // But for Target Price it's % change.
                                                                    change = ((valLatest - valPrev) / valPrev) * 100;
                                                                } else if (isFinancial && valLatest != null && valPrev != null) {
                                                                    change = calcChangeLocal(valLatest, valPrev);
                                                                }

                                                                // No longer disabled!
                                                                // if (key === 'upside_at_call' ...

                                                                return (
                                                                    <tr key={key}>
                                                                        <td className="text-left border-r border-gray-700"
                                                                            style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#1E1E1E' }}>
                                                                            {label}
                                                                        </td>
                                                                        {(() => {
                                                                            // For financial metrics, detect outliers first
                                                                            let allValues = [];
                                                                            if (isFinancial) {
                                                                                allValues = comparisonReports.map(rep => {
                                                                                    const v = getFinancialsForYear(rep, key, targetYear);
                                                                                    return v != null && !isNaN(v) ? v : null;
                                                                                }).filter(v => v != null);
                                                                            }

                                                                            // Calculate median for outlier detection
                                                                            const getMedian = (arr) => {
                                                                                if (arr.length === 0) return null;
                                                                                const sorted = [...arr].sort((a, b) => a - b);
                                                                                const mid = Math.floor(sorted.length / 2);
                                                                                return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
                                                                            };

                                                                            const median = getMedian(allValues);

                                                                            // Check if value is outlier (differs by more than 30% from median)
                                                                            // Only apply outlier detection if we have at least 3 data points
                                                                            const isOutlier = (val) => {
                                                                                if (!isFinancial || val == null) return false;

                                                                                // Sanity check for specific metrics with known reasonable ranges
                                                                                // BVPS for Vietnamese stocks should be > 100 (typically in thousands)
                                                                                if (key === 'bvps_vnd' && val < 100) return true;
                                                                                // EPS should typically be > 100 for VND stocks
                                                                                if (key === 'eps_vnd' && val < 100) return true;

                                                                                // Apply median-based outlier detection only if we have 3+ data points
                                                                                if (median == null || allValues.length < 3) return false;
                                                                                const deviation = Math.abs(val - median) / Math.abs(median);
                                                                                return deviation > 0.30;
                                                                            };

                                                                            return comparisonReports.map((rep, idx) => {
                                                                                // Wrap entire logic in try-catch to prevent crashes
                                                                                try {
                                                                                    // Add null safety for rep
                                                                                    if (!rep) return <td key={`empty-${idx}`} className="text-center">-</td>;

                                                                                    const repKey = rep.id || rep.info_of_report?.date_of_issue || idx;

                                                                                    let val = null;
                                                                                    if (isFinancial) {
                                                                                        val = getFinancialsForYear(rep, key, targetYear);
                                                                                    } else if (key === 'recommendation') {
                                                                                        // Use raw recommendation value to match Company Reports table
                                                                                        val = rep.recommendation?.recommendation || '-';
                                                                                    } else {
                                                                                        val = rep.recommendation?.[key];
                                                                                    }

                                                                                    // Check for outlier in financial data
                                                                                    if (isFinancial && isOutlier(val)) {
                                                                                        return <td key={repKey} className="text-center">-</td>;
                                                                                    }

                                                                                    // Formatting
                                                                                    if (val == null || val === undefined) return <td key={repKey} className="text-center">-</td>;
                                                                                    if (key === 'recommendation') {
                                                                                        const recStyle = getRecommendationStyle(val);
                                                                                        return (
                                                                                            <td key={repKey} className="text-center">
                                                                                                <span style={{
                                                                                                    ...recStyle,
                                                                                                    padding: '4px 12px',
                                                                                                    borderRadius: '9999px',
                                                                                                    fontWeight: 'bold',
                                                                                                    fontSize: '10px',
                                                                                                    display: 'inline-block'
                                                                                                }}>
                                                                                                    {val}
                                                                                                </span>
                                                                                            </td>
                                                                                        );
                                                                                    }
                                                                                    if (isText) return <td key={repKey} className="text-center">{val}</td>;
                                                                                    // Add safety for toFixed() - ensure val is a number
                                                                                    if (isPercent) {
                                                                                        const numVal = typeof val === 'number' ? val : parseFloat(val);
                                                                                        if (isNaN(numVal)) return <td key={repKey} className="text-center">-</td>;
                                                                                        return <td key={repKey} className="text-center">{numVal.toFixed(1)}%</td>;
                                                                                    }
                                                                                    // Add safety for toLocaleString()
                                                                                    const numVal = typeof val === 'number' ? val : parseFloat(val);
                                                                                    if (isNaN(numVal)) return <td key={repKey} className="text-center">{val}</td>;
                                                                                    return <td key={repKey} className="text-center">{numVal.toLocaleString()}</td>;
                                                                                } catch (error) {
                                                                                    console.error('Error rendering comparison cell:', error, { rep, key, targetYear });
                                                                                    return <td key={`error-${idx}`} className="text-center">-</td>;
                                                                                }
                                                                            });
                                                                        })()}
                                                                        {comparisonMode === 'historical' && (
                                                                            <td className={`text-center ${change > 0 ? 'text-[#00ff7f]' : change < 0 ? 'text-[#ff6666]' : ''}`}>
                                                                                {key === 'recommendation'
                                                                                    ? (valLatest !== valPrev && valPrev ? 'Change' : '')
                                                                                    : (change != null ? (change > 0 ? '+' : '') + change.toFixed(1) + '%' : '-')}
                                                                            </td>
                                                                        )}
                                                                    </tr>
                                                                );
                                                            };

                                                            return (
                                                                <div>

                                                                    <table className="mini-table w-full relative border-collapse">
                                                                        <thead>
                                                                            <tr>
                                                                                <th className="text-left border-r border-b border-gray-700"
                                                                                    style={{ position: 'sticky', left: 0, top: 0, zIndex: 30, backgroundColor: '#1E1E1E' }}>
                                                                                    Metric
                                                                                </th>
                                                                                {comparisonReports.map(rep => (
                                                                                    <th key={rep.id} className="text-center border-b border-gray-700 whitespace-nowrap px-4"
                                                                                        style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#1E1E1E' }}>
                                                                                        {comparisonMode === 'peers' ? (
                                                                                            <span className="font-bold text-white">{rep.info_of_report.issued_company}</span>
                                                                                        ) : (
                                                                                            formatDate(rep.info_of_report.date_of_issue)
                                                                                        )}
                                                                                    </th>
                                                                                ))}
                                                                                {comparisonMode === 'historical' && (
                                                                                    <th className="text-center border-b border-gray-700"
                                                                                        style={{ position: 'sticky', top: 0, zIndex: 20, backgroundColor: '#1E1E1E' }}>
                                                                                        Δ
                                                                                    </th>
                                                                                )}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {comparisonMode === 'peers' && (
                                                                                <tr>
                                                                                    <td className="text-left border-r border-gray-700 font-medium" style={{ position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#1E1E1E' }}>
                                                                                        Date
                                                                                    </td>
                                                                                    {comparisonReports.map(rep => (
                                                                                        <td key={rep.id} className="text-center border-gray-700 px-4">
                                                                                            {formatDate(rep.info_of_report.date_of_issue)}
                                                                                        </td>
                                                                                    ))}
                                                                                </tr>
                                                                            )}
                                                                            {renderHistoricalRow('Recommendation', 'recommendation', false, false, true)}
                                                                            {renderHistoricalRow('Target price', 'target_price', false, false, false)}
                                                                            {renderHistoricalRow('Upside at call', 'upside_at_call', true, false, false)}
                                                                            {renderHistoricalRow('Perf since call', 'performance_since_call', true, false, false)}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            );
                                                        } catch (error) {
                                                            console.error('Error rendering comparison section:', error);
                                                            return (
                                                                <div style={{ padding: '20px', textAlign: 'center', color: '#ff6666' }}>
                                                                    <p>Unable to load comparison data for this report.</p>
                                                                    <p style={{ fontSize: '12px', color: '#888' }}>Check console for details.</p>
                                                                </div>
                                                            );
                                                        }
                                                    })()}
                                                </div>
                                            )}
                                        </div>

                                        <div className={`detail-tab-content ${activeTab === 'inv' ? 'active' : ''}`}>
                                            {/* 1. Investment Thesis */}
                                            {selectedReport.investment_thesis && Array.isArray(selectedReport.investment_thesis) && (
                                                <div className="sub-section">
                                                    <h4>Investment thesis</h4>
                                                    <ul>
                                                        {selectedReport.investment_thesis.map((pt, i) => {
                                                            if (typeof pt === 'object' && pt !== null) {
                                                                return (
                                                                    <li key={i}>
                                                                        {pt.title && <strong>{pt.title}: </strong>}
                                                                        {pt.content || pt.details || JSON.stringify(pt)}
                                                                    </li>
                                                                );
                                                            }
                                                            return <li key={i}>{pt}</li>;
                                                        })}
                                                    </ul>
                                                </div>
                                            )}
                                            {/* 4. Risk Assessment */}
                                            {(() => {
                                                const risks = getRisks(selectedReport);
                                                // Hide section completely if no risk data
                                                if (!risks || (Array.isArray(risks) && risks.length === 0)) return null;

                                                return (
                                                    <div className="sub-section">
                                                        <h4>Risk</h4>
                                                        <ul>
                                                            {Array.isArray(risks)
                                                                ? risks.map((r, i) => {
                                                                    if (typeof r === 'object' && r !== null) {
                                                                        // Format as: risk. impact. mitigation. (values only, no labels)
                                                                        // Trim trailing periods from each value, then join with ". " and add final period
                                                                        const values = Object.values(r).filter(v => v).map(v => String(v).replace(/\.+$/, ''));
                                                                        const text = values.join('. ');
                                                                        return <li key={i}>{text}.</li>;
                                                                    }
                                                                    // For string values, add period only if not already ending with one
                                                                    const text = String(r).replace(/\.+$/, '');
                                                                    return <li key={i}>{text}.</li>;
                                                                })
                                                                : (typeof risks === 'object' && risks !== null)
                                                                    ? <li>{Object.values(risks).filter(v => v).map(v => String(v).replace(/\.+$/, '')).join('. ')}.</li>
                                                                    : <li>{String(risks).replace(/\.+$/, '')}.</li>
                                                            }
                                                        </ul>
                                                    </div>
                                                );
                                            })()}
                                        </div>


                                        <div className={`detail-tab-content ${activeTab === 'fin' ? 'active' : ''}`}>
                                            {/* Financial Forecast Table */}
                                            {selectedReport.forecast_table && (
                                                <ForecastTable forecastData={selectedReport.forecast_table} reportDate={selectedReport.date} />
                                            )}
                                        </div>



                                        <div className={`detail-tab-content ${activeTab === 'analyst' ? 'active' : ''}`} style={{ fontSize: '10px' }}>
                                            {selectedReport.analyst_viewpoints && Array.isArray(selectedReport.analyst_viewpoints) && selectedReport.analyst_viewpoints.length > 0 && (
                                                <div className="sub-section">
                                                    <h4>Analyst viewpoints</h4>
                                                    <ul>
                                                        {selectedReport.analyst_viewpoints.map((point, idx) => (
                                                            <li key={idx}>{point}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {selectedReport.key_tracking && Array.isArray(selectedReport.key_tracking) && selectedReport.key_tracking.length > 0 && (
                                                <div className="sub-section">
                                                    <h4>Key tracking</h4>
                                                    <ul>
                                                        {selectedReport.key_tracking.map((item, idx) => (
                                                            <li key={idx}>{item}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {(!selectedReport.analyst_viewpoints || selectedReport.analyst_viewpoints.length === 0) &&
                                                (!selectedReport.key_tracking || selectedReport.key_tracking.length === 0) && (
                                                    <div style={{ color: '#666', fontStyle: 'italic' }}>No analyst information available</div>
                                                )}
                                        </div>

                                        <div className={`detail-tab-content ${activeTab === 'company' ? 'active' : ''}`}>
                                            <h3 className="section-title">Company update</h3>
                                            {selectedReport.company_update && Array.isArray(selectedReport.company_update) && (
                                                <div className="sub-section">
                                                    <ul>
                                                        {selectedReport.company_update.map((pt, i) => {
                                                            if (typeof pt === 'object' && pt !== null) {
                                                                // Handle complex table data or structured text
                                                                if (pt.data && Array.isArray(pt.data)) {
                                                                    return (
                                                                        <li key={i} className="block mt-[0.5rem]">
                                                                            {pt.title && <div className="font-bold mb-1 text-green-400">{pt.title}</div>}
                                                                            <div className="overflow-x-auto">
                                                                                <table className="mini-table w-full text-xs">
                                                                                    <thead>
                                                                                        <tr>
                                                                                            {Object.keys(pt.data[0]).map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>)}
                                                                                        </tr>
                                                                                    </thead>
                                                                                    <tbody>
                                                                                        {pt.data.map((row, rI) => (
                                                                                            <tr key={rI}>
                                                                                                {Object.values(row).map((val, cI) => <td key={cI}>{val}</td>)}
                                                                                            </tr>
                                                                                        ))}
                                                                                    </tbody>
                                                                                </table>
                                                                            </div>
                                                                        </li>
                                                                    );
                                                                }
                                                                return (
                                                                    <li key={i}>
                                                                        {pt.title && <strong>{pt.title}: </strong>}
                                                                        {pt.content || pt.details || JSON.stringify(pt)}
                                                                    </li>
                                                                );
                                                            }
                                                            return <li key={i}>{pt}</li>;
                                                        })}
                                                    </ul>
                                                </div>
                                            )}
                                            {(!selectedReport.company_update || selectedReport.company_update.length === 0) && (
                                                <div style={{ color: '#666', fontStyle: 'italic', fontSize: '0.8rem' }}>No company update available</div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            </ReportDetailErrorBoundary>
                        ) : (
                            <div className="text-center text-gray-500 mt-10">Select a report</div>
                        )}
                    </div>
                </section >
            </main >
        </>
    );
}

// === Sub Components ===

// Icons for the Facebook-style menu
const Icons = {
    Broker: (
        <svg w="20" h="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
    ),
    Sector: (
        <svg w="20" h="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        // Placeholder 'Plus' or 'Tag' style for sectors
    ),
    Quarter: (
        <svg w="20" h="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
    ),
    Ticker: (
        <svg w="20" h="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
    ),
    All: (
        <svg w="20" h="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-gray-300">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
    )
};

// Helper to determine icon type based on placeholder/context
const getIcon = (placeholder) => {
    if (placeholder.includes('broker')) return Icons.Broker;
    if (placeholder.includes('sector')) return Icons.Sector;
    if (placeholder.includes('Period') || placeholder.includes('Quarter')) return Icons.Quarter;
    if (placeholder.includes('Ticker')) return Icons.Ticker;
    return Icons.All;
};

// Custom Dropdown with Facebook-style (Large Icons, Bold Text, Dark Theme)
function CustomSelect({ options, value, onChange, placeholder }) {
    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    appearance: 'none',
                    backgroundColor: '#1E1E1E',
                    border: '1px solid #4B5563',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    outline: 'none',
                    cursor: 'pointer',
                    height: '24px',
                    textAlign: 'center',
                    minWidth: '100px',
                    width: '100%'
                }}
            >
                <option value="All">{placeholder}</option>
                {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
        </div>
    );
}


// Make SearchableDropdown look EXACTLY like CustomSelect but with Search
// Make SearchableDropdown look EXACTLY like CustomSelect but with Search
function SearchableDropdown({ options, value, onChange, placeholder }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        function onClickOutside(e) {
            if (ref.current && !ref.current.contains(e.target)) {
                setIsOpen(false);
                setSearch(''); // Reset search on close
            }
        }
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

    const handleSelect = (val) => {
        onChange(val);
        setSearch(''); // Reset search after select
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={ref}>
            <div
                className={`flex items-center cursor-pointer transition-all shadow-sm group min-w-[100px] justify-center ${isOpen ? 'opacity-80' : ''}`}
                style={{
                    backgroundColor: '#1E1E1E',
                    border: '1px solid #4B5563',
                    borderRadius: '4px',
                    padding: '2px 8px',
                    height: '24px',
                    fontSize: '12px',
                    color: 'white'
                }}
                onClick={() => setIsOpen(!isOpen)}
                title={value === 'All' ? placeholder : value}
            >
                <div className="truncate font-normal">{value === 'All' ? placeholder : value}</div>

            </div>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-[220px] max-h-60 overflow-y-auto bg-[#1e1e1e] border border-[#454545] rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-[9999] p-[3px] animate-fadeIn">
                    {/* Search Input inside the dropdown */}
                    <div className="px-2 py-1 sticky top-0 bg-[#1e1e1e] z-10 mb-1 border-b border-[#333]">
                        <input
                            ref={inputRef}
                            className="bg-[#3c3c3c] border border-[#555] outline-none text-white text-[12px] w-full rounded-sm px-2 py-1 placeholder-gray-400 focus:border-[#007fd4]"
                            placeholder="Type to search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                        />
                    </div>

                    <div
                        className={`px-3 py-1.5 rounded-[3px] cursor-pointer text-[13px] flex items-center justify-between group hover:bg-[#04395e] hover:text-white transition-colors text-zinc-200 mb-0.5`}
                        onClick={() => handleSelect('All')}
                    >
                        <span>{placeholder}</span>
                        {value === 'All' && <span className="text-zinc-100 font-bold text-xs">✓</span>}
                    </div>
                    <div className="h-px bg-[#333] my-1 mx-1"></div>

                    {filtered.map(opt => (
                        <div
                            key={opt}
                            className={`px-3 py-1.5 rounded-[3px] cursor-pointer text-zinc-300 text-[13px] flex items-center justify-between group hover:bg-[#04395e] hover:text-white transition-colors`}
                            onClick={() => handleSelect(opt)}
                        >
                            <span className="truncate">{opt}</span>
                            {value === opt && <span className="text-zinc-100 font-bold text-xs">✓</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
