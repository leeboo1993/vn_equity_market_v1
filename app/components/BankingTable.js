'use client';

import React, { useMemo } from 'react';

export default function BankingTable({ data, forecastData, includeForecast, allTickers, ticker, periods, growthType, dbOption, keyItems }) {

    // Process Data
    const tableData = useMemo(() => {
        const bankTypes = ['Sector', 'SOCB', 'Private_1', 'Private_2', 'Private_3'];
        const isType = bankTypes.includes(ticker);
        let filtered = [];

        if (isType) {
            // Aggregate Logic
            const rows = ticker === 'Sector' ? data : data.filter(d => d.Type === ticker);
            const periodKey = dbOption === 'Quarterly' ? 'Date_Quarter' : 'Year';
            const periodsArr = [...new Set(rows.map(r => r[periodKey]))].filter(Boolean);

            filtered = periodsArr.map(p => {
                const pRows = rows.filter(r => r[periodKey] === p);
                const aggRow = {
                    TICKER: ticker,
                    [periodKey]: p,
                    Year: pRows[0]?.Year,
                    Type: 'Aggregated',
                    isForecast: pRows.some(r => r.Type === 'Forecast')
                };

                if (pRows.length > 0) {
                    Object.keys(pRows[0]).forEach(key => {
                        if (['TICKER', 'Type', 'Date_Quarter', 'ENDDATE_x', 'YEARREPORT', 'LENGTHREPORT'].includes(key)) return;

                        const values = pRows.map(r => r[key]).filter(v => typeof v === 'number');
                        if (values.length === 0) {
                            aggRow[key] = pRows[0][key];
                            return;
                        }

                        const isRatio = ['NIM', 'Yield', 'NPL', 'LDR', 'ROE', 'ROA', 'Ratio', '%'].some(k => key.includes(k));
                        if (isRatio) {
                            aggRow[key] = values.reduce((a, b) => a + b, 0) / values.length;
                        } else {
                            aggRow[key] = values.reduce((a, b) => a + b, 0);
                        }
                    });
                }
                return aggRow;
            });

        } else {
            // Normal Ticker Filter
            filtered = data.filter(d => d.TICKER === ticker);
        }

        filtered.sort((a, b) => {
            const dateA = a.Date_Quarter || (a.Year ? a.Year.toString() : '');
            const dateB = b.Date_Quarter || (b.Year ? b.Year.toString() : '');
            return dateA.localeCompare(dateB);
        });

        let historySlice = filtered.slice(-periods);

        let forecastSlice = [];
        if (includeForecast && forecastData && !isType) {
            const fFiltered = forecastData.filter(d => d.TICKER === ticker && d.Type === 'Forecast');
            forecastSlice = fFiltered;
        }

        const combined = [...historySlice, ...forecastSlice];

        const cols = combined.map(d => d.Date_Quarter || d.Year);

        // Updated Metric Keys to match JSON
        const earningsMetrics = ['TOI', 'PBT', 'NPATMI', 'PPOP', 'Net Interest Income', 'Provision expense', 'OPEX', 'Fees Income'];
        const ratioMetrics = ['NIM', 'Loan yield', 'Deposit yield', 'CASA', 'LDR', 'NPL', 'GROUP 2', 'NPL Coverage ratio', 'ROE', 'ROA', 'CIR'];
        const bsMetrics = ['Loan', 'Deposit', 'Total Assets', 'Total Equity', 'Provision on Balance Sheet'];

        const metricLabels = {
            'TOI': 'Total Operating Income',
            'PBT': 'Profit Before Tax',
            'NPATMI': 'Profit After Tax (MI)',
            'PPOP': 'Pre-Provision Profit',
            'Provision expense': 'Provision Expense',
            'OPEX': 'Operating Expense',
            'Net Interest Income': 'Net Interest Income',
            'Fees Income': 'Fees Income',
            'NIM': 'NIM',
            'Loan yield': 'Loan Yield',
            'Deposit yield': 'Deposit Yield',
            'CASA': 'CASA Ratio',
            'LDR': 'LDR',
            'NPL': 'NPL Ratio',
            'GROUP 2': 'Group 2 Loans',
            'NPL Coverage ratio': 'NPL Coverage',
            'ROE': 'ROE',
            'ROA': 'ROA',
            'CIR': 'Cost-to-Income',
            'Loan': 'Total Loans',
            'Deposit': 'Customer Deposits',
            'Total Assets': 'Total Assets',
            'Total Equity': 'Owner Equity',
            'Provision on Balance Sheet': 'Provision (BS)'
        };

        const buildRows = (metrics) => {
            return metrics.map(m => {
                const rowData = { metric: metricLabels[m] || m, originalKey: m };
                combined.forEach(d => {
                    const date = d.Date_Quarter || d.Year;
                    rowData[date] = d[m];
                    rowData[`${date}_isForecast`] = d.Type === 'Forecast' || (d.Year && d.Year > 2024);
                });
                return rowData;
            });
        };

        return {
            cols,
            earnings: buildRows(earningsMetrics),
            ratios: buildRows(ratioMetrics),
            bs: buildRows(bsMetrics)
        };
    }, [data, forecastData, includeForecast, ticker, periods, dbOption]);

    // Formatting Helpers
    const formatValue = (val, metric) => {
        if (val === null || val === undefined) return '-';
        const isPercentage = ['NIM', 'Yield', 'Cost', 'Ratio', 'LDR', 'NPL', 'ROE', 'ROA', 'CIR', 'Group 2', 'CASA'].some(k => metric.includes(k) || metric.includes('Rate'));
        const isBillion = ['Income', 'Profit', 'Expense', 'Assets', 'Equity', 'Loans', 'Deposits', 'Provision', 'TOI', 'PBT'].some(k => metric.includes(k)) && !isPercentage;

        if (isPercentage) return (val * 100).toFixed(2) + '%';
        if (isBillion) return (val / 1e9).toLocaleString('en-US', { maximumFractionDigits: 0 });
        return val.toLocaleString();
    };

    const getGrowth = (current, prev) => {
        if (!current || !prev) return null;
        return ((current - prev) / prev);
    };

    const GrowthCell = ({ val }) => {
        if (val === null) return <td className="p-3 text-right text-gray-500 w-[100px] border-b border-gray-800/50">-</td>;
        const color = val < 0 ? 'text-red-400' : 'text-green-400';
        return (
            <td className={`p-3 text-right font-medium w-[100px] border-b border-gray-800/50 ${color}`}>
                {(val * 100).toFixed(1)}%
            </td>
        );
    };

    const renderTableSection = (title, rows) => (
        <div className="mb-8">
            <h3 className="text-gray-200 font-bold mb-3 uppercase text-xs tracking-wider border-l-2 border-emerald-500 pl-2">
                {title}
            </h3>
            <div className="table-wrapper overflow-x-auto rounded border border-gray-800 bg-[#141414]">
                <table className="report-table min-w-full text-xs text-left text-gray-300 table-fixed">
                    <thead className="bg-[#111] text-gray-400 border-b border-gray-800">
                        <tr>
                            <th className="p-3 sticky left-0 bg-[#111] z-10 border-r border-gray-800 font-semibold w-[200px]">
                                Metric
                            </th>
                            {tableData.cols.map(col => {
                                const isForecast = rows[0][`${col}_isForecast`];
                                return (
                                    <th key={col} className={`p-2 text-right w-[120px] font-semibold border-r border-gray-800/30 ${isForecast ? 'text-yellow-500/80 underline decoration-dotted' : ''}`}>
                                        {col}
                                    </th>
                                );
                            })}
                            <th className="p-2 text-right w-[100px] font-semibold text-white">
                                {growthType}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                        {rows.map((row, idx) => {
                            let growthVal = null;
                            if (tableData.cols.length >= 2) {
                                const curr = row[tableData.cols[tableData.cols.length - 1]];
                                let prevIdx = tableData.cols.length - 2;
                                if (growthType === 'YoY' && dbOption === 'Quarterly') {
                                    prevIdx = tableData.cols.length - 5;
                                } else if (growthType === 'YoY' && dbOption === 'Yearly') {
                                    prevIdx = tableData.cols.length - 2;
                                }

                                if (prevIdx >= 0) {
                                    const prev = row[tableData.cols[prevIdx]];
                                    growthVal = getGrowth(curr, prev);
                                }
                            }

                            return (
                                <tr key={row.metric} className="hover:bg-[#1a1a1a] transition-colors group">
                                    <td className="p-2.5 font-medium text-gray-200 sticky left-0 bg-[#141414] group-hover:bg-[#1a1a1a] border-r border-gray-800 z-10 w-[200px] truncate" title={row.metric}>
                                        {row.metric}
                                    </td>
                                    {tableData.cols.map(col => {
                                        const isForecast = row[`${col}_isForecast`];
                                        return (
                                            <td
                                                key={col}
                                                className={`p-2.5 text-right w-[120px] border-r border-gray-800/30 ${isForecast ? 'text-yellow-100/70 italic' : ''}`}
                                            >
                                                {formatValue(row[col], row.metric)}
                                            </td>
                                        );
                                    })}
                                    <GrowthCell val={growthVal} />
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="animate-in fade-in duration-500">
            {renderTableSection("Earnings Metrics", tableData.earnings)}
            {renderTableSection("Key Ratios", tableData.ratios)}
            {renderTableSection("Balance Sheet", tableData.bs)}
        </div>
    );
}
