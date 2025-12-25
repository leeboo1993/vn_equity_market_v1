'use client';

import { useState, useMemo, useEffect } from 'react';
import Header from './components/Header';

// Helper functions
const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '-';
    // Handle YYMMDD format
    if (dateStr.length === 6) {
        const yy = dateStr.substring(0, 2);
        const mm = dateStr.substring(2, 4);
        const dd = dateStr.substring(4, 6);
        return `${dd}/${mm}/20${yy}`;
    }
    return dateStr;
};

const parseDateYYMMDD = (dateStr) => {
    if (!dateStr || dateStr.length !== 6) return null;
    const yy = parseInt(dateStr.substring(0, 2));
    const mm = parseInt(dateStr.substring(2, 4)) - 1;
    const dd = parseInt(dateStr.substring(4, 6));
    return new Date(2000 + yy, mm, dd);
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

// Format a number string with commas
const formatNumber = (numStr) => {
    if (!numStr) return '';
    // Remove existing formatting (dots, commas, spaces)
    const cleaned = numStr.replace(/[,.\s]/g, '');
    const num = parseInt(cleaned);
    if (isNaN(num)) return numStr;
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
    return name.trim();
};

export default function DailyTrackingPage() {
    const [dailyData, setDailyData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [newsTab, setNewsTab] = useState('market');
    const [selectedDate, setSelectedDate] = useState(null);

    // Stock recommendation filters
    const [recFromDate, setRecFromDate] = useState('');
    const [recToDate, setRecToDate] = useState('');
    const [recBrokerFilter, setRecBrokerFilter] = useState('all');

    // Price data for recommendations
    const [priceData, setPriceData] = useState({});

    // Load daily report data from R2
    useEffect(() => {
        setIsLoading(true);

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
        const dates = [...new Set(allReports.map(r => r.info_of_report?.date_of_issue))].filter(Boolean);
        dates.sort((a, b) => b.localeCompare(a)); // Descending
        return dates;
    }, [allReports]);

    // Set default selected date to latest
    useEffect(() => {
        if (uniqueDates.length > 0 && !selectedDate) {
            setSelectedDate(uniqueDates[0]);
        }
    }, [uniqueDates, selectedDate]);

    // Set default recommendation filter dates (To = newest, From = T-5 working days)
    useEffect(() => {
        if (uniqueDates.length > 0 && !recToDate && !recFromDate) {
            // To date = newest available
            const newestDate = parseDateYYMMDD(uniqueDates[0]);
            if (newestDate) {
                setRecToDate(newestDate.toISOString().split('T')[0]);

                // From date = T-5 working days from newest
                let fromDate = new Date(newestDate);
                let workingDaysBack = 0;
                while (workingDaysBack < 5) {
                    fromDate.setDate(fromDate.getDate() - 1);
                    const dayOfWeek = fromDate.getDay();
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
                        workingDaysBack++;
                    }
                }
                setRecFromDate(fromDate.toISOString().split('T')[0]);
            }
        }
    }, [uniqueDates, recToDate, recFromDate]);

    // Get unique brokers
    const uniqueBrokers = useMemo(() => {
        return [...new Set(allReports.map(r => r.broker))].sort();
    }, [allReports]);

    // Filter reports for selected date
    const reportsForDate = useMemo(() => {
        if (!selectedDate) return allReports.slice(0, 10);
        return allReports.filter(r => r.info_of_report?.date_of_issue === selectedDate);
    }, [allReports, selectedDate]);

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
                        news[key].push({ text: item, broker });
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
        const dates = uniqueDates.slice(0, 14).reverse();

        uniqueBrokers.forEach(broker => {
            heatmap[broker] = {};
            dates.forEach(date => {
                const report = allReports.find(r => r.broker === broker && r.info_of_report?.date_of_issue === date);
                heatmap[broker][date] = {
                    sentiment: report?.market_view?.sentiment || null,
                    target: report?.market_view?.vnindex_target || null
                };
            });
        });

        return { brokers: uniqueBrokers, dates, data: heatmap };
    }, [allReports, uniqueBrokers, uniqueDates]);

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

                    // Check if summary has enough words (>10 words to be useful)
                    const summaryWordCount = investmentSummary.trim().split(/\s+/).filter(w => w.length > 0).length;
                    const hasValidSummary = summaryWordCount > 10;

                    // Must have ticker, target_price, and a valid summary (forecast alone not enough)
                    const hasContent = hasValidSummary;

                    if (rec.ticker && rec.target_price && hasContent) {
                        const reportDate = r.info_of_report?.date_of_issue;
                        const brokerName = r.info_of_report?.issued_company || r.broker;

                        recs.push({
                            ...rec,
                            broker: brokerName,
                            date: reportDate,
                            investmentSummary,
                            forecast
                        });
                    }
                });
            }
        });

        // Apply filters
        return recs.filter(rec => {
            // Date filter
            if (recFromDate && rec.date) {
                const recDateObj = parseDateYYMMDD(rec.date);
                const fromDateObj = new Date(recFromDate);
                if (recDateObj && recDateObj < fromDateObj) return false;
            }
            if (recToDate && rec.date) {
                const recDateObj = parseDateYYMMDD(rec.date);
                const toDateObj = new Date(recToDate);
                if (recDateObj && recDateObj > toDateObj) return false;
            }

            // Broker filter
            if (recBrokerFilter !== 'all' && rec.broker) {
                if (!rec.broker.toLowerCase().includes(recBrokerFilter.toLowerCase())) return false;
            }

            return true;
        });
    }, [allReports, recFromDate, recToDate, recBrokerFilter]);

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
                            <div className="date-selector">
                                <label>Select Date:</label>
                                <select
                                    value={selectedDate || ''}
                                    onChange={e => setSelectedDate(e.target.value)}
                                    className="date-select"
                                >
                                    {uniqueDates.map(d => (
                                        <option key={d} value={d}>{formatDateDisplay(d)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="daily-card-content">
                            {isLoading ? (
                                <div className="placeholder-text">Loading...</div>
                            ) : reportsForDate.length === 0 ? (
                                <div className="placeholder-text">No data available</div>
                            ) : (
                                <div className="market-views-list">
                                    {reportsForDate.map(r => (
                                        <div key={r.id} className="market-view-item">
                                            <div className="market-view-header">
                                                <span className="broker-name">{r.info_of_report?.issued_company || r.broker}</span>
                                                <span className={`sentiment-badge ${getSentimentBadgeClass(r.market_view?.sentiment)}`}>
                                                    {r.market_view?.sentiment || 'N/A'}
                                                </span>
                                            </div>
                                            <p className="market-view-summary">
                                                {r.market_view?.summary_commentary || r.market_view?.market_viewpoint || 'No commentary'}
                                            </p>
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
                                aggregatedNews[newsTab].slice(0, 15).map((item, idx) => (
                                    <div key={idx} className="news-item">
                                        <span className="news-broker">[{item.broker}]</span>
                                        <span className="news-text">{item.text}</span>
                                    </div>
                                ))
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
                                    </tbody>
                                </table>
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
                                value={recFromDate}
                                onChange={(e) => setRecFromDate(e.target.value)}
                            />
                            <label>To:</label>
                            <input
                                type="date"
                                className="date-input"
                                value={recToDate}
                                onChange={(e) => setRecToDate(e.target.value)}
                            />
                            <label>Broker:</label>
                            <select
                                className="broker-select"
                                value={recBrokerFilter}
                                onChange={(e) => setRecBrokerFilter(e.target.value)}
                            >
                                <option value="all">All Brokers</option>
                                {uniqueBrokers.map(b => (
                                    <option key={b} value={b}>{b.toUpperCase()}</option>
                                ))}
                            </select>
                            <button
                                className="search-btn"
                                onClick={() => {
                                    // Filters are applied automatically via useMemo
                                    // This button is mainly for UX consistency
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
                                        <th style={{ color: 'var(--accent)' }}>Date</th>
                                        <th style={{ color: 'var(--accent)' }}>Ticker</th>
                                        <th style={{ color: 'var(--accent)' }}>Broker</th>
                                        <th style={{ color: 'var(--accent)' }}>Call</th>
                                        <th style={{ color: 'var(--accent)' }}>Target price</th>
                                        <th style={{ color: 'var(--accent)' }}>Upside (at call)</th>
                                        <th style={{ color: 'var(--accent)' }}>Current price</th>
                                        <th style={{ color: 'var(--accent)' }}>Upside (now)</th>
                                        <th style={{ color: 'var(--accent)' }}>Performance (since call)</th>
                                        <th style={{ color: 'var(--accent)' }}>Update / Thesis</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr><td colSpan="10" className="loading-cell">Loading...</td></tr>
                                    ) : stockRecommendations.length === 0 ? (
                                        <tr><td colSpan="10" className="loading-cell">No stock recommendations for this date</td></tr>
                                    ) : (
                                        stockRecommendations.map((rec, idx) => {
                                            const callType = rec.recommendation?.toLowerCase() || '';
                                            let badgeClass = 'hold'; // default
                                            let badgeText = rec.recommendation || 'Neutral';

                                            // Determine badge class based on recommendation text
                                            if (callType.includes('buy') || callType.includes('mua') || callType.includes('khả quan')) {
                                                badgeClass = 'buy';
                                                badgeText = 'BUY';
                                            } else if (callType.includes('sell') || callType.includes('bán') || callType === 'negative') {
                                                badgeClass = 'sell';
                                                badgeText = 'Sell';
                                            } else if (callType.includes('neutral') || callType.includes('hold') || callType.includes('trung lập')) {
                                                badgeClass = 'hold';
                                                badgeText = 'Neutral';
                                            }

                                            // Get price data for this recommendation
                                            const priceKey = `${rec.ticker}_${rec.date}`;
                                            const prices = priceData[priceKey] || {};
                                            const targetPrice = rec.target_price;
                                            const priceAtCall = prices.priceAtCall;
                                            const currentPrice = prices.priceNow;

                                            // Calculate metrics
                                            let upsideAtCall = null;
                                            let upsideNow = null;
                                            let performanceSinceCall = null;

                                            if (targetPrice && priceAtCall) {
                                                upsideAtCall = ((targetPrice - priceAtCall) / priceAtCall) * 100;
                                            }
                                            if (targetPrice && currentPrice) {
                                                upsideNow = ((targetPrice - currentPrice) / currentPrice) * 100;
                                            }
                                            if (currentPrice && priceAtCall) {
                                                performanceSinceCall = ((currentPrice - priceAtCall) / priceAtCall) * 100;
                                            }

                                            // Determine Call based on upside at call
                                            if (upsideAtCall !== null) {
                                                if (upsideAtCall >= 15) {
                                                    badgeClass = 'buy';
                                                    badgeText = 'BUY';
                                                } else if (upsideAtCall <= -5) {
                                                    badgeClass = 'sell';
                                                    badgeText = 'Sell';
                                                } else {
                                                    badgeClass = 'hold';
                                                    badgeText = 'Neutral';
                                                }
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
                                                    <td>{targetPrice ? formatNumber(String(targetPrice)) : '-'}</td>
                                                    <td className={upsideAtCall !== null && upsideAtCall >= 0 ? 'text-green' : 'text-red'}>
                                                        {upsideAtCall !== null ? `${upsideAtCall.toFixed(1)}%` : '-'}
                                                    </td>
                                                    <td>{currentPrice ? formatNumber(String(Math.round(currentPrice))) : '-'}</td>
                                                    <td className={upsideNow !== null && upsideNow >= 0 ? 'text-green' : 'text-red'}>
                                                        {upsideNow !== null ? `${upsideNow.toFixed(1)}%` : '-'}
                                                    </td>
                                                    <td className={performanceSinceCall !== null && performanceSinceCall >= 0 ? 'text-green' : 'text-red'}>
                                                        {performanceSinceCall !== null ? `${performanceSinceCall.toFixed(1)}%` : '-'}
                                                    </td>
                                                    <td className="thesis-cell">
                                                        {rec.investmentSummary && (
                                                            <div className="investment-summary">
                                                                <div className="summary-title">Investment summary</div>
                                                                <div className="summary-text">{rec.investmentSummary}</div>
                                                            </div>
                                                        )}
                                                        {rec.forecast && (
                                                            <div className="investment-summary" style={{ marginTop: rec.investmentSummary ? '8px' : '0' }}>
                                                                <div className="summary-title">Forecast</div>
                                                                <div className="summary-text">{typeof rec.forecast === 'object' ? JSON.stringify(rec.forecast) : rec.forecast}</div>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* Analyst Viewpoints */}
                    <section className="card daily-card">
                        <div className="daily-card-header">
                            <h3 className="daily-card-title" style={{ color: 'var(--accent)' }}>Analyst Viewpoints</h3>
                        </div>
                        <div className="viewpoints-list">
                            {reportsForDate.slice(0, 3).map(r => (
                                r.analyst_viewpoints?.slice(0, 2).map((vp, idx) => (
                                    <div key={`${r.id}-${idx}`} className="viewpoint-item">
                                        <div className="viewpoint-broker">{r.info_of_report?.issued_company || r.broker}</div>
                                        <div className="viewpoint-text">{vp.viewpoint}</div>
                                        {vp.backing_facts?.length > 0 && (
                                            <ul className="viewpoint-facts">
                                                {vp.backing_facts.slice(0, 2).map((f, i) => (
                                                    <li key={i}>{f}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}
