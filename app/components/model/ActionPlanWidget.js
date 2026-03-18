'use client';

export default function ActionPlanWidget({ plan, history }) {
    if ((!plan || plan.length === 0) && (!history || history.length === 0)) return null;

    const renderActionColor = (actionStr) => {
        const lower = actionStr.toLowerCase();
        if (lower.includes('short') || lower.includes('sell') || lower.includes('cut')) return 'color: #ff4444; background-color: rgba(255, 68, 68, 0.1); border-color: rgba(255, 68, 68, 0.3)';
        if (lower.includes('long') || lower.includes('buy')) return 'color: #00ff7f; background-color: rgba(0, 255, 127, 0.1); border-color: rgba(0, 255, 127, 0.3)';
        if (lower.includes('reduce')) return 'color: #f59e0b; background-color: rgba(245, 158, 11, 0.1); border-color: rgba(245, 158, 11, 0.3)';
        return 'color: #aaa; background-color: #222; border-color: #444';
    };

    const recentHistory = history ? history.slice(0, 5) : [];

    return (
        <div className="card daily-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="daily-card-header" style={{ marginBottom: '1rem' }}>
                <h3 className="daily-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#f59e0b' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                    Action Plan Strategy
                </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
                {plan && plan.map((item, idx) => {
                    const isPositiveTarget = item.target.includes('+');
                    const targetColor = isPositiveTarget ? '#00ff7f' : (item.target.includes('-') ? '#ff4444' : '#888');

                    // Convert Tailwind-like string to a style object mapping
                    const actionStyleProps = renderActionColor(item.action).split(';').reduce((acc, current) => {
                        const [key, value] = current.split(':').map(str => str.trim());
                        if (key && value) {
                            // camelCase the keys
                            const camelKey = key.replace(/-([a-z])/g, g => g[1].toUpperCase());
                            acc[camelKey] = value;
                        }
                        return acc;
                    }, {});

                    return (
                        <div key={idx} style={{
                            display: 'flex', gap: '1rem', padding: '1rem', borderRadius: '8px',
                            border: '1px solid #222', backgroundColor: '#161616'
                        }}>
                            <div style={{
                                flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%',
                                backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 'bold', fontSize: '14px'
                            }}>
                                {idx + 1}
                            </div>
                            <div style={{ flexGrow: 1 }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>{item.type}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                                    <span style={{
                                        padding: '4px 12px', fontSize: '11px', fontWeight: 'bold',
                                        borderRadius: '6px', border: '1px solid', textTransform: 'uppercase',
                                        letterSpacing: '0.05em', ...actionStyleProps
                                    }}>
                                        {item.action}
                                    </span>
                                    <span style={{ fontSize: '13px', color: '#888' }}>
                                        Target: <span style={{ fontWeight: 'bold', color: targetColor }}>{item.target}</span>
                                    </span>
                                </div>
                                {item.note && (
                                    <div style={{
                                        marginTop: '12px', fontSize: '12px', color: '#aaa',
                                        backgroundColor: '#111', padding: '6px 12px', borderRadius: '4px',
                                        border: '1px solid #333', display: 'inline-block'
                                    }}>
                                        💡 {item.note}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Recent Historical Calls Comparison */}
                {recentHistory.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                        <h4 style={{ fontSize: '13px', color: '#888', textTransform: 'uppercase', marginBottom: '8px', fontWeight: '600', letterSpacing: '0.05em' }}>
                            Recent T+1 Calls vs Actuals
                        </h4>
                        <div style={{ borderRadius: '8px', border: '1px solid #222', overflow: 'hidden' }}>
                            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#111', borderBottom: '1px solid #222' }}>
                                        <th style={{ padding: '8px', textAlign: 'left', color: '#aaa', fontWeight: '600' }}>Date</th>
                                        <th style={{ padding: '8px', textAlign: 'right', color: '#aaa', fontWeight: '600' }}>Forecast</th>
                                        <th style={{ padding: '8px', textAlign: 'right', color: '#aaa', fontWeight: '600' }}>Actual</th>
                                        <th style={{ padding: '8px', textAlign: 'center', color: '#aaa', fontWeight: '600' }}>Logic</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentHistory.map((call, i) => {
                                        const isForecastPos = call.forecast?.includes('+');
                                        const isActualPos = call.actualRet?.includes('+');
                                        const isCorrectDir = call.dirAcc === 'CORRECT';

                                        return (
                                            <tr key={i} style={{ borderBottom: i === recentHistory.length - 1 ? 'none' : '1px solid #222', backgroundColor: '#161616' }}>
                                                <td style={{ padding: '8px', color: '#bbb' }}>{call.date.substring(0, 5)}</td>
                                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: isForecastPos ? '#00ff7f' : '#ff4444' }}>
                                                    {call.forecast}
                                                </td>
                                                <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: isActualPos ? '#00ff7f' : '#ff4444' }}>
                                                    {call.actualRet}
                                                    {call.actualRet !== 'Pending' && (
                                                        <span style={{
                                                            marginLeft: '6px', fontSize: '10px',
                                                            color: isCorrectDir ? '#00ff7f' : '#ff4444'
                                                        }}>
                                                            {isCorrectDir ? '✓' : '✗'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '8px', textAlign: 'center', color: '#888' }}>
                                                    {call.logic}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
