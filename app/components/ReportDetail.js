import { useState, useEffect } from 'react';
import ForecastTable from './ForecastTable';

export default function ReportDetail({ report }) {
    const [activeTab, setActiveTab] = useState('recommendation');
    const [livePrice, setLivePrice] = useState(null);

    useEffect(() => {
        if (!report) return;
        setLivePrice(null);

        const fetchLivePrice = async () => {
            try {
                const res = await fetch(`/api/live-prices?tickers=${report.info_of_report.ticker}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.prices && data.prices[report.info_of_report.ticker]) {
                        setLivePrice(data.prices[report.info_of_report.ticker].price);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch live price in ReportDetail", err);
            }
        };

        fetchLivePrice();
    }, [report]);

    if (!report) {
        return (
            <div className="panel h-full">
                <div className="p-10 text-center text-gray flex flex-col items-center justify-center h-full">
                    <span className="text-4xl mb-4 grayscale opacity-50">📄</span>
                    <p>Select a report to view details</p>
                </div>
            </div>
        );
    }

    const isOutperform = report.recommendation?.recommendation === 'Outperform';
    const recommendationText = isOutperform ? 'Buy' : report.recommendation?.recommendation === 'Neutral' ? 'Hold' : 'Sell';
    const recommendationColor = isOutperform ? 'text-green' : report.recommendation?.recommendation === 'Underperform' ? 'text-red' : 'text-yellow';

    return (
        <div className="panel h-full flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-border bg-card z-20 flex-shrink-0">
                <div className="flex justify-between items-start mb-1">
                    <h2 className="text-2xl font-bold tracking-tight text-white">
                        {report.info_of_report.ticker}
                    </h2>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold bg-white/5 ${recommendationColor} border border-white/5 uppercase tracking-wide`}>
                        {recommendationText}
                    </span>
                </div>
                <div className="text-[11px] text-gray mb-4">{report.info_of_report.covered_stock}</div>

                <div className="flex gap-2">
                    <TabButton
                        label="Recommendation"
                        isActive={activeTab === 'recommendation'}
                        onClick={() => setActiveTab('recommendation')}
                    />
                    <TabButton
                        label="Investment"
                        isActive={activeTab === 'investment'}
                        onClick={() => setActiveTab('investment')}
                    />
                    <TabButton
                        label="Financials"
                        isActive={activeTab === 'financials'}
                        onClick={() => setActiveTab('financials')}
                    />
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="panel-content flex-1 overflow-y-auto">
                {activeTab === 'recommendation' && <RecommendationView report={report} recommendationColor={recommendationColor} recommendationText={recommendationText} livePrice={livePrice} />}
                {activeTab === 'investment' && <InvestmentView report={report} />}
                {activeTab === 'financials' && <FinancialView report={report} />}
            </div>
        </div>
    );
}

function TabButton({ label, isActive, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`btn-pill ${isActive ? 'active' : ''}`}
        >
            {label}
        </button>
    );
}

function RecommendationView({ report, recommendationColor, recommendationText, livePrice }) {
    const displayPrice = livePrice || report.recommendation?.current_price || report.recommendation?.price_now;
    const tp = report.recommendation?.target_price;
    let displayUpside = report.recommendation?.upside;

    if (livePrice && tp && tp !== '-' && tp !== 0 && tp !== '0') {
        displayUpside = ((tp - livePrice) / livePrice * 100).toFixed(1);
    } else if (displayUpside != null) {
        displayUpside = Number(displayUpside).toFixed(1);
    }

    const isLive = !!livePrice;

    return (
        <div className="space-y-6">
            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                <StatBox label="Target Price" value={tp?.toLocaleString() ?? '-'} />
                <StatBox label="Upside" value={displayUpside ? `${displayUpside > 0 ? '+' : ''}${displayUpside}%` : '-'} valueColor="text-green" />
                <StatBox
                    label={<>Current Price {isLive && <span className="text-[8px] text-green-400 opacity-70 ml-1" title="Live SSI Data">● Live</span>}</>}
                    value={displayPrice?.toLocaleString() ?? '-'}
                />
                <StatBox label="Method" value={report.recommendation?.valuation_method || 'N/A'} />
            </div>

            {/* QoQ Table */}
            <div className="border border-border rounded overflow-hidden">
                <div className="bg-white/[0.02] px-3 py-2 border-b border-border">
                    <h4 className="text-green font-semibold text-[10px] uppercase tracking-wide">Analyst Call</h4>
                </div>
                <table className="w-full text-[11px]">
                    <tbody>
                        <Row label="Rating" value={recommendationText} valueClass={recommendationColor} />
                        <Row label="Target Price" value={tp?.toLocaleString() ?? '-'} />
                        <Row label="Upside" value={displayUpside ? `${displayUpside > 0 ? '+' : ''}${displayUpside}%` : '-'} valueClass="text-green" />
                        <Row label="Dividend Yield" value={report.recommendation?.dividend_yield ? `${report.recommendation.dividend_yield}%` : '-'} />
                    </tbody>
                </table>
            </div>

            {/* Broker Justification */}
            <div>
                <SectionHeader title="Justification" />
                <p className="text-[11px] text-gray leading-relaxed">
                    {report.recommendation?.justification}
                </p>
            </div>
        </div>
    );
}

function InvestmentView({ report }) {

    return (
        <div className="space-y-6">
            {/* Thesis */}
            <div>
                <SectionHeader title="Investment Thesis" />
                <ul className="custom-list">
                    {report.investment_thesis && report.investment_thesis.map((point, i) => (
                        <li key={i}>{point}</li>
                    ))}
                    {!report.investment_thesis && <li className="text-gray italic">No thesis available.</li>}
                </ul>
            </div>

            {/* Company Update */}
            {report.company_update && report.company_update.length > 0 && (
                <div>
                    <SectionHeader title="Company Update" />
                    <ul className="custom-list">
                        {report.company_update.map((point, i) => (
                            <li key={i}>{point}</li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Risks */}
            {report.risk_assessment && report.risk_assessment.length > 0 && (
                <div>
                    <SectionHeader title="Risk Assessment" color="text-red" />
                    <div className="space-y-3">
                        {report.risk_assessment.map((risk, i) => (
                            <div key={i} className="bg-white/[0.02] p-3 rounded border border-border">
                                <div className="text-[11px] font-bold text-red-400 mb-1">{risk.risk}</div>
                                <div className="text-[11px] text-gray mb-2">{risk.impact}</div>
                                <div className="text-[10px] text-gray uppercase tracking-wide opacity-50">Mitigation</div>
                                <div className="text-[11px] text-gray">{risk.mitigation}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function FinancialView({ report }) {
    const forecast = report.forecast_summary;
    const forecastTable = report.forecast_table;

    return (
        <div className="space-y-6">
            {/* Revenue Forecast heading */}
            <SectionHeader title="Revenue Forecast" />

            {/* Forecast Summary */}
            {forecast ? (
                <div className="border border-border rounded overflow-hidden">
                    {Object.entries(forecast).map(([k, v]) => (
                        <div key={k} className="flex justify-between px-3 py-2 border-b border-border last:border-0 bg-white/[0.01] text-[11px]">
                            <span className="capitalize text-gray">{k.replace(/_/g, ' ')}</span>
                            <span className="font-mono font-medium text-white">
                                {typeof v === 'number' ? v.toLocaleString() : (typeof v === 'object' && v !== null ? JSON.stringify(v) : v || '-')}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-gray text-[11px] italic">No forecast summary available.</div>
            )}

            {/* Financial Forecast Table */}

            {forecastTable && (
                <div>
                    <SectionHeader title="Financial Forecast" />
                    <ForecastTable forecastData={forecastTable} />
                </div>
            )}

            {/* Peer comparison heading */}
            <SectionHeader title="Peer comparison" />
            <div className="text-gray text-[11px] italic">No peer data available</div>
        </div>
    );
}

/* Reusable Components */

function StatBox({ label, value, valueColor = "text-white" }) {
    return (
        <div className="p-3 bg-white/[0.02] rounded border border-border">
            <div className="text-gray text-[10px] uppercase font-bold tracking-wider mb-1">{label}</div>
            <div className={`text-lg font-mono font-bold ${valueColor}`}>{value}</div>
        </div>
    );
}

function SectionHeader({ title, color = "text-green" }) {
    return (
        <h4 className={`${color} font-semibold text-[10px] uppercase tracking-wide mb-3 pb-2 border-b border-border`}>
            {title}
        </h4>
    );
}

function Row({ label, value, valueClass = "" }) {
    return (
        <tr className="border-b border-border last:border-0 hover:bg-white/[0.01]">
            <td className="py-2 px-3 text-gray w-1/3">{label}</td>
            <td className={`py-2 px-3 font-mono text-right font-medium ${valueClass}`}>{value}</td>
        </tr>
    );
}
