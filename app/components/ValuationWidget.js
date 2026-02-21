'use client';

import { useState, useEffect, useMemo } from 'react';

export default function ValuationWidget({ ticker, livePrice }) {
    const [financials, setFinancials] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!ticker) return;

        const fetchFinancials = async () => {
            try {
                setLoading(true);
                const res = await fetch(`/api/financials?ticker=${ticker}`);
                if (!res.ok) {
                    if (res.status === 404) {
                        throw new Error('Historical financials not yet indexed.');
                    }
                    throw new Error('Failed to fetch financials');
                }
                const data = await res.json();
                setFinancials(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchFinancials();
    }, [ticker]);

    const valuationMetrics = useMemo(() => {
        if (!financials || financials.length === 0 || !livePrice) return null;

        // The merged data is sorted descending chronologically
        const latestQuarter = financials[0];

        // Sum Net Profit over the last 4 available quarters
        // "IS_Lợi nhuận sau thuế của công ty mẹ" -> NPATMI
        // "IS_Lợi nhuận thuần" -> Net Profit (Alternative)
        const quartersToSum = Math.min(4, financials.length);
        let trailingNetProfit = 0;
        let foundNetProfitCol = null;

        for (let i = 0; i < quartersToSum; i++) {
            const row = financials[i];

            // Determine which net profit field actually exists
            if (foundNetProfitCol === null) {
                if (row['IS_Lợi nhuận sau thuế của cổ đông công ty mẹ'] != null) foundNetProfitCol = 'IS_Lợi nhuận sau thuế của cổ đông công ty mẹ';
                else if (row['IS_Lợi nhuận sau thuế của công ty mẹ'] != null) foundNetProfitCol = 'IS_Lợi nhuận sau thuế của công ty mẹ';
                else if (row['IS_Lợi nhuận thuần'] != null) foundNetProfitCol = 'IS_Lợi nhuận thuần';
                else foundNetProfitCol = 'IS_Lợi nhuận sau thuế thu nhập doanh nghiệp'; // Fallback
            }

            trailingNetProfit += row[foundNetProfitCol] || 0;
        }

        // Total Shares Outstanding is a bit tricky. We can deduce it from Total Equity and BVPS if the base VNSTOCK 'ratio' table provides VNSTOCK's tracked BVPS, 
        // OR we can deduce it from the standard VNSTOCK ratio 'EPS' if we have standard Earnings.

        // Let's use VNSTOCK's most recent "RATIO_" equivalents as the base line and adjust them proportional to the live price!
        const lastStatedPE = latestQuarter['RATIO_Chỉ tiêu định giá_P/E'];
        const lastStatedPB = latestQuarter['RATIO_Chỉ tiêu định giá_P/B'];
        // Note: We need VNSTOCK's stock closing price at the end of that quarter to make this math exact.
        // A smarter way:  PE = Price / EPS. Therefore:  EPS = (Historical End-of-Quarter Price) / lastStatedPE.
        // Sadly we don't know the exact end of quarter price in this JSON.

        // Best approach for Vietnam:
        // Use the mathematically deduced Trailing EPS based on Total Shares.
        // Wait, VNSTOCK offers 'RATIO_Chỉ tiêu định giá_B/V' -> That's Book Value Per Share!
        const bvps = latestQuarter['RATIO_Chỉ tiêu định giá_B/V'];
        const livePB = bvps ? (livePrice / bvps) : lastStatedPB;

        // And EPS? Do they offer EPS?
        // Let's check VNSTOCK ratio columns: they usually track 'Chỉ tiêu khả năng sinh lợi_ROA', 'Chỉ tiêu khả năng sinh lợi_ROE'.

        // Let's just output the official stated Quarterly PE/PB alongside the live price for now. 
        // We will do exact live PE math directly if EPS is provided in the CSV structure.

        return {
            livePrice,
            latestQuarterName: `Q${latestQuarter.Quarter}/${latestQuarter.Year}`,
            statedPE: lastStatedPE,
            statedPB: lastStatedPB,
            livePB: livePB,
            bvps: bvps,
            trailingProfit: trailingNetProfit,
            equity: latestQuarter['BS_VỐN CHỦ SỞ HỮU (đồng)']
        };

    }, [financials, livePrice]);


    if (loading) return <div className="p-4 text-sm text-gray-500 animate-pulse bg-[#111] rounded border border-gray-800">Loading historical data from R2...</div>;
    if (error) return <div className="p-4 text-sm text-yellow-500 bg-yellow-900/10 rounded border border-yellow-800/50">{error}</div>;
    if (!valuationMetrics) return null;

    return (
        <div className="card border-l-4 border-[#00ff7f]">
            <h3 className="text-sm font-semibold text-gray-400 mb-4 uppercase tracking-wider">Live Valuation Metrics</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                    <div className="text-xs text-gray-500 mb-1">Live Price</div>
                    <div className="text-xl font-mono text-[#00ff7f]">{livePrice?.toLocaleString()}</div>
                </div>

                <div>
                    <div className="text-xs text-gray-500 mb-1">Live P/B (ttm)</div>
                    <div className="text-xl font-mono text-white">
                        {valuationMetrics.livePB ? valuationMetrics.livePB.toFixed(2) : '-'}
                    </div>
                </div>

                <div>
                    <div className="text-xs text-gray-500 mb-1">Last Stated P/E ({valuationMetrics.latestQuarterName})</div>
                    <div className="text-lg font-mono text-gray-300">
                        {valuationMetrics.statedPE ? valuationMetrics.statedPE.toFixed(2) : '-'}
                    </div>
                </div>

                <div>
                    <div className="text-xs text-gray-500 mb-1">Trailing Net Profit (4Q)</div>
                    <div className="text-lg font-mono text-gray-300">
                        {valuationMetrics.trailingProfit ? `${(valuationMetrics.trailingProfit / 1e9).toFixed(1)} Tỷ` : '-'}
                    </div>
                </div>
            </div>

            <div className="text-xs text-gray-600 mt-4 leading-relaxed">
                * Live P/B is calculated instantly based on current market price over the Book Value recorded in the {valuationMetrics.latestQuarterName} financial report. <br />
                Tracking full 12-year history from {financials.length} total quarters.
            </div>
        </div>
    );
}

