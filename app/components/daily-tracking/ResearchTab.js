'use client';

import { useState, useMemo } from 'react';

// Badge styling helper
const Badge = ({ children, bg, color }) => (
    <span style={{
        backgroundColor: bg,
        color: color,
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: '600',
        display: 'inline-block'
    }}>
        {children}
    </span>
);

export default function ResearchTab({ data }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBroker, setSelectedBroker] = useState('All Brokers');
    const [selectedType, setSelectedType] = useState('All Types');
    const [dateFilter, setDateFilter] = useState(''); // YYYY-MM-DD
    const [selectedNews, setSelectedNews] = useState(null); // Modal state
    const [selectedMacroBroker, setSelectedMacroBroker] = useState('All');

    if (!data) return <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>No research data available.</div>;

    const { ticker_news = [], macro_research = [] } = data; // Extract Macro Research

    // Extracted Unique Values for Dropdowns
    const brokers = useMemo(() => ['All Brokers', ...new Set(ticker_news.map(n => n.broker).filter(Boolean))], [ticker_news]);

    // Normalize types that come from data against visual types
    const types = useMemo(() => ['All Types', 'Analyst Call', 'News', 'Earnings'], []);

    // Filter Logic
    const filteredNews = useMemo(() => {
        // Find the top 3 most recent dates available in the data
        const uniqueDates = [...new Set(ticker_news.map(n => n.date?.substring(0, 10)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
        const top3Dates = uniqueDates.slice(0, 3);

        return ticker_news.filter(news => {
            const matchSearch = searchTerm === '' || news.ticker?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchBroker = selectedBroker === 'All Brokers' || news.broker === selectedBroker;

            // Map our dataset types to the visual categories if possible
            let nType = 'News';
            if (news.news_type?.toLowerCase().includes('analyst') || news.news_type?.toLowerCase().includes('call')) nType = 'Analyst Call';
            else if (news.news_type?.toLowerCase().includes('earn') || news.news_type?.toLowerCase().includes('kqkd')) nType = 'Earnings';
            const matchType = selectedType === 'All Types' || nType === selectedType;

            // Date filtering: If dateFilter is empty, default to the top 3 most recent dates.
            // If dateFilter is set, use the user's exact selection.
            const newsDate = news.date ? news.date.substring(0, 10) : '';
            const matchDate = dateFilter === ''
                ? top3Dates.includes(newsDate)
                : newsDate.startsWith(dateFilter);

            return matchSearch && matchBroker && matchType && matchDate;
        });
    }, [ticker_news, searchTerm, selectedBroker, selectedType, dateFilter]);

    const getSentimentColors = (sentiment) => {
        if (!sentiment) return { bg: '#2a2a2a', color: '#999' }; // Neutral Dark
        const s = sentiment.toLowerCase();
        if (s.includes('positive') || s.includes('buy') || s.includes('outperform')) return { bg: '#e6f4ea', color: '#137333' }; // Green
        if (s.includes('negative') || s.includes('sell') || s.includes('underperform')) return { bg: '#fce8e6', color: '#c5221f' }; // Red
        return { bg: '#f1f3f4', color: '#5f6368' }; // Neutral Light
    };

    const getTypeColors = (type) => {
        if (!type) return { bg: '#f1f3f4', color: '#5f6368' }; // Default News gray
        if (type === 'Analyst Call') return { bg: '#f3e8fd', color: '#7b1fa2' }; // Purple
        if (type === 'Earnings') return { bg: '#fef7e0', color: '#b06000' }; // Orange/Yellow
        return { bg: '#f1f3f4', color: '#5f6368' }; // News Gray
    };

    const getMacroBadgeColors = (broker) => {
        if (!broker) return { bg: '#2a2a2a', color: '#999' };
        const b = broker.toLowerCase();
        if (b.includes('gavekal')) return { bg: '#1e3a8a', color: '#93c5fd' }; // Dark Blue / Light Blue
        if (b.includes('goldman')) return { bg: '#78350f', color: '#fcd34d' }; // Dark Orange / Yellow
        if (b.includes('ssi')) return { bg: '#4c1d95', color: '#c4b5fd' }; // Dark Purple / Light Purple
        if (b.includes('13d')) return { bg: '#14532d', color: '#86efac' }; // Dark Green / Light Green
        return { bg: '#1f2937', color: '#d1d5db' }; // Default Dark theme
    };

    const filteredMacro = useMemo(() => {
        return macro_research.filter(item => {
            if (selectedMacroBroker === 'All') return true;
            const sourceName = item.source || item.Source || item.broker || '';
            return sourceName.includes(selectedMacroBroker);
        });
    }, [macro_research, selectedMacroBroker]);

    // Shared input styling
    const inputStyle = {
        background: '#1a1a1a',
        border: '1px solid #333',
        color: '#fff',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        outline: 'none',
        minWidth: '130px'
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>

            {/* White-styled Container for the Ticker News block */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '1rem', margin: '-1.5rem -1.5rem 0 -1.5rem', padding: '1.5rem 1.5rem 1rem 1.5rem', backgroundColor: '#111', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>Ticker News</h3>
                    {/* Assuming icon is here in original, keeping it clean */}
                </div>

                {/* Filters Bar */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '10px', color: '#666', fontSize: '12px' }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Ticker..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ ...inputStyle, paddingLeft: '30px', width: '120px' }}
                        />
                    </div>

                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        style={inputStyle}
                        title="Filter by Date"
                    />

                    <select value={selectedBroker} onChange={(e) => setSelectedBroker(e.target.value)} style={inputStyle}>
                        {brokers.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>

                    <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={inputStyle}>
                        {types.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <select style={inputStyle} disabled>
                        <option>All Sectors</option>
                    </select>
                </div>

                {/* Grid Layout */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '16px'
                }}>
                    {filteredNews.length === 0 ? (
                        <div style={{ color: '#888', padding: '2rem 0', gridColumn: '1 / -1', textAlign: 'center' }}>No news matching filters.</div>
                    ) : (
                        filteredNews.map((news, i) => {
                            // Map visual type
                            let nType = 'News';
                            if (news.news_type?.toLowerCase().includes('analyst') || news.news_type?.toLowerCase().includes('call')) nType = 'Analyst Call';
                            else if (news.news_type?.toLowerCase().includes('earn') || news.news_type?.toLowerCase().includes('kqkd')) nType = 'Earnings';

                            const sentimentStyle = getSentimentColors(news.sentiment);
                            const typeStyle = getTypeColors(nType);

                            return (
                                <div key={i}
                                    onClick={() => setSelectedNews({ ...news, nType, sentimentStyle, typeStyle })}
                                    style={{
                                        border: '1px solid #2a2a2a',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        backgroundColor: '#161616',
                                        transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                                        cursor: 'pointer'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#444';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = '#2a2a2a';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    {/* Top Badges */}
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                                        <Badge bg="#1a4d40" color="#4ade80">{news.ticker}</Badge>
                                        <Badge bg={sentimentStyle.bg} color={sentimentStyle.color}>
                                            {news.sentiment ? news.sentiment.charAt(0).toUpperCase() + news.sentiment.slice(1).toLowerCase() : 'Neutral'}
                                        </Badge>
                                        <Badge bg={typeStyle.bg} color={typeStyle.color}>{nType}</Badge>
                                    </div>

                                    {/* Main Content */}
                                    <div style={{
                                        lineHeight: '1.5',
                                        fontSize: '13px',
                                        color: '#d1d5db',
                                        flexGrow: 1,
                                        marginBottom: '16px',
                                        display: '-webkit-box',
                                        WebkitLineClamp: '4',
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {news.snippet || news.body || news.title}
                                    </div>

                                    {/* Footer */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #2a2a2a' }}>
                                        <span style={{ fontSize: '11px', color: '#888' }}>{news.date}</span>
                                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280' }}>{news.broker || 'UNKNOWN'}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* MACRO RESEARCH SECTION */}
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '1rem', margin: '-1.5rem -1.5rem 0 -1.5rem', padding: '1.5rem 1.5rem 1rem 1.5rem', backgroundColor: '#111', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>Macro Research</h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button style={{ background: '#027368', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: '16px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>Articles</button>
                        <button style={{ background: 'transparent', color: '#888', border: '1px solid #333', padding: '6px 16px', borderRadius: '16px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>Weekly Summaries</button>
                    </div>
                </div>

                {/* Filter Chips - Match DL Equity Layout but Dark Theme */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', padding: '0 1.5rem' }}>
                    {['All', 'Goldman Sachs', 'Gavekal', 'SSI', '13D'].map(broker => (
                        <button
                            key={broker}
                            onClick={() => setSelectedMacroBroker(broker)}
                            style={{
                                padding: '6px 16px',
                                borderRadius: '20px',
                                fontSize: '13px',
                                cursor: 'pointer',
                                fontWeight: 500,
                                background: selectedMacroBroker === broker ? '#027368' : '#fff',
                                color: selectedMacroBroker === broker ? '#fff' : '#64748b',
                                border: `1px solid ${selectedMacroBroker === broker ? '#027368' : '#cbd5e1'}`,
                                transition: 'all 0.2s'
                            }}>
                            {broker}
                        </button>
                    ))}
                </div>

                {/* Macro Grid - Dark Theme Match */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                    gap: '16px',
                    padding: '0 1.5rem 1.5rem 1.5rem'
                }}>
                    {filteredMacro.length === 0 ? (
                        <div style={{ color: '#888', padding: '2rem 0', gridColumn: '1 / -1', textAlign: 'center' }}>No macro research available.</div>
                    ) : (
                        filteredMacro.map((item, i) => {
                            const sourceName = item.source || item.Source || item.broker || 'UNKNOWN';
                            const dateStr = item.date ? item.date.substring(0, 10) : (item.DatePublish ? item.DatePublish.substring(0, 10) : '');

                            // For formatting the date like "Mar 1, 2026"
                            const formattedDate = dateStr ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

                            const titleStr = item.title || item.Title || 'Untitled';
                            const summaryStr = item.summary || item.Summary || item.snippet || item.body || '';

                            const badgeStyle = getMacroBadgeColors(sourceName);

                            return (
                                <div key={i}
                                    onClick={() => setSelectedNews({
                                        ...item,
                                        ticker: 'MACRO',
                                        nType: 'Research',
                                        sentimentStyle: { bg: badgeStyle.bg, color: badgeStyle.color },
                                        typeStyle: { bg: '#2a2a2a', color: '#999' },
                                        snippet: item.summary || item.snippet || '',
                                        body: item.body || '',
                                        date: formattedDate || dateStr,
                                        broker: sourceName,
                                        title: titleStr
                                    })}
                                    style={{
                                        border: '1px solid #2a2a2a',
                                        borderRadius: '8px',
                                        padding: '20px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        backgroundColor: '#161616',
                                        transition: 'border-color 0.2s, transform 0.2s, box-shadow 0.2s',
                                        cursor: 'pointer'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#444';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = '#2a2a2a';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}>

                                    {/* Header: Broker Pill & Date */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <Badge bg={badgeStyle.bg} color={badgeStyle.color}>{sourceName}</Badge>
                                        <span style={{ fontSize: '13px', color: '#888' }}>{formattedDate || dateStr}</span>
                                    </div>

                                    {/* Title */}
                                    <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '500', color: '#fff', lineHeight: '1.4' }}>
                                        {titleStr}
                                    </h4>

                                    {/* Excerpt Snippet */}
                                    <div style={{
                                        lineHeight: '1.6',
                                        fontSize: '13px',
                                        color: '#a3a3a3',
                                        display: '-webkit-box',
                                        WebkitLineClamp: '3',
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        {summaryStr}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* FULL SCREEN MODAL OVERLAY */}
            {selectedNews && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }} onClick={() => setSelectedNews(null)}>

                    <div style={{
                        backgroundColor: '#1e1e1e',
                        border: '1px solid #333',
                        borderRadius: '12px',
                        width: '100%',
                        maxWidth: '700px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        padding: '24px',
                        position: 'relative',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                    }} onClick={(e) => e.stopPropagation()}>

                        {/* Close Button */}
                        <button
                            onClick={() => setSelectedNews(null)}
                            style={{
                                position: 'absolute',
                                top: '16px',
                                right: '16px',
                                background: 'transparent',
                                border: 'none',
                                color: '#888',
                                fontSize: '20px',
                                cursor: 'pointer',
                                padding: '4px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                            onMouseLeave={e => e.currentTarget.style.color = '#888'}
                        >
                            ✕
                        </button>

                        {/* Modal Header Badges */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', alignItems: 'center' }}>
                            <Badge bg="#1a4d40" color="#4ade80">{selectedNews.ticker}</Badge>
                            <Badge bg={selectedNews.sentimentStyle.bg} color={selectedNews.sentimentStyle.color}>
                                {selectedNews.sentiment ? selectedNews.sentiment.charAt(0).toUpperCase() + selectedNews.sentiment.slice(1).toLowerCase() : 'Neutral'}
                            </Badge>
                            <Badge bg={selectedNews.typeStyle.bg} color={selectedNews.typeStyle.color}>{selectedNews.nType}</Badge>
                        </div>

                        {/* Summary Block (Left border highlight) */}
                        {selectedNews.snippet && selectedNews.snippet !== selectedNews.body && (
                            <div style={{
                                backgroundColor: '#262626',
                                borderLeft: '4px solid #027368',
                                padding: '16px 20px',
                                borderRadius: '0 8px 8px 0',
                                marginBottom: '24px',
                                color: '#e5e7eb',
                                fontSize: '14px',
                                lineHeight: '1.6'
                            }}>
                                <span style={{ fontWeight: 600, color: '#fff', marginRight: '6px' }}>Summary:</span>
                                {selectedNews.snippet}
                            </div>
                        )}

                        {/* Full Description Body (Only if actual body exists, otherwise hide empty box) */}
                        {selectedNews.body ? (
                            <div style={{
                                fontSize: '15px',
                                lineHeight: '1.7',
                                color: '#d1d5db',
                                marginBottom: '32px',
                                whiteSpace: 'pre-line'
                            }}>
                                {selectedNews.body}
                            </div>
                        ) : (
                            <div style={{ marginBottom: '32px' }} />
                        )}

                        {/* Modal Footer */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            gap: '12px',
                            color: '#888',
                            fontSize: '13px'
                        }}>
                            <span>{selectedNews.date}</span>
                            <span>via <strong>{selectedNews.broker || 'UNKNOWN'}</strong></span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
