'use client';

import { useState, useMemo, useEffect } from 'react';
import Header from './components/Header';

// Helper functions
const formatDateDisplay = (dateStr) => {
    if (!dateStr || dateStr.length !== 6) return dateStr || '-';
    const yy = dateStr.substring(0, 2);
    const mm = dateStr.substring(2, 4);
    const dd = dateStr.substring(4, 6);
    return `${dd}/${mm}/20${yy}`;
};

const parseDateYYMMDD = (dateStr) => {
    if (!dateStr || dateStr.length !== 6) return null;
    const yy = parseInt(dateStr.substring(0, 2));
    const mm = parseInt(dateStr.substring(2, 4)) - 1;
    const dd = parseInt(dateStr.substring(4, 6));
    return new Date(2000 + yy, mm, dd);
};

const getCallType = (call) => {
    if (!call || call === 'No Rating') return 'No Rating';
    const c = call.toLowerCase();
    if (['buy', 'outperform', 'add', 'accumulate', 'overweight'].some(k => c.includes(k))) return 'Buy';
    if (['sell', 'underperform', 'reduce', 'underweight'].some(k => c.includes(k))) return 'Sell';
    return 'Hold';
};

export default function DailyTrackingPage() {
    const [reports, setReports] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [marketTab, setMarketTab] = useState('VN-Index');
    const [newsTab, setNewsTab] = useState('Macro');

    // Date range for recommendations (last 7 days by default)
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const formatInputDate = (d) => d.toISOString().split('T')[0];
    const [fromDate, setFromDate] = useState(formatInputDate(weekAgo));
    const [toDate, setToDate] = useState(formatInputDate(today));
    const [brokerFilter, setBrokerFilter] = useState('All Brokers');

    // Load reports
    useEffect(() => {
        setIsLoading(true);
        fetch(`/reports.json?t=${new Date().getTime()}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setReports(data.reverse());
                }
                setIsLoading(false);
            })
            .catch(err => {
                console.error("Failed to load reports:", err);
                setIsLoading(false);
            });
    }, []);

    // Get unique brokers
    const uniqueBrokers = useMemo(() => {
        return [...new Set(reports.map(r => r.info_of_report?.issued_company))]
            .filter(b => b && b.length < 15)
            .sort();
    }, [reports]);

    // Generate date range for heatmap (last 14 days)
    const dateRange = useMemo(() => {
        const dates = [];
        const now = new Date();
        for (let i = 13; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            dates.push({
                date: d,
                label: `${d.getDate()}/${d.getMonth() + 1}`
            });
        }
        return dates;
    }, []);

    // Calculate broker sentiment heatmap data
    const sentimentData = useMemo(() => {
        const brokerSentiment = {};

        reports.forEach(r => {
            const broker = r.info_of_report?.issued_company;
            const dateStr = r.info_of_report?.date_of_issue;
            if (!broker || !dateStr || broker.length > 15) return;

            const reportDate = parseDateYYMMDD(dateStr);
            if (!reportDate) return;

            const callType = getCallType(r.recommendation?.recommendation);

            if (!brokerSentiment[broker]) {
                brokerSentiment[broker] = {};
            }

            const dateKey = `${reportDate.getDate()}/${reportDate.getMonth() + 1}`;
            if (!brokerSentiment[broker][dateKey]) {
                brokerSentiment[broker][dateKey] = { buy: 0, sell: 0, hold: 0 };
            }

            if (callType === 'Buy') brokerSentiment[broker][dateKey].buy++;
            else if (callType === 'Sell') brokerSentiment[broker][dateKey].sell++;
            else if (callType === 'Hold') brokerSentiment[broker][dateKey].hold++;
        });

        return brokerSentiment;
    }, [reports]);

    // Filter recommendations by date range
    const filteredRecommendations = useMemo(() => {
        const from = new Date(fromDate);
        const to = new Date(toDate);
        to.setHours(23, 59, 59);

        return reports.filter(r => {
            const reportDate = parseDateYYMMDD(r.info_of_report?.date_of_issue);
            if (!reportDate) return false;

            const inDateRange = reportDate >= from && reportDate <= to;
            const matchesBroker = brokerFilter === 'All Brokers' ||
                r.info_of_report?.issued_company === brokerFilter;

            return inDateRange && matchesBroker;
        }).slice(0, 20); // Limit to 20 for performance
    }, [reports, fromDate, toDate, brokerFilter]);

    const getCellColor = (sentiment) => {
        if (!sentiment) return '#1a1a1a';
        const { buy, sell, hold } = sentiment;
        const total = buy + sell + hold;
        if (total === 0) return '#1a1a1a';

        const buyRatio = buy / total;
        const sellRatio = sell / total;

        if (buyRatio > 0.6) return '#00ff7f';
        if (sellRatio > 0.6) return '#ff4444';
        if (buyRatio > sellRatio) return '#228B22';
        if (sellRatio > buyRatio) return '#8B0000';
        return '#333';
    };

    return (
        <>
            <Header title="Daily Tracking" />

            <main className="daily-tracking-grid">
                {/* LEFT COLUMN */}
                <div className="daily-left-column">
                    {/* Market Overview */}
                    <section className="card daily-card">
                        <div className="daily-card-header">
                            <h3 className="daily-card-title">Market overview</h3>
                            <div className="tab-group">
                                {['VN-Index', 'DJIA', 'USD/VND', 'Interest rate'].map(tab => (
                                    <button
                                        key={tab}
                                        className={`tab-btn ${marketTab === tab ? 'active' : ''}`}
                                        onClick={() => setMarketTab(tab)}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="daily-card-content placeholder-text">
                            Charts or summary data will appear here.
                        </div>
                    </section>

                    {/* Market News */}
                    <section className="card daily-card">
                        <div className="daily-card-header">
                            <h3 className="daily-card-title">Market News</h3>
                            <div className="tab-group">
                                {['Macro', 'Market', 'Sector', 'Companies', 'Others'].map(tab => (
                                    <button
                                        key={tab}
                                        className={`tab-btn ${newsTab === tab ? 'active' : ''}`}
                                        onClick={() => setNewsTab(tab)}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="daily-card-content placeholder-text">
                            No data available
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
                            <table className="heatmap-table">
                                <thead>
                                    <tr>
                                        <th>Broker</th>
                                        {dateRange.map(d => (
                                            <th key={d.label}>{d.label}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.keys(sentimentData).slice(0, 12).map(broker => (
                                        <tr key={broker}>
                                            <td className="broker-cell">{broker}</td>
                                            {dateRange.map(d => (
                                                <td
                                                    key={d.label}
                                                    style={{
                                                        backgroundColor: getCellColor(sentimentData[broker]?.[d.label]),
                                                        minWidth: '40px',
                                                        height: '24px'
                                                    }}
                                                />
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
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
                                value={fromDate}
                                onChange={e => setFromDate(e.target.value)}
                                className="date-input"
                            />
                            <label>To:</label>
                            <input
                                type="date"
                                value={toDate}
                                onChange={e => setToDate(e.target.value)}
                                className="date-input"
                            />
                            <label>Broker:</label>
                            <select
                                value={brokerFilter}
                                onChange={e => setBrokerFilter(e.target.value)}
                                className="broker-select"
                            >
                                <option>All Brokers</option>
                                {uniqueBrokers.map(b => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                            </select>
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
                                        <th>Target price</th>
                                        <th>Upside (at call)</th>
                                        <th>Current price</th>
                                        <th>Upside (now)</th>
                                        <th>Performance</th>
                                        <th>Update / Thesis</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr><td colSpan="10" className="loading-cell">Loading...</td></tr>
                                    ) : filteredRecommendations.length === 0 ? (
                                        <tr><td colSpan="10" className="loading-cell">No recommendations in date range</td></tr>
                                    ) : (
                                        filteredRecommendations.map((r, idx) => {
                                            const callType = getCallType(r.recommendation?.recommendation);
                                            const upside = r.recommendation?.upside;
                                            const upsideAtCall = r.recommendation?.upside_at_call;
                                            const performance = r.recommendation?.performance_since_call;

                                            return (
                                                <tr key={r.id || idx}>
                                                    <td>{formatDateDisplay(r.info_of_report?.date_of_issue)}</td>
                                                    <td><strong>{r.info_of_report?.ticker}</strong></td>
                                                    <td>{r.info_of_report?.issued_company}</td>
                                                    <td>
                                                        <span className={`call-badge ${callType.toLowerCase()}`}>
                                                            {callType.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td>{r.recommendation?.target_price || '-'}</td>
                                                    <td className={upsideAtCall > 0 ? 'text-green' : upsideAtCall < 0 ? 'text-red' : ''}>
                                                        {upsideAtCall != null ? `${(upsideAtCall * 100).toFixed(1)}%` : '-'}
                                                    </td>
                                                    <td>{r.recommendation?.current_price || '-'}</td>
                                                    <td className={upside > 0 ? 'text-green' : upside < 0 ? 'text-red' : ''}>
                                                        {upside != null ? `${(upside * 100).toFixed(1)}%` : '-'}
                                                    </td>
                                                    <td className={performance > 0 ? 'text-green' : performance < 0 ? 'text-red' : ''}>
                                                        {performance != null ? `${(performance * 100).toFixed(1)}%` : '-'}
                                                    </td>
                                                    <td className="thesis-cell">
                                                        <strong>Investment summary</strong>
                                                        <br />
                                                        <span className="thesis-text">
                                                            {r.recommendation?.recommendation || 'No details'}
                                                        </span>
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
