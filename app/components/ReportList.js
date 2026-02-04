export default function ReportList({ reports, selectedReportId, onSelectReport, sortKey, sortOrder, onSort }) {

    // Get recommendation pill styling
    const getRecommendationStyle = (recommendation) => {
        const normalizedRec = recommendation?.toLowerCase() || '';

        // Buy/Outperform -> Green
        if (['buy', 'outperform', 'add', 'accumulate', 'overweight'].some(k => normalizedRec.includes(k))) {
            return { backgroundColor: '#00ff7f', color: 'black', border: 'none' };
        }

        // Sell/Underperform -> Red
        if (['sell', 'underperform', 'reduce', 'underweight'].some(k => normalizedRec.includes(k))) {
            return { backgroundColor: '#ff4444', color: 'white', border: 'none' };
        }

        // Neutral/Hold -> Dark grey
        if (['neutral', 'hold', 'market perform'].some(k => normalizedRec.includes(k))) {
            return { backgroundColor: '#4A5568', color: 'white', border: 'none' };
        }

        // No Rating -> Just border, no background
        return { backgroundColor: 'transparent', color: 'white', border: '1px solid #3A3A3C' };
    };

    const formatDate = (dateString) => {
        if (!dateString || dateString.length !== 6) return dateString;
        const year = `20${dateString.substring(0, 2)}`;
        const month = dateString.substring(2, 4);
        const day = dateString.substring(4, 6);
        return `${day}/${month}/${year}`;
    };

    const getDisplayRecommendation = (upside, targetPrice) => {
        // If no target price, return "No Rating"
        if (!targetPrice || targetPrice === 0) {
            return 'No Rating';
        }

        // Standardize based on upside at call
        if (upside >= 15) {
            return 'Buy';
        } else if (upside <= -5) {
            return 'Sell';
        } else {
            return 'Neutral';
        }
    };

    return (
        <div className="panel">
            <div className="panel-header" style={{ fontSize: '12px' }}>
                <span>Company Reports</span>
                <div className="text-[10px] font-medium text-gray bg-white/5 px-2 py-1 rounded border border-white/5 uppercase">
                    By {sortKey} ({sortOrder})
                </div>
            </div>
            <div className="panel-content-no-padding">
                <table className="table">
                    <thead>
                        <tr>
                            <HeaderCell label="Date" sortKeyName="date" sortKey={sortKey} sortOrder={sortOrder} onSort={onSort} />
                            <HeaderCell label="Ticker" sortKeyName="ticker" sortKey={sortKey} sortOrder={sortOrder} onSort={onSort} />
                            <th>Broker</th>
                            <th>Call</th>
                            <th className="text-right">Target</th>
                            <th className="text-right">Price</th>
                            <HeaderCell label="Upside" sortKeyName="upside" align="text-right" sortKey={sortKey} sortOrder={sortOrder} onSort={onSort} />
                        </tr>
                    </thead>
                    <tbody style={{ fontSize: '9px' }}>
                        {reports.map((report) => {
                            const upside = report.recommendation?.upside || 0;
                            const targetPrice = report.recommendation?.target_price;
                            const displayRec = getDisplayRecommendation(upside, targetPrice);
                            const recStyle = getRecommendationStyle(displayRec);

                            return (
                                <tr
                                    key={report.id}
                                    onClick={() => onSelectReport(report.id)}
                                    className={selectedReportId === report.id ? 'selected' : ''}
                                >
                                    <td className="text-gray whitespace-nowrap font-mono">{formatDate(report.info_of_report.date_of_issue)}</td>
                                    <td className="font-bold text-white">{report.info_of_report.ticker}</td>
                                    <td className="text-gray">{report.info_of_report.issued_company}</td>
                                    <td>
                                        <span style={{
                                            ...recStyle,
                                            padding: '3px 10px',
                                            borderRadius: '9999px',
                                            fontWeight: 'bold',
                                            fontSize: '9px',
                                            display: 'inline-block'
                                        }}>
                                            {displayRec}
                                        </span>
                                    </td>
                                    <td className="text-right font-mono text-gray">{report.recommendation?.target_price?.toLocaleString() ?? '-'}</td>
                                    <td className="text-right font-mono text-gray">{report.recommendation?.current_price?.toLocaleString() ?? '-'}</td>
                                    <td className="text-right text-green font-mono font-bold">{report.recommendation?.upside ? `+${report.recommendation.upside}%` : '-'}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function HeaderCell({ label, sortKeyName, align = 'text-left', className = '', sortKey, sortOrder, onSort }) {
    const getSortIcon = (key) => {
        if (sortKey !== key) return null;
        return sortOrder === 'asc' ? '↑' : '↓';
    };

    return (
        <th
            className={`${align} ${className} cursor-pointer hover:text-white transition-colors`}
            onClick={() => onSort(sortKeyName)}
        >
            <div className={`flex items-center gap-1 ${align === 'text-right' ? 'justify-end' : ''}`}>
                {label} <span className="text-[9px] w-2">{getSortIcon(sortKeyName)}</span>
            </div>
        </th>
    );
}
