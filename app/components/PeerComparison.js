'use client';

import { useMemo } from 'react';

// Helper to format dates
const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length !== 6) return dateStr;
    return `${dateStr.substring(4, 6)}/${dateStr.substring(2, 4)}/20${dateStr.substring(0, 2)}`;
};

// Helper to format numbers
const formatNumber = (value) => {
    if (value === null || value === undefined || value === '') return '-';
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '-';
    return num.toLocaleString();
};

// Helper to format percentages
const formatPercentage = (value) => {
    if (value === null || value === undefined) return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return '-';
    return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
};

export default function PeerComparison({ currentReport, allReports }) {
    // Find peer companies in the same sector from the same broker
    const peerData = useMemo(() => {
        if (!currentReport || !allReports) return null;

        const currentSector = currentReport.info_of_report?.sector;
        const currentBroker = currentReport.info_of_report?.issued_company;
        const currentTicker = currentReport.info_of_report?.ticker;

        if (!currentSector || !currentBroker) return null;

        // Filter reports: same sector + same broker
        const peerReports = allReports.filter(r => {
            const matchesSector = r.info_of_report?.sector === currentSector;
            const matchesBroker = r.info_of_report?.issued_company === currentBroker;
            return matchesSector && matchesBroker;
        });

        // Group by ticker and get latest report for each
        const tickerMap = new Map();
        peerReports.forEach(report => {
            const ticker = report.info_of_report?.ticker;
            if (!ticker) return;

            const existing = tickerMap.get(ticker);
            if (!existing) {
                tickerMap.set(ticker, report);
            } else {
                // Compare dates and keep the latest
                const existingDate = existing.info_of_report?.date_of_issue || '000000';
                const currentDate = report.info_of_report?.date_of_issue || '000000';
                if (currentDate > existingDate) {
                    tickerMap.set(ticker, report);
                }
            }
        });

        // Convert to array and sort by ticker
        const peers = Array.from(tickerMap.values()).sort((a, b) => {
            const tickerA = a.info_of_report?.ticker || '';
            const tickerB = b.info_of_report?.ticker || '';
            return tickerA.localeCompare(tickerB);
        });

        return {
            sector: currentSector,
            broker: currentBroker,
            peers
        };
    }, [currentReport, allReports]);

    if (!peerData || peerData.peers.length === 0) {
        return (
            <div style={{
                padding: '40px',
                textAlign: 'center',
                color: '#888',
                fontStyle: 'italic'
            }}>
                No peer companies found in {peerData?.sector} sector from {peerData?.broker}
            </div>
        );
    }

    // Helper to get recommendation style (matching ForecastTable.js style)
    const getRecommendationStyle = (rec) => {
        const r = (rec || '').toLowerCase();
        if (['buy', 'outperform', 'add', 'accumulate', 'overweight'].some(k => r.includes(k)))
            return { bg: '#00ff7f', color: 'black' };
        if (['sell', 'underperform', 'reduce', 'underweight'].some(k => r.includes(k)))
            return { bg: '#ff4444', color: 'white' };
        if (['neutral', 'hold', 'market perform'].some(k => r.includes(k)))
            return { bg: '#4A5568', color: 'white' };
        return { bg: 'transparent', color: 'gray', border: '1px solid #3A3A3C' };
    };

    // Define metrics to display
    const metrics = [
        { key: 'date', label: 'Date' },
        { key: 'recommendation', label: 'Recommendation' },
        { key: 'target_price', label: 'Target price' },
        { key: 'upside_at_call', label: 'Upside at call' },
        { key: 'perf_since_call', label: 'Perf since call' },
        { key: 'revenue', label: 'Revenue' },
        { key: 'npat', label: 'NPAT' },
        { key: 'eps', label: 'EPS' },
        { key: 'bvps', label: 'BVPS' },
        { key: 'pe', label: 'PE' },
        { key: 'pb', label: 'PB' }
    ];

    // Get value for a metric from a peer report
    const getValue = (peer, metricKey) => {
        switch (metricKey) {
            case 'date':
                return formatDate(peer.info_of_report?.date_of_issue);
            case 'recommendation':
                return peer.recommendation?.recommendation || 'No Rating';
            case 'target_price':
                return formatNumber(peer.recommendation?.target_price);
            case 'upside_at_call':
                return formatPercentage(peer.recommendation?.upside_at_call);
            case 'perf_since_call':
                return formatPercentage(peer.recommendation?.performance_since_call);
            case 'revenue':
                const forecast = peer.forecast_summary;
                return formatNumber(forecast?.revenue ?? forecast?.['Revenue (bn VND)']);
            case 'npat':
                return formatNumber(peer.forecast_summary?.npat ?? peer.forecast_summary?.['NPAT (bn VND)']);
            case 'eps':
                return formatNumber(peer.forecast_summary?.eps ?? peer.forecast_summary?.['EPS (VND)']);
            case 'bvps':
                return formatNumber(peer.forecast_summary?.bvps ?? peer.forecast_summary?.['BVPS (VND)']);
            case 'pe':
                const peVal = peer.forecast_summary?.pe ?? peer.forecast_summary?.['P/E'];
                return peVal != null ? peVal.toFixed(1) : '-';
            case 'pb':
                const pbVal = peer.forecast_summary?.pb ?? peer.forecast_summary?.['P/B'];
                return pbVal != null ? pbVal.toFixed(2) : '-';
            default:
                return '-';
        }
    };

    return (
        <div style={{ marginTop: '20px' }}>
            {/* Table container with horizontal scroll */}
            <div style={{
                overflowX: 'auto',
                border: '1px solid #333',
                borderRadius: '8px'
            }}>
                <table className="mini-table w-full relative border-collapse">
                    {/* Header row */}
                    <thead>
                        <tr style={{
                            position: 'sticky',
                            top: 0,
                            zIndex: 10,
                            backgroundColor: '#1E1E1E'
                        }}>
                            <th>Metric</th>
                            {peerData.peers.map((peer, idx) => {
                                const peerTicker = peer.info_of_report?.ticker;
                                return (
                                    <th key={idx}>
                                        {peerTicker}
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>

                    <tbody>
                        {metrics.map((metric, metricIdx) => {
                            const isRec = metric.key === 'recommendation';

                            return (
                                <tr key={metric.key}>
                                    <td style={{
                                        position: 'sticky',
                                        left: 0,
                                        backgroundColor: '#1E1E1E',
                                        zIndex: 10
                                    }}>
                                        {metric.label}
                                    </td>
                                    {peerData.peers.map((peer, peerIdx) => {
                                        const value = getValue(peer, metric.key);

                                        if (isRec) {
                                            const style = getRecommendationStyle(value);
                                            return (
                                                <td key={peerIdx} style={{
                                                    padding: '6px 10px',
                                                    textAlign: 'right',
                                                    color: '#ccc',
                                                    borderLeft: '1px solid #1a1a1a',
                                                    borderBottom: '1px solid #1a1a1a',
                                                    fontFamily: 'monospace'
                                                }}>
                                                    <span style={{
                                                        backgroundColor: style.bg,
                                                        color: style.color,
                                                        border: style.border,
                                                        padding: '4px 12px',
                                                        borderRadius: '6px',
                                                        fontWeight: 'bold',
                                                        fontSize: '11px',
                                                        display: 'inline-block',
                                                        fontFamily: 'inherit'
                                                    }}>
                                                        {value}
                                                    </span>
                                                </td>
                                            );
                                        }

                                        return (
                                            <td key={peerIdx} style={{
                                                padding: '6px 10px',
                                                textAlign: 'right',
                                                color: '#ccc',
                                                borderLeft: '1px solid #1a1a1a',
                                                borderBottom: '1px solid #1a1a1a',
                                                fontFamily: 'monospace'
                                            }}>
                                                {value}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
