'use client';

import { useState, useMemo, useEffect } from 'react';
import Header from './components/Header';

// Helper functions
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    // Check if it's a full ISO string or YYYY-MM-DD
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime()) && String(dateStr).includes('-')) {
        const d = String(dateObj.getDate()).padStart(2, '0');
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const y = dateObj.getFullYear();
        return `${d}/${m}/${y}`;
    }
    // Handle YYMMDD format - legacy
    if (String(dateStr).length === 6) {
        const yy = dateStr.substring(0, 2);
        const mm = dateStr.substring(2, 4);
        const dd = dateStr.substring(4, 6);
        return `${dd}/${mm}/20${yy}`;
    }
    return dateStr;
};

// Helper to format Date object to YYYY-MM-DD in local time (prevents timezone shift)
const formatDateToYYYYMMDD = (date) => {
    if (!date || isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const parseDateYYMMDD = (dateStr) => {
    if (!dateStr) return null;
    const s = String(dateStr).trim();

    // YYYY-MM-DD
    if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(s);
    }

    // YYMMDD (6 digits)
    if (s.length === 6) {
        const yy = parseInt(s.substring(0, 2));
        const mm = parseInt(s.substring(2, 4)) - 1;
        const dd = parseInt(s.substring(4, 6));
        return new Date(2000 + yy, mm, dd);
    }

    // YYYYMMDD (8 digits)
    if (s.length === 8) {
        const yyyy = parseInt(s.substring(0, 4));
        const mm = parseInt(s.substring(4, 6)) - 1;
        const dd = parseInt(s.substring(6, 8));
        return new Date(yyyy, mm, dd);
    }

    // Fallback: Try native Date parse for ISO strings or other formats
    const nativeDate = new Date(s);
    if (!isNaN(nativeDate.getTime())) {
        return nativeDate;
    }

    return null;
};

// Map weekend dates to Friday (Sat->Fri, Sun->Fri)
const adjustToWeekday = (dateStr) => {
    if (!dateStr || dateStr.length !== 6) return dateStr;
    const date = parseDateYYMMDD(dateStr);
    if (!date) return dateStr;

    const day = date.getDay(); // 0=Sun, 6=Sat
    if (day === 0) { // Sunday -> Friday (subtract 2 days)
        date.setDate(date.getDate() - 2);
    } else if (day === 6) { // Saturday -> Friday (subtract 1 day)
        date.setDate(date.getDate() - 1);
    } else {
        return dateStr; // Not a weekend
    }

    // Format back to YYMMDD
    const yy = String(date.getFullYear()).slice(2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
};

const getSentimentColor = (sentiment) => {
    if (!sentiment) return 'transparent'; // No rating = no color
    const s = sentiment.toLowerCase();
    if (s === 'positive') return '#00ff7f'; // Same as Buy badge (--accent)
    if (s === 'negative') return '#ff4444'; // Same as Sell badge
    if (s === 'neutral') return '#444'; // Same as Hold badge
    return 'transparent'; // Unknown = no color
};

const getSentimentBadgeClass = (sentiment) => {
    if (!sentiment) return 'neutral';
    const s = sentiment.toLowerCase();
    if (s === 'positive') return 'positive';
    if (s === 'negative') return 'negative';
    return 'neutral';
};

// Format VN-Index target: remove text, format numbers with commas
const formatTarget = (target) => {
    if (!target) return null;
    let str = String(target);

    // Remove common text suffixes (Vietnamese and English)
    str = str.replace(/điểm/gi, '').replace(/points?/gi, '').replace(/\+\/-/g, '').replace(/~|≈/g, '').trim();

    // Check if it's a range (contains dash or "to" or "-")
    const rangeMatch = str.match(/(\d[\d,.]*)\s*[-–—]\s*(\d[\d,.]*)/);
    if (rangeMatch) {
        const low = formatNumber(rangeMatch[1]);
        const high = formatNumber(rangeMatch[2]);
        return `${low} - ${high}`;
    }

    // Single number
    return formatNumber(str);
};

// Format a number string with commas or handle numbers directly
const formatNumber = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'number') {
        // Keep 2 decimal places for non-integers (like VNINDEX 1270.35)
        return val.toLocaleString('en-US', {
            minimumFractionDigits: val % 1 !== 0 ? 2 : 0,
            maximumFractionDigits: 2
        });
    }

    // For original string targets
    const str = String(val);
    // Remove existing formatting (dots, commas, spaces)
    const cleaned = str.replace(/[,.\s]/g, '');
    const num = parseInt(cleaned);
    if (isNaN(num)) return str;
    return num.toLocaleString('en-US');
};

// Clean up broker names
const formatBrokerName = (broker) => {
    if (!broker) return '';
    let name = broker;
    // Replace Vietcap with VCI
    name = name.replace(/Vietcap/gi, 'VCI');
    // Remove "Research" text
    name = name.replace(/\s*Research\s*/gi, '');
    return name.trim().toUpperCase();
};

const shouldExcludeNewsItem = (text, category) => {
    if (!text) return true;
    const t = text.toLowerCase();

    // 1. Filter out repetitive/generated market noise (Top contributing, Net buy/sell, Price updates)
    // User Update: Keep these items if we are in the 'market' tab, but filter them out from companies/sector/etc.
    if (category !== 'market') {
        const noisePatterns = [
            'top contributing stock',
            'top net buy stock',
            'top net sell stock',
            'positive performers',
            'stock price was',
            'cover warrant',
            'declarer:', // Sometimes appears in scraped text
            'bsc30', // Index composition updates
            'bsc50',
            'sector increased by', // Generic sector performance updates
            'sector decreased by',
            'sectors saw gains'
        ];
        if (noisePatterns.some(p => t.includes(p))) return true;
    }

    // 2. Filter out general market index updates from specific categorical tabs
    // User doesn't want VN-Index updates or repetitive stock lists in Companies, Global, or Sector tabs
    if (['companies', 'global', 'sector'].includes(category)) {
        if (t.includes('vn-index') || t.includes('hnx-index')) return true;
        // Filter out "stock positively impacted index" lines
        if (t.includes('positively impacted the')) return true;
        if (t.includes('negatively impacted the')) return true;
        // Filter out simple price change lines "Ticker increased/decreased by X%"
        if (t.match(/[A-Z]{3} increased by \d/)) return true;
        if (t.match(/[A-Z]{3} decreased by \d/)) return true;
        if (t.match(/[A-Z]{3} stock price was/)) return true;
        // Filter out "among the stocks foreign investors bought/sold"
        if (t.includes('among the stocks foreign investors')) return true;
    }

    return false;
};

/**
 * Filter out generic recommendation text patterns from investment summaries
 * Returns: { filteredText: string, hasMeaningfulContent: boolean }
 */
const filterGenericRecommendations = (text) => {
    if (!text) return { filteredText: '', hasMeaningfulContent: false };

    let filtered = text;

    // Array of generic patterns to remove (case-insensitive)
    const genericPatterns = [
        // Pattern 1: "The stock is expected to provide a total return of X% within Y months/year"
        /The stock is expected to provide a total return of.+?within.+?(month|year)/gi,

        // Pattern 2: "We maintain our [RATING] recommendation for [TICKER] with a target price of [PRICE]"
        /We maintain our \w+ recommendation for \w+ (?:stock )?with a (?:target price of|target price at)[^.]*?\\.?/gi,

        // Pattern 3: "We currently have a [RATING] recommendation for [TICKER] stock with a target price of [PRICE]"
        /We currently have a \w+ recommendation for \w+ (?:stock )?with a (?:target price of|target price at)[^.]*?\\.?/gi,

        // Pattern 4: "Maintain [RATING] recommendation for [TICKER] shares with a [DATE] target price of [PRICE]"
        /Maintain \w+ recommendation for \w+ (?:shares?|stock) with a[^.]*?target price[^.]*?\\.?/gi,

        // Pattern 5: "[RATING] recommendation based on enterprise valuation"
        /\w+ recommendation based on (?:enterprise )?valuation\\.?/gi,

        // Pattern 6: "We recommend [RATING] for [TICKER] with target price [PRICE]"
        /We recommend \w+ for \w+ (?:stock )?with (?:a )?target price[^.]*?\\.?/gi,

        // Pattern 7: Vietnamese patterns - "Chúng tôi duy trì khuyến nghị [RATING]..."
        /Chúng tôi duy trì khuyến nghị \w+ (?:cho cổ phiếu )?\w+ với giá mục tiêu[^.]*?\\.?/gi,

        // Pattern 8: "Our [RATING] rating is based on..."
        /Our \w+ rating is based on[^.]*?\\.?/gi,

        // Pattern 9: Generic "Target price: [PRICE]" standalone sentences
        /(?:^|\.\s+)Target price:\s*[^.]*?\\.?/gi,

        // Pattern 10: "We initiate coverage with [RATING] recommendation"
        /We initiate coverage (?:on \w+ )?with (?:a )?\w+ recommendation[^.]*?\\.?/gi,

        // Pattern 11: Specific "The stock has a target price of..." phrase (User Request)
        /The stock has a target price of (?:VND )?[\d,.]+(?:,)?\s+representing a potential (?:upside|downside) of\s+[-−]?[\d,.]+%?\.?/gi
    ];

    // Apply all patterns
    genericPatterns.forEach(pattern => {
        filtered = filtered.replace(pattern, '');
    });

    // Clean up: remove extra spaces, leading/trailing punctuation
    filtered = filtered
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .replace(/^[\s.,;:]+|[\s.,;:]+$/g, '')  // Remove leading/trailing punctuation
        .trim();

    // Check if there's meaningful content left (more than 10 words)
    const wordCount = filtered.split(/\s+/).filter(w => w.length > 0).length;
    const hasMeaningfulContent = wordCount > 10;

    return {
        filteredText: filtered,
        hasMeaningfulContent
    };
};

export default function DailyTrackingPage() {
    const [dailyData, setDailyData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [newsTab, setNewsTab] = useState('market');
    const [selectedDate, setSelectedDate] = useState(null);

    // Stock recommendation filters

    // Stock recommendation filters - Internal state for user overrides
    const [recFromDateInput, setRecFromDateInput] = useState('');
    const [recToDateInput, setRecToDateInput] = useState('');
    const [recBrokerFilter, setRecBrokerFilter] = useState('all');
    const [recTickerFilter, setRecTickerFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });



    // Brokers filter (shared for Overview and News)


    // Brokers filter (shared for Overview and News)
    const [marketBrokerFilter, setMarketBrokerFilter] = useState('all');

    // Price data for recommendations
    const [priceData, setPriceData] = useState({});

    // Load daily report data from R2
    useEffect(() => {


        fetch(`/api/daily-report?t=${new Date().getTime()}`)
            .then(res => res.json())
            .then(data => {
                console.log('Daily report data loaded:', data);
                setDailyData(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Failed to load daily data:", err);
                setIsLoading(false);
            });
    }, []);

    // Process data: flatten all reports from all brokers
    const allReports = useMemo(() => {
        if (!dailyData) return [];

        const reports = [];
        Object.entries(dailyData).forEach(([brokerKey, brokerReports]) => {
            if (typeof brokerReports === 'object') {
                Object.entries(brokerReports).forEach(([reportId, report]) => {
                    if (report && report.info_of_report) {
                        // Adjust weekend dates to Friday
                        const originalDate = report.info_of_report.date_of_issue;
                        const adjustedDate = adjustToWeekday(originalDate);

                        reports.push({
                            id: reportId,
                            broker: brokerKey,
                            ...report,
                            info_of_report: {
                                ...report.info_of_report,
                                date_of_issue: adjustedDate
                            }
                        });
                    }
                });
            }
        });

        // Sort by date descending
        reports.sort((a, b) => {
            const dateA = a.info_of_report?.date_of_issue || '';
            const dateB = b.info_of_report?.date_of_issue || '';
            return dateB.localeCompare(dateA);
        });

        return reports;
    }, [dailyData]);

    // Get unique dates
    const uniqueDates = useMemo(() => {
        return [...new Set(allReports.map(r => r.info_of_report?.date_of_issue))]
            .filter(Boolean)
            .slice()
            .sort((a, b) => b.localeCompare(a)); // Descending
    }, [allReports]);

    // Store VNINDEX prices for heatmap T+1 calculation
    const [vnindexPrices, setVnindexPrices] = useState({});

    // Fetch VNINDEX history for the displayed dates
    useEffect(() => {
        if (uniqueDates.length === 0) return;

        // Fetch up to 15 recent dates to have enough for T+1 comparison
        const datesToFetch = uniqueDates.slice(0, 15).join(',');

        fetch(`/api/vnindex-history?dates=${datesToFetch}`)
            .then(res => res.json())
            .then(data => {
                if (data.prices) {
                    const priceMap = {};
                    Object.keys(data.prices).forEach(key => {
                        const datePart = key.split('_')[1];
                        if (datePart && data.prices[key].priceAtCall) {
                            priceMap[datePart] = data.prices[key].priceAtCall;
                        }
                    });
                    setVnindexPrices(priceMap);
                }
            })
            .catch(err => console.error("Failed to fetch VNINDEX history:", err));
    }, [uniqueDates]);

    // Set default selected date to latest
    // Derived active date (matches useEffect logic but clean)
    const activeDate = useMemo(() => {
        if (selectedDate && uniqueDates.includes(selectedDate)) return selectedDate;
        return uniqueDates.length > 0 ? uniqueDates[0] : null;
    }, [selectedDate, uniqueDates]);



    // Calculate defaults for Recommendation Dates
    const { defaultFromDate, defaultToDate } = useMemo(() => {
        if (uniqueDates.length === 0) return { defaultFromDate: '', defaultToDate: '' };

        const newestDateStr = uniqueDates[0];
        const newestDate = parseDateYYMMDD(newestDateStr);
        if (!newestDate) return { defaultFromDate: '', defaultToDate: '' };

        const defTo = formatDateToYYYYMMDD(newestDate);

        // From date = T-5 working days
        let fromDate = new Date(newestDate);
        let workingDaysBack = 0;
        while (workingDaysBack < 5) {
            fromDate.setDate(fromDate.getDate() - 1);
            const dayOfWeek = fromDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
                workingDaysBack++;
            }
        }
        const defFrom = formatDateToYYYYMMDD(fromDate);

        return { defaultFromDate: defFrom, defaultToDate: defTo };
    }, [uniqueDates]);

    const activeRecFromDate = recFromDateInput || defaultFromDate;
    const activeRecToDate = recToDateInput || defaultToDate;

    // Get unique brokers
    const uniqueBrokers = useMemo(() => {
        return [...new Set(allReports.map(r => r.broker))].sort();
    }, [allReports]);

    // Filter reports for selected date
    const reportsForDate = useMemo(() => {
        if (!activeDate) return allReports.slice(0, 10);
        return allReports.filter(r => r.info_of_report?.date_of_issue === activeDate);
    }, [allReports, activeDate]);

    // Aggregate market news for selected date
    const aggregatedNews = useMemo(() => {
        const news = { global: [], macro: [], market: [], sector: [], companies: [], other: [] };

        reportsForDate.forEach(r => {
            const mn = r.market_news;
            if (!mn) return;

            const broker = r.info_of_report?.issued_company || r.broker;

            ['global', 'macro', 'market', 'sector', 'companies', 'other'].forEach(key => {
                if (mn[key] && Array.isArray(mn[key])) {
                    mn[key].forEach(item => {
                        if (!shouldExcludeNewsItem(item, key)) {
                            news[key].push({ text: item, broker });
                        }
                    });
                }
            });
        });

        return news;
    }, [reportsForDate]);

    // Build sentiment heatmap data
    const sentimentHeatmap = useMemo(() => {
        const heatmap = {};

        // Get last 14 dates and reverse to show oldest first (left to right)
        // uniqueDates is descending (Newest first).
        const dates = uniqueDates.slice(0, 14).reverse();

        // Filter brokers: only show those that have data on ANY of the displayed dates
        const activeBrokers = uniqueBrokers.filter(broker => {
            return dates.some(date =>
                allReports.some(r => r.broker === broker && r.info_of_report?.date_of_issue === date)
            );
        });

        // 1. Build broker data
        activeBrokers.forEach(broker => {
            heatmap[broker] = {};
            dates.forEach((date, i) => {
                const report = allReports.find(r => r.broker === broker && r.info_of_report?.date_of_issue === date);
                heatmap[broker][date] = {
                    sentiment: report?.market_view?.sentiment || null,
                    target: report?.market_view?.vnindex_target || null
                    // Revert return display
                };
            });
        });

        // 2. Build Actual VN-Index T+1 row data
        // For each date 'd', we want the Actual Close of 'd+1' (next trading day) AND 'd' (current day) to calc return.
        const actuals = {};
        dates.forEach(date => {
            const idx = uniqueDates.indexOf(date);

            // Current Date Close directly from new vnindexPrices state
            const currentClose = vnindexPrices[date] || null;

            // Next Date Close (T+1)
            let nextClose = null;
            if (idx > 0) {
                const nextDate = uniqueDates[idx - 1];
                nextClose = vnindexPrices[nextDate] || null;
            }

            if (nextClose) {
                // Calculate return if we have current
                let retStr = '';
                let retVal = 0;
                if (currentClose) {
                    const diff = (nextClose - currentClose) / currentClose * 100;
                    retVal = diff;
                    retStr = diff > 0 ? `(+${diff.toFixed(2)}%)` : `(${diff.toFixed(2)}%)`;
                }

                actuals[date] = {
                    value: nextClose,
                    returnText: retStr,
                    returnVal: retVal,
                    hasData: true
                };
            } else {
                actuals[date] = { hasData: false };
            }
        });

        // 3. Build Summary & Accuracy data
        const summary = {};
        const accuracy = {};

        dates.forEach(date => {
            let pos = 0, neu = 0, neg = 0;
            let total = 0;

            // Tally sentiments
            activeBrokers.forEach(broker => {
                const rawSentiment = heatmap[broker][date]?.sentiment;
                if (!rawSentiment) return;

                const sentiment = rawSentiment.toLowerCase();
                if (sentiment === 'positive') pos++;
                else if (sentiment === 'neutral') neu++;
                else if (sentiment === 'negative') neg++;

                total++;
            });

            if (total > 0) {
                // Determine dominant sentiment
                let dominant = 'NEUTRAL';
                let maxCount = neu;

                if (pos > maxCount) { dominant = 'POSITIVE'; maxCount = pos; }
                if (neg > maxCount) { dominant = 'NEGATIVE'; maxCount = neg; }
                // Tie breaker: if positive == negative, default to neutral
                if (pos === neg && pos > neu) { dominant = 'NEUTRAL'; }

                const percent = Math.round((maxCount / total) * 100);

                summary[date] = {
                    pos, neu, neg,
                    total,
                    dominant,
                    percent
                };

                // Calculate Accuracy if VNI (+1) data exists
                const actual = actuals[date];
                if (actual && actual.hasData) {
                    const ret = actual.returnVal;
                    let isCorrect = false;

                    if (dominant === 'POSITIVE' && ret > 0.25) isCorrect = true;
                    else if (dominant === 'NEGATIVE' && ret < -0.25) isCorrect = true;
                    else if (dominant === 'NEUTRAL' && ret >= -0.25 && ret <= 0.25) isCorrect = true;

                    accuracy[date] = {
                        evaluated: true,
                        isCorrect
                    };
                } else {
                    accuracy[date] = { evaluated: false };
                }
            } else {
                summary[date] = null;
                accuracy[date] = { evaluated: false };
            }
        });

        return {
            dates,
            brokers: activeBrokers,
            data: heatmap,
            summary,
            accuracy,
            actuals
        };
    }, [uniqueDates, uniqueBrokers, allReports, vnindexPrices]);


    // Get stock recommendations (from ALL reports, filtered by date range and broker)
    const stockRecommendations = useMemo(() => {
        const recs = [];
        allReports.forEach(r => {
            const sr = r.stock_recommendation?.recommendations;
            if (sr && Array.isArray(sr)) {
                sr.forEach(rec => {
                    // Build investment summary (thesis + viewpoint)
                    const thesisParts = [];
                    if (rec.investment_thesis?.length > 0) {
                        thesisParts.push(...rec.investment_thesis);
                    }
                    if (rec.analyst_viewpoint?.viewpoint) {
                        thesisParts.push(rec.analyst_viewpoint.viewpoint);
                    }
                    const investmentSummary = thesisParts.join(' ');

                    // Get forecast - only if it's meaningful (string with >10 words)
                    let forecast = rec.forecast || null;
                    let forecastWordCount = 0;
                    if (forecast) {
                        const forecastStr = typeof forecast === 'string' ? forecast : JSON.stringify(forecast);
                        forecastWordCount = forecastStr.trim().split(/\s+/).filter(w => w.length > 0).length;
                        if (forecastWordCount <= 10) {
                            forecast = null; // Ignore short forecasts like "-1.7%"
                        }
                    }

                    // Use the new comprehensive filter function
                    const filterResult = filterGenericRecommendations(investmentSummary);
                    const meaningfulSummary = filterResult.filteredText;
                    const hasMeaningfulContent = filterResult.hasMeaningfulContent;

                    // Must have ticker, target_price, and EITHER meaningful summary OR forecast
                    // If the summary only contained generic text (hasMeaningfulContent=false), we need forecast to keep it
                    const hasContent = hasMeaningfulContent || (forecast && forecast.length > 0);

                    if (rec.ticker && rec.target_price && hasContent) {
                        const reportDate = r.info_of_report?.date_of_issue;
                        const brokerName = r.info_of_report?.issued_company || r.broker;

                        recs.push({
                            ...rec,
                            broker: brokerName,
                            date: reportDate,
                            investmentSummary: meaningfulSummary, // Use filtered version
                            forecast
                        });
                    }
                });
            }
        });

        // Apply filters
        return recs.filter(rec => {
            // Date filter
            if (activeRecFromDate && rec.date) {
                const recDateObj = parseDateYYMMDD(rec.date);
                const fromDateObj = new Date(activeRecFromDate);
                if (recDateObj && recDateObj < fromDateObj) return false;
            }
            if (activeRecToDate && rec.date) {
                const recDateObj = parseDateYYMMDD(rec.date);
                const toDateObj = new Date(activeRecToDate);
                if (recDateObj && recDateObj > toDateObj) return false;
            }

            // Broker filter
            if (recBrokerFilter !== 'all' && rec.broker) {
                if (!rec.broker.toLowerCase().includes(recBrokerFilter.toLowerCase())) return false;
            }

            // Ticker filter
            if (recTickerFilter && rec.ticker) {
                if (!rec.ticker.toLowerCase().includes(recTickerFilter.toLowerCase())) return false;
            }

            return true;
        });
    }, [allReports, activeRecFromDate, activeRecToDate, recBrokerFilter, recTickerFilter]);

    // --- SORTING ADDITION ---
    // 1. Process Recommendations with Calculated Fields for Sorting
    const processedRecs = useMemo(() => {
        return stockRecommendations.map(rec => {
            // Helper to parse target price
            let targetPriceVal = 0;
            const targetString = rec.target_price;
            if (typeof targetString === 'string') {
                let cleanStr = targetString.replace(/[VNDđ,\s]/gi, '');
                const rangeMatch = cleanStr.match(/^(\d+(?:\.\d+)?)\s*[-–~]\s*(\d+(?:\.\d+)?)$/);
                if (rangeMatch) {
                    let low = parseFloat(rangeMatch[1]);
                    let high = parseFloat(rangeMatch[2]);
                    if (low < 1000) low *= 1000;
                    if (high < 1000) high *= 1000;
                    targetPriceVal = (low + high) / 2;
                } else {
                    targetPriceVal = parseFloat(cleanStr);
                    if (targetPriceVal && targetPriceVal < 1000) targetPriceVal *= 1000;
                }
            } else if (typeof targetString === 'number') {
                targetPriceVal = targetString;
                if (targetPriceVal < 1000) targetPriceVal *= 1000;
            }

            const priceKey = `${rec.ticker}_${rec.date}`;
            const prices = priceData[priceKey] || {};
            // FIX: Match keys returned by lib/data.js (priceAtCall, priceNow)
            const callPrice = prices.priceAtCall || 0;
            const currentPrice = prices.priceNow || 0;

            // Derived
            const upsideAtCall = (targetPriceVal && callPrice) ? ((targetPriceVal - callPrice) / callPrice * 100) : null;
            const upsideNow = (targetPriceVal && currentPrice) ? ((targetPriceVal - currentPrice) / currentPrice * 100) : null;
            const performance = (currentPrice && callPrice) ? ((currentPrice - callPrice) / callPrice * 100) : null;

            return {
                ...rec,
                targetPriceVal, // Numeric target used for sorting and calcs
                currentPrice,
                callPrice,
                upsideAtCall,
                upsideNow,
                performance
            };
        });
    }, [stockRecommendations, priceData]);

    // 2. Sort Logic
    const sortedRecs = useMemo(() => {
        let sortable = [...processedRecs];
        if (sortConfig.key) {
            sortable.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];

                // Handle nulls/undefined (push to bottom)
                if (valA === null || valA === undefined) return 1;
                if (valB === null || valB === undefined) return -1;

                if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                }

                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return sortable;
    }, [processedRecs, sortConfig]);

    const requestSort = (key) => {
        let direction = 'desc';
        // If sorting same key, toggle. Otherwise default desc (good for nums/dates)
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        return null; // Icons removed per request
    };

    // Fetch price data for stock recommendations
    useEffect(() => {
        if (stockRecommendations.length === 0) return;

        const tickers = stockRecommendations.map(r => r.ticker);
        const callDates = stockRecommendations.map(r => r.date);

        fetch('/api/ticker-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickers, callDates })
        })
            .then(res => res.json())
            .then(data => {
                console.log('Price data loaded:', data);
                setPriceData(data);
            })
            .catch(err => console.error('Failed to load price data:', err));
    }, [stockRecommendations]);

    return (
        <>
            <Header title="Daily Tracking" />

            <main className="daily-tracking-grid">
                {/* LEFT COLUMN */}
                <div className="daily-left-column">
                    {/* Market Overview */}
                    <section className="card daily-card">
                        <div className="daily-card-header">
                            <h3 className="daily-card-title">Market Overview</h3>
                            <div className="filter-group">
                                <div className="date-selector">
                                    <label>Date:</label>
                                    <input
                                        type="date"
                                        value={(() => {
                                            if (!activeDate) return '';
                                            const d = parseDateYYMMDD(activeDate);
                                            return formatDateToYYYYMMDD(d);
                                        })()}
                                        min={(() => {
                                            const oldest = uniqueDates[uniqueDates.length - 1];
                                            const d = parseDateYYMMDD(oldest);
                                            return formatDateToYYYYMMDD(d);
                                        })()}
                                        max={(() => {
                                            const newest = uniqueDates[0];
                                            const d = parseDateYYMMDD(newest);
                                            return formatDateToYYYYMMDD(d);
                                        })()}
                                        onChange={e => {
                                            const val = e.target.value; // YYYY-MM-DD
                                            if (!val) return;
                                            const [year, month, day] = val.split('-');
                                            const yy = year.slice(2);
                                            const yymmdd = `${yy}${month}${day}`;

                                            if (uniqueDates.includes(yymmdd)) {
                                                setSelectedDate(yymmdd);
                                            } else {
                                                alert(`No data available for ${val}`);
                                                // Force re-render to revert input value if needed (mostly auto-handled by React controlled component)
                                            }
                                        }}
                                        className="date-input"
                                    />
                                </div>
                                <div className="broker-selector">
                                    <label>Broker:</label>
                                    <select
                                        value={marketBrokerFilter}
                                        onChange={e => setMarketBrokerFilter(e.target.value)}
                                        className="date-select"
                                    >
                                        <option value="all">All Brokers</option>
                                        {uniqueBrokers.map(broker => (
                                            <option key={broker} value={formatBrokerName(broker)}>{formatBrokerName(broker)}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="daily-card-content">
                            {isLoading ? (
                                <div className="placeholder-text">Loading...</div>
                            ) : reportsForDate.length === 0 ? (
                                <div className="placeholder-text">No data available</div>
                            ) : (
                                <div className="market-views-list">
                                    {reportsForDate
                                        .filter(r => marketBrokerFilter === 'all' || formatBrokerName(r.info_of_report?.issued_company || r.broker) === marketBrokerFilter)
                                        .map(r => (
                                            <div key={r.id} className="market-view-item">
                                                {/* Broker Header */}
                                                <div className="market-view-header">
                                                    <span className="broker-name" style={{ color: 'var(--accent)' }}>{formatBrokerName(r.info_of_report?.issued_company || r.broker)} Research</span>
                                                    <span className={`sentiment-badge ${getSentimentBadgeClass(r.market_view?.sentiment)}`}>
                                                        {r.market_view?.sentiment || 'N/A'}
                                                    </span>
                                                </div>

                                                {/* Market View Section */}
                                                {(r.market_view?.summary_commentary || r.market_view?.market_viewpoint) && (
                                                    <div className="section-block">
                                                        <div className="section-title">Market view</div>
                                                        {r.market_view?.summary_commentary && (
                                                            <p className="section-text">{r.market_view.summary_commentary}</p>
                                                        )}
                                                        {r.market_view?.market_viewpoint && r.market_view.market_viewpoint !== r.market_view.summary_commentary && (
                                                            <p className="section-text">{r.market_view.market_viewpoint}</p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Analyst View Section */}
                                                {r.analyst_viewpoints?.length > 0 && (
                                                    <div className="section-block">
                                                        <div className="section-title">Analyst view</div>
                                                        {r.analyst_viewpoints?.slice(0, 2).map((vp, idx) => (
                                                            <p key={idx} className="section-text">{vp.viewpoint}</p>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Other Analysis Section */}
                                                {r.featured_analysis?.filter(fa =>
                                                    !fa.topic?.toLowerCase().includes('bsc30') &&
                                                    !fa.topic?.toLowerCase().includes('bsc50')
                                                ).length > 0 && (
                                                        <div className="section-block">
                                                            <div className="section-title">Other analysis</div>
                                                            {r.featured_analysis?.filter(fa =>
                                                                !fa.topic?.toLowerCase().includes('bsc30') &&
                                                                !fa.topic?.toLowerCase().includes('bsc50')
                                                            ).slice(0, 2).map((fa, idx) => (
                                                                <p key={`fa-${idx}`} className="section-text">
                                                                    <strong>{fa.topic}:</strong> {fa.summary}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}

                                                {/* Upcoming Events Section */}
                                                {r.upcoming_events?.length > 0 && (
                                                    <div className="section-block">
                                                        <div className="section-title">Upcoming events</div>
                                                        {r.upcoming_events.slice(0, 3).map((evt, idx) => {
                                                            // Format date as DD/MM/YYYY or MM/YYYY
                                                            let dateStr = '';
                                                            if (evt.date) {
                                                                const parts = evt.date.split('-');
                                                                if (parts.length === 3) {
                                                                    dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
                                                                } else if (parts.length === 2) {
                                                                    dateStr = `${parts[1]}/${parts[0]}`;
                                                                } else {
                                                                    dateStr = evt.date;
                                                                }
                                                            }
                                                            return (
                                                                <p key={idx} className="section-text event-text">
                                                                    {dateStr && <span className="event-date">{dateStr}</span>}
                                                                    {dateStr && ' - '}
                                                                    {evt.event}
                                                                </p>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Market News */}
                    <section className="card daily-card">
                        <div className="daily-card-header">
                            <h3 className="daily-card-title">Market News</h3>
                            <div className="tab-group">
                                {['macro', 'market', 'sector', 'companies', 'global'].map(tab => (
                                    <button
                                        key={tab}
                                        className={`tab-btn ${newsTab === tab ? 'active' : ''}`}
                                        onClick={() => setNewsTab(tab)}
                                    >
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="daily-card-content news-list">
                            {aggregatedNews[newsTab]?.length > 0 ? (
                                (() => {
                                    const filtered = aggregatedNews[newsTab].filter(item =>
                                        marketBrokerFilter === 'all' || formatBrokerName(item.broker) === marketBrokerFilter
                                    );

                                    // Group by broker
                                    const grouped = {};
                                    const brokerOrder = [];

                                    filtered.slice(0, 15).forEach(item => {
                                        const bName = formatBrokerName(item.broker);
                                        if (!grouped[bName]) {
                                            grouped[bName] = [];
                                            brokerOrder.push(bName);
                                        }
                                        grouped[bName].push(item);
                                    });

                                    return brokerOrder.map(brokerName => (
                                        <div key={brokerName} className="market-view-item" style={{ marginBottom: '12px', borderBottom: 'none', paddingBottom: '0' }}>
                                            {/* Show header if "All Brokers" is selected OR if we want to confirm the source even when filtered */}
                                            {/* User request implies grouping headers: "ACBS Research" then list */}
                                            <div className="market-view-header" style={{ marginBottom: '4px' }}>
                                                <span className="broker-name" style={{ color: 'var(--accent)' }}>
                                                    {brokerName} Research
                                                </span>
                                            </div>
                                            <div className="section-block" style={{ marginTop: '0' }}>
                                                <ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: 0 }}>
                                                    {grouped[brokerName].map((item, idx) => (
                                                        <li key={idx} className="section-text" style={{ marginBottom: '4px' }}>
                                                            {item.text}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    ));
                                })()
                            ) : (
                                <div className="placeholder-text">No {newsTab} news available</div>
                            )}
                        </div>
                    </section>
                </div>

                {/* RIGHT COLUMN */}
                <div className="daily-right-column">
                    {/* Market Sentiment Heatmap */}
                    <section className="card daily-card">
                        <div className="daily-card-header">
                            <h3 className="daily-card-title" style={{ color: 'var(--accent)' }}>Market Sentiment</h3>
                        </div>
                        <div className="heatmap-container">
                            {isLoading ? (
                                <div className="placeholder-text">Loading...</div>
                            ) : (
                                <>
                                    <table className="heatmap-table">
                                        <thead>
                                            <tr>
                                                <th>Broker</th>
                                                {sentimentHeatmap.dates.map(d => (
                                                    <th key={d}>{formatDateDisplay(d).slice(0, 5)}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sentimentHeatmap.brokers.map(broker => (
                                                <tr key={broker}>
                                                    <td className="broker-cell">{broker.toUpperCase()}</td>
                                                    {sentimentHeatmap.dates.map(d => {
                                                        const cellData = sentimentHeatmap.data[broker]?.[d];
                                                        return (
                                                            <td
                                                                key={d}
                                                                className="heatmap-cell"
                                                                style={{
                                                                    backgroundColor: getSentimentColor(cellData?.sentiment),
                                                                }}
                                                                title={cellData?.sentiment || 'No data'}
                                                            >
                                                                {cellData?.target && (
                                                                    <span className="cell-target">{formatTarget(cellData.target)}</span>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}

                                            {/* Spacer Row */}
                                            <tr style={{ height: '10px' }}><td colSpan={sentimentHeatmap.dates.length + 1}></td></tr>

                                            {/* Summary Row */}
                                            <tr className="summary-row">
                                                <td className="broker-cell" style={{ color: '#fff', borderRight: '1px solid rgba(255,255,255,0.1)', lineHeight: '1.2' }}>
                                                    Summary
                                                </td>
                                                {sentimentHeatmap.dates.map(d => {
                                                    const data = sentimentHeatmap.summary[d];
                                                    const accData = sentimentHeatmap.accuracy[d];

                                                    if (!data) return <td key={`sum-${d}`} className="heatmap-cell" style={{ color: '#888' }}>-</td>;

                                                    // Determine Background Color based on Accuracy
                                                    let bgColor = 'transparent';
                                                    let textColor = '#fff';
                                                    let dimTextColor = 'rgba(255,255,255,0.8)';
                                                    let domColor = '#ccc'; // Default color for text if not colored bg

                                                    if (accData && accData.evaluated) {
                                                        bgColor = accData.isCorrect ? '#00ff7f' : '#ff4444';
                                                        textColor = '#000'; // black text for better contrast on green/red
                                                        dimTextColor = 'rgba(0,0,0,0.7)';
                                                        domColor = '#000';
                                                    } else {
                                                        // If not evaluated (no T+1 data yet), just color the text
                                                        if (data.dominant === 'POSITIVE') domColor = '#00ff7f';
                                                        if (data.dominant === 'NEGATIVE') domColor = '#ff4444';
                                                    }

                                                    return (
                                                        <td key={`sum-${d}`} className="heatmap-cell" style={{
                                                            fontSize: '11px',
                                                            verticalAlign: 'middle',
                                                            lineHeight: '1.2',
                                                            backgroundColor: bgColor,
                                                            color: textColor
                                                        }}>
                                                            <div style={{ color: dimTextColor }}>{data.pos}/{data.neu}/{data.neg}</div>
                                                            <div style={{ color: domColor, fontWeight: 'bold', fontSize: '10px' }}>
                                                                {data.dominant.charAt(0) + data.dominant.slice(1).toLowerCase()} ({data.percent}%)
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                            </tr>

                                            {/* Comparison Row: VNINDEX T+1 (At Bottom) */}
                                            <tr className="comparison-row" style={{ borderTop: 'none' }}>
                                                <td className="broker-cell" style={{ color: '#fff', borderRight: '1px solid rgba(255,255,255,0.1)', lineHeight: '1.2' }}>
                                                    VNI (+1)
                                                </td>
                                                {sentimentHeatmap.dates.map(d => {
                                                    const data = sentimentHeatmap.actuals[d];
                                                    let bgColor = 'transparent';
                                                    let textColor = '#ccc';
                                                    if (data.hasData && typeof data.returnVal === 'number') {
                                                        if (data.returnVal > 0.25) {
                                                            bgColor = '#00ff7f';
                                                            textColor = '#000';
                                                        } else if (data.returnVal < -0.25) {
                                                            bgColor = '#ff4444';
                                                            textColor = '#000';
                                                        } else {
                                                            bgColor = '#444'; // Neutral
                                                            textColor = '#fff';
                                                        }
                                                    }

                                                    return (
                                                        <td key={d} className="heatmap-cell" style={{
                                                            backgroundColor: bgColor,
                                                            color: textColor,
                                                            fontSize: '11px',
                                                            fontWeight: 'bold',
                                                            verticalAlign: 'middle'
                                                        }}>
                                                            {data.hasData ? (
                                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: '1.2' }}>
                                                                    <span>{formatNumber(data.value)}</span>
                                                                    {data.returnText && <span style={{ fontSize: '10px', opacity: 0.8 }}>{data.returnText}</span>}
                                                                </div>
                                                            ) : '-'}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        </tbody>
                                    </table>
                                    <div style={{ fontSize: '8px', color: '#888', marginTop: '8px', textAlign: 'left', fontStyle: 'normal' }}>
                                        * Summary: Positive/Neutral/Negative. Accuracy is evaluated by comparing the Dominant sentiment to the VNI (+1) return.<br />
                                        * VNI (+1) Performance: Green (&gt; +0.25%), Red (&lt; -0.25%), Neutral (+/- 0.25%)
                                    </div>
                                </>
                            )}
                        </div>
                    </section>

                    {/* Stock Recommendations */}
                    <section className="card daily-card">
                        <div className="daily-card-header">
                            <h3 className="daily-card-title" style={{ color: 'var(--accent)' }}>Stock Recommendations</h3>
                        </div>

                        {/* Filters */}
                        <div className="rec-filters">
                            <label>From:</label>
                            <input
                                type="date"
                                className="date-input"
                                value={activeRecFromDate}
                                onChange={(e) => setRecFromDateInput(e.target.value)}
                            />
                            <label>To:</label>
                            <input
                                type="date"
                                className="date-input"
                                value={activeRecToDate}
                                onChange={(e) => setRecToDateInput(e.target.value)}
                            />
                            <label>Broker:</label>
                            <select
                                className="broker-select"
                                value={recBrokerFilter}
                                onChange={(e) => setRecBrokerFilter(e.target.value)}
                            >
                                <option value="all">All Brokers</option>
                                {uniqueBrokers.map(b => (
                                    <option key={b} value={b}>{formatBrokerName(b)}</option>
                                ))}
                            </select>

                            <label>Ticker:</label>
                            <input
                                type="text"
                                className="date-input"
                                style={{ width: '80px' }}
                                placeholder="Ticker"
                                value={recTickerFilter}
                                onChange={(e) => setRecTickerFilter(e.target.value)}
                            />

                            <button
                                className="search-btn"
                                onClick={() => {
                                    // Log current filter values for debugging
                                    console.log('Search clicked with filters:', {
                                        ticker: recTickerFilter,
                                        from: activeRecFromDate,
                                        to: activeRecToDate,
                                        broker: recBrokerFilter
                                    });

                                    // Trigger re-render by updating sort config (same values, but forces dependency update)
                                    setSortConfig(prev => ({ ...prev }));
                                }}
                            >
                                Search
                            </button>
                        </div>

                        {/* Recommendations Table */}
                        <div className="rec-table-wrapper">
                            <table className="rec-table">
                                <thead>
                                    <tr>
                                        <th style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => requestSort('date')}>Date {getSortIcon('date')}</th>
                                        <th style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => requestSort('ticker')}>Ticker {getSortIcon('ticker')}</th>
                                        <th style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => requestSort('broker')}>Broker {getSortIcon('broker')}</th>
                                        <th style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => requestSort('recommendation')}>Call {getSortIcon('recommendation')}</th>
                                        <th style={{ color: 'var(--accent)', cursor: 'pointer', textAlign: 'center' }} onClick={() => requestSort('targetPriceVal')}>Target<br />price {getSortIcon('targetPriceVal')}</th>
                                        <th style={{ color: 'var(--accent)', cursor: 'pointer', textAlign: 'center' }} onClick={() => requestSort('currentPrice')}>Current<br />price {getSortIcon('currentPrice')}</th>
                                        <th style={{ color: 'var(--accent)', cursor: 'pointer', textAlign: 'center' }} onClick={() => requestSort('upsideAtCall')}>Upside<br />(at call) {getSortIcon('upsideAtCall')}</th>
                                        <th style={{ color: 'var(--accent)', cursor: 'pointer', textAlign: 'center' }} onClick={() => requestSort('upsideNow')}>Upside<br />(now) {getSortIcon('upsideNow')}</th>
                                        <th style={{ color: 'var(--accent)', cursor: 'pointer', textAlign: 'center' }} onClick={() => requestSort('performance')}>Performance<br />(since call) {getSortIcon('performance')}</th>
                                        <th style={{ color: 'var(--accent)' }}>Update / Thesis</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr><td colSpan="10" className="loading-cell">Loading...</td></tr>
                                    ) : sortedRecs.length === 0 ? (
                                        <tr><td colSpan="10" className="loading-cell">No stock recommendations for this date</td></tr>
                                    ) : (
                                        sortedRecs.map((rec, idx) => {
                                            const callType = rec.recommendation?.toLowerCase() || '';
                                            let badgeClass = 'hold'; // default
                                            let badgeText = rec.recommendation || 'Neutral';

                                            // Determine Call based on upside at call (derived in processedRecs)
                                            // Normalize standard calls
                                            const normalizedCall = callType.toLowerCase();
                                            if (
                                                normalizedCall.includes('buy') ||
                                                normalizedCall.includes('mua') ||
                                                normalizedCall.includes('khả quan') ||
                                                normalizedCall.includes('outperform') ||
                                                normalizedCall.includes('accumulate') ||
                                                normalizedCall.includes('add') ||
                                                normalizedCall.includes('tăng tỷ trọng')
                                            ) {
                                                badgeClass = 'buy';
                                                badgeText = 'BUY';
                                            } else if (
                                                normalizedCall.includes('sell') ||
                                                normalizedCall.includes('bán') ||
                                                normalizedCall.includes('negative') ||
                                                normalizedCall.includes('reduce') ||
                                                normalizedCall.includes('underperform')
                                            ) {
                                                badgeClass = 'sell';
                                                badgeText = 'SELL';
                                            } else {
                                                badgeClass = 'hold';
                                                badgeText = 'NEUTRAL';
                                            }

                                            // Override with calculated upside if confident
                                            if (rec.upsideAtCall !== null && !isNaN(rec.upsideAtCall)) {
                                                if (rec.upsideAtCall >= 15) {
                                                    badgeClass = 'buy';
                                                    badgeText = 'BUY';
                                                } else if (rec.upsideAtCall <= -5) {
                                                    badgeClass = 'sell';
                                                    badgeText = 'SELL';
                                                }
                                                // If upside doesn't trigger buy/sell, keep the text-based neutral or whatever was matched
                                            }

                                            return (
                                                <tr key={idx}>
                                                    <td>{formatDateDisplay(rec.date)}</td>
                                                    <td><strong style={{ color: '#fff' }}>{rec.ticker}</strong></td>
                                                    <td>{formatBrokerName(rec.broker)}</td>
                                                    <td>
                                                        <span className={`call-badge ${badgeClass}`}>
                                                            {badgeText}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>{rec.targetPriceVal ? formatNumber(String(Math.round(rec.targetPriceVal))) : '-'}</td>
                                                    <td style={{ textAlign: 'center' }}>{rec.currentPrice ? formatNumber(String(Math.round(rec.currentPrice))) : '-'}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {rec.upsideAtCall !== null && !isNaN(rec.upsideAtCall) ? `${rec.upsideAtCall.toFixed(1)}%` : '-'}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {rec.upsideNow !== null && !isNaN(rec.upsideNow) ? `${rec.upsideNow.toFixed(1)}%` : '-'}
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {rec.performance !== null && !isNaN(rec.performance) ? `${rec.performance.toFixed(1)}%` : '-'}
                                                    </td>
                                                    <td className="thesis-cell" style={{ verticalAlign: 'top' }}>
                                                        {(() => {
                                                            // The data is already filtered in processing, but we apply the filter again for consistency
                                                            // This also handles any edge cases where data might bypass the processing filter
                                                            const filterResult = filterGenericRecommendations(rec.investmentSummary || '');
                                                            const filteredSummary = filterResult.filteredText;

                                                            return (
                                                                <>
                                                                    {filteredSummary && filteredSummary.length > 10 && (
                                                                        <div className="investment-summary">
                                                                            <div className="summary-title">Investment summary</div>
                                                                            <div className="summary-text">{filteredSummary}</div>
                                                                        </div>
                                                                    )}
                                                                    {rec.forecast && (
                                                                        <div className="investment-summary" style={{ marginTop: filteredSummary ? '8px' : '0' }}>
                                                                            <div className="summary-title">Forecast</div>
                                                                            <div className="summary-text">{typeof rec.forecast === 'object' ? JSON.stringify(rec.forecast) : rec.forecast}</div>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                </div>
            </main>
        </>
    );
}

