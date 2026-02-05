'use client';

import React, { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';

export default function BankingCharts({
    data, forecastData, includeForecast, allTickers, availableMetrics,
    tickers, setTickers, periods, setPeriods, metrics, setMetrics, dbOption
}) {
    // Colors from Company Report (PeerComparison.js / ReportList.js)
    const COLOR_GREEN = '#00ff7f'; // Positive / Main
    const COLOR_RED = '#ff4444';   // Negative / Attention
    const COLOR_GREY = '#4A5568';  // Neutral

    const chartData = useMemo(() => {
        // Define Bank Types
        const bankTypes = ['Sector', 'SOCB', 'Private_1', 'Private_2', 'Private_3'];

        const realTickers = tickers.filter(t => !bankTypes.includes(t));
        const typeTickers = tickers.filter(t => bankTypes.includes(t));

        // 1. Get Real Data
        const realData = data.filter(d => realTickers.includes(d.TICKER));

        // 2. Aggregate Data for Types
        const aggData = [];
        if (typeTickers.length > 0) {
            typeTickers.forEach(type => {
                const rows = type === 'Sector' ? data : data.filter(d => d.Type === type);
                if (rows.length === 0) return;

                const periodKey = dbOption === 'Quarterly' ? 'Date_Quarter' : 'Year';
                const periods = [...new Set(rows.map(r => r[periodKey]))].filter(Boolean);

                periods.forEach(p => {
                    const pRows = rows.filter(r => r[periodKey] === p);
                    if (pRows.length === 0) return;

                    const aggRow = {
                        TICKER: type,
                        [periodKey]: p,
                        Year: pRows[0].Year
                    };

                    metrics.forEach(m => {
                        const values = pRows.map(r => r[m]).filter(v => v !== null && v !== undefined);
                        if (values.length === 0) {
                            aggRow[m] = null;
                            return;
                        }
                        const isRatio = ['NIM', 'Yield', 'NPL', 'LDR', 'ROE', 'ROA', 'Ratio', '%', 'New NPL', 'New G2'].some(k => m.includes(k));

                        // Fix for sum vs average logic
                        if (isRatio) {
                            aggRow[m] = values.reduce((a, b) => a + b, 0) / values.length;
                        } else {
                            aggRow[m] = values.reduce((a, b) => a + b, 0);
                        }
                    });
                    aggData.push(aggRow);
                });
            });
        }

        const relevant = [...realData, ...aggData]
            .sort((a, b) => {
                const dateA = a.Date_Quarter || (a.Year ? a.Year.toString() : '');
                const dateB = b.Date_Quarter || (b.Year ? b.Year.toString() : '');
                return dateA.localeCompare(dateB);
            });

        const periodKey = dbOption === 'Quarterly' ? 'Date_Quarter' : 'Year';
        const allPeriods = [...new Set(relevant.map(d => d[periodKey]))].filter(Boolean).sort();
        const displayPeriods = allPeriods.slice(-periods); // Last N periods

        const finalData = displayPeriods.map((period, pIdx) => {
            const item = { name: period };
            tickers.forEach(t => {
                const row = relevant.find(r => r.TICKER === t && r[periodKey] === period);
                if (row) {
                    metrics.forEach(m => {
                        const val = row[m];
                        item[`${t}_${m}`] = val;

                        // Calculate MA4 (Moving Average 4 periods)
                        if (val !== null && val !== undefined) {
                            const tRows = relevant.filter(r => r.TICKER === t);
                            const currIdx = tRows.findIndex(r => r[periodKey] === period);
                            if (currIdx >= 3) {
                                const slice = tRows.slice(currIdx - 3, currIdx + 1);
                                const sum = slice.reduce((acc, r) => acc + (r[m] || 0), 0);
                                item[`${t}_${m}_MA4`] = sum / 4;
                            } else {
                                item[`${t}_${m}_MA4`] = null;
                            }
                        }
                    });
                }
            });
            return item;
        });

        return finalData;
    }, [data, forecastData, includeForecast, tickers, periods, metrics, dbOption]);

    return (
        // Explicit CSS Grid to strictly enforce 2 columns
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', width: '100%' }}>
            {metrics.map((metric) => {
                const isPercentage = ['NIM', 'Yield', 'NPL', 'ROA', 'ROE', 'LDR', 'G2', 'Rate', 'CASA', 'CIR'].some(k => metric.includes(k));
                const isBillion = ['TOI', 'PBT', 'Profit', 'Assets', 'Loan', 'Deposit', 'Provision', 'Opex'].some(k => metric.includes(k)) && !isPercentage;
                const unitCheck = isBillion ? '(B VND)' : isPercentage ? '(%)' : '';

                return (
                    <div key={metric} className="bg-[#141414] border border-gray-800 p-3 rounded-lg shadow-sm flex flex-col">
                        <h3 className="text-gray-300 font-semibold mb-4 text-center text-xs uppercase tracking-wide">
                            {metric} {unitCheck}
                        </h3>
                        <div style={{ width: '100%', height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        stroke="#666"
                                        fontSize={10}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        stroke="#666"
                                        fontSize={10}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(val) => {
                                            if (val === 0) return '0';
                                            if (isBillion) return (val / 1e9).toFixed(0) + 'k';
                                            if (isPercentage) return (val * 100).toFixed(1);
                                            return val;
                                        }}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', borderRadius: '4px', fontSize: '12px' }}
                                        formatter={(val, name) => {
                                            if (val === null) return '-';
                                            const numVal = Number(val);
                                            const displayVal = isPercentage ? (numVal * 100).toFixed(2) + '%' : isBillion ? (numVal / 1e9).toFixed(1) + 'B' : numVal.toLocaleString();
                                            return [displayVal, name];
                                        }}
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '15px' }} />

                                    {tickers.map((t, i) => (
                                        <React.Fragment key={t}>
                                            <Bar
                                                dataKey={`${t}_${metric}`}
                                                name={t}
                                                fill={COLOR_GREEN}
                                                radius={[2, 2, 0, 0]}
                                                barSize={30}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey={`${t}_${metric}_MA4`}
                                                name={`${t} MA4`}
                                                stroke={COLOR_RED}
                                                strokeWidth={2}
                                                dot={{ r: 3, fill: COLOR_RED }}
                                                activeDot={{ r: 5 }}
                                            />
                                        </React.Fragment>
                                    ))}
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
