'use client';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
    teal: '#00a884',
    card: '#111111',
    border: '#222222',
    text: '#888888',
    white: '#ffffff'
};

export default function FundamentalsTab({ data }) {
    if (!data) return <div style={{ padding: '2rem', textAlign: 'center', color: C.text }}>No fundamentals data available.</div>;

    const { sector_overview = [] } = data;

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '16px', fontWeight: 600, color: C.white }}>Sector Overview</h3>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${C.border}`, color: C.text, textAlign: 'left' }}>
                            <th style={{ padding: '10px 8px', fontWeight: 500 }}>Sector</th>
                            <th style={{ padding: '10px 8px', fontWeight: 500, textAlign: 'right' }}>Tickers</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sector_overview.map((row, idx) => (
                            <tr key={idx} style={{ borderBottom: `1px solid ${C.border}` }}>
                                <td style={{ padding: '10px 8px', color: '#eee' }}>{row.sector}</td>
                                <td style={{ padding: '10px 8px', textAlign: 'right', color: C.teal, fontWeight: 600 }}>{row.ticker_count}</td>
                            </tr>
                        ))}
                        {sector_overview.length === 0 && (
                            <tr><td colSpan={2} style={{ padding: '20px', textAlign: 'center', color: C.text }}>No sector data</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
