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
    if (s === 'positive') return '#4cd964'; // Match website green (softer)
    if (s === 'negative') return '#ff6b6b'; // Match website red (salmon)
    if (s === 'neutral') return '#555'; // Dark grey
    return 'transparent'; // Unknown = no color
};

const getSentimentBadgeClass = (sentiment) => {
    if (!sentiment) return 'neutral';
    const s = sentiment.toLowerCase();
    if (s === 'positive') return 'positive';
    if (s === 'negative') return 'negative';
    return 'neutral';
};

export default function DailyTrackingPage() {
    const [dailyData, setDailyData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [newsTab, setNewsTab] = useState('market');
    const [selectedDate, setSelectedDate] = useState(null);

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

    // Get stock recommendations
    const stockRecommendations = useMemo(() => {
        const recs = [];
        reportsForDate.forEach(r => {
            const sr = r.stock_recommendation?.recommendations;
            if (sr && Array.isArray(sr)) {
                sr.forEach(rec => {
                    if (rec.ticker) {
                        recs.push({
                            ...rec,
                            broker: r.info_of_report?.issued_company || r.broker,
                            date: r.info_of_report?.date_of_issue
                        });
                    }
                });
            }
        });
        return recs;
    }, [reportsForDate]);

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
                                                                <span className="cell-target">{cellData.target}</span>
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

                        {/* Recommendations Table */}
                        <div className="rec-table-wrapper">
                            <table className="rec-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Ticker</th>
                                        <th>Broker</th>
                                        <th>Call</th>
                                        <th>Target</th>
                                        <th>Thesis / Viewpoint</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr><td colSpan="6" className="loading-cell">Loading...</td></tr>
                                    ) : stockRecommendations.length === 0 ? (
                                        <tr><td colSpan="6" className="loading-cell">No stock recommendations for this date</td></tr>
                                    ) : (
                                        stockRecommendations.map((rec, idx) => (
                                            <tr key={idx}>
                                                <td>{formatDateDisplay(rec.date)}</td>
                                                <td><strong>{rec.ticker}</strong></td>
                                                <td>{rec.broker}</td>
                                                <td>
                                                    <span className={`call-badge ${rec.recommendation?.toLowerCase().includes('buy') ? 'buy' : rec.recommendation?.toLowerCase().includes('sell') ? 'sell' : 'hold'}`}>
                                                        {rec.recommendation || '-'}
                                                    </span>
                                                </td>
                                                <td>{rec.target_price || '-'}</td>
                                                <td className="thesis-cell">
                                                    {rec.investment_thesis?.length > 0
                                                        ? rec.investment_thesis.slice(0, 2).join('. ')
                                                        : rec.analyst_viewpoint?.viewpoint || '-'}
                                                </td>
                                            </tr>
                                        ))
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
