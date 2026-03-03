'use client';

import { useMemo, useState } from 'react';

export default function PutThroughTable({ data }) {
    const [period, setPeriod] = useState(1); // 1, 7, 30

    const tableData = useMemo(() => {
        if (!data || data.length === 0) return [];
        return data.filter(d => d.period_days === period)
            .sort((a, b) => b.pt_os_pct - a.pt_os_pct);
    }, [data, period]);

    if (!data || data.length === 0) return null;

    const formatPct = (val) => {
        if (!val && val !== 0) return '-';
        return `${(val * 100).toFixed(2)}%`;
    };

    const formatVol = (val) => {
        if (!val) return '-';
        return val.toLocaleString('en-US');
    };

    return (
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Put-Through</h3>
                    <div style={{ fontSize: '12px', color: '#888' }}>
                        Data as of {tableData.length > 0 ? tableData[0].crawl_date : '-'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', background: '#222', padding: '4px', borderRadius: '16px' }}>
                    {[1, 7, 30].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            style={{
                                background: period === p ? '#00a884' : 'transparent',
                                color: period === p ? '#fff' : '#888',
                                border: 'none',
                                padding: '4px 12px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: period === p ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {p}D
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #333', color: '#888', textAlign: 'left' }}>
                            <th style={{ padding: '10px 8px', fontWeight: 500 }}>#</th>
                            <th style={{ padding: '10px 8px', fontWeight: 500 }}>Ticker</th>
                            <th style={{ padding: '10px 8px', fontWeight: 500 }}>Sector</th>
                            <th style={{ padding: '10px 8px', fontWeight: 500, textAlign: 'right' }}>PT Vol</th>
                            <th style={{ padding: '10px 8px', fontWeight: 500, textAlign: 'right' }}>PT/OS %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.slice(0, 15).map((row, idx) => (
                            <tr key={`${row.ticker}-${idx}`} style={{ borderBottom: '1px solid #222' }}>
                                <td style={{ padding: '10px 8px', color: '#888' }}>{idx + 1}</td>
                                <td style={{ padding: '10px 8px', color: '#3399ff', fontWeight: 500 }}>
                                    {row.ticker}
                                </td>
                                <td style={{ padding: '10px 8px', color: '#bbb', fontSize: '12px' }}>
                                    {row.sector || '-'}
                                </td>
                                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#eee' }}>
                                    {formatVol(row.pt_volume)}
                                </td>
                                <td style={{
                                    padding: '10px 8px',
                                    textAlign: 'right',
                                    color: row.pt_os_pct > 0.02 ? '#00a884' : '#00ff7f',
                                    fontWeight: row.pt_os_pct > 0.02 ? 600 : 400
                                }}>
                                    {formatPct(row.pt_os_pct)}
                                </td>
                            </tr>
                        ))}
                        {tableData.length === 0 && (
                            <tr>
                                <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                                    No data available for {period}D
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
