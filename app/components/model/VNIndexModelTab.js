'use client';

import { useState, useEffect, useCallback } from 'react';
import ReportKPICards from './ReportKPICards';
import MarketStoryChart from './MarketStoryChart';
import BrokerSentimentChart from './BrokerSentimentChart';
import KeyTargetsChart from './KeyTargetsChart';
import MasterStockTable from './MasterStockTable';
import ActionPlanWidget from './ActionPlanWidget';
import HistoricalCallsTable from './HistoricalCallsTable';
import HistoricalComparisonChart from './HistoricalComparisonChart';
import ModelRegimeChart from './ModelRegimeChart';
import RegimeExplainabilityWidget from './RegimeExplainabilityWidget';
import PerformanceMetricsGrid from './PerformanceMetricsGrid';
import ModelCalendarFilter from './ModelCalendarFilter';
import SectorFlowChart from './SectorFlowChart';
import ModelEvaluationWidget from './ModelEvaluationWidget';

export default function VNIndexModelTab() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedDate, setSelectedDate] = useState('');
    const [regimeHistory, setRegimeHistory] = useState([]);

    const fetchModelData = useCallback(async (date) => {
        setLoading(true);
        try {
            const url = date ? `/api/model-report?date=${date}` : '/api/model-report';
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error("API Failure");
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            setData(json);
        } catch (err) {
            console.error("Fetch Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        console.log("VNIndexModelTab: Fetching for date:", selectedDate);
        fetchModelData(selectedDate);
    }, [selectedDate, fetchModelData]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await fetch('/api/model-regime-history');
                const json = await res.json();
                if (json.history) setRegimeHistory(json.history);
            } catch (err) {
                console.error("History Fetch Error:", err);
            }
        };
        fetchHistory();
    }, []);

    if (loading && !data) {
        return (
            <div className="flex flex-col h-[70vh] items-center justify-center bg-[#0a0a0a]">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-emerald-500 mb-4"></div>
                <div className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.3em]">Calibrating Neural Core...</div>
            </div>
        );
    }

    const {
        meta, story, broker, horizons, topPicks, exitWarnings, actionPlan,
        historicalCalls, performanceMetrics, availableDates, features, evaluation
    } = data || {};

    const isHistorical = meta?.isHistorical || (selectedDate !== '');

    return (
        <div style={{ 
            minHeight: '100vh', 
            backgroundColor: '#050505', 
            color: 'white', 
            padding: '4rem 5rem', // Significant margin increase
            opacity: loading && !data ? 0.5 : 1,
            transition: 'opacity 0.5s',
            overflowX: 'hidden',
            fontFamily: 'Inter, system-ui, sans-serif'
        }}>
            <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '5rem' }}>

                <header style={{ 
                    display: 'flex', 
                    flexDirection: 'row', 
                    alignItems: 'baseline', 
                    justifyContent: 'space-between', 
                    flexWrap: 'wrap', 
                    gap: '2rem', 
                    borderBottom: '1px solid rgba(255,255,255,0.03)', 
                    paddingBottom: '3rem',
                    marginBottom: '1rem'
                }}>
                    <div style={{ flex: 1, minWidth: '400px' }}>
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1.5rem', marginBottom: '0.75rem' }}>
                            <h1 style={{ 
                                fontSize: 'clamp(3rem, 7vw, 6.5rem)', 
                                fontWeight: '900', 
                                letterSpacing: '-0.07em', 
                                textTransform: 'uppercase', 
                                margin: 0,
                                lineHeight: 0.8,
                                color: '#fff'
                            }}>
                                Model <span style={{ color: '#10b981', fontStyle: 'italic', WebkitTextStroke: '2px #10b981', WebkitTextFillColor: 'transparent' }}>Regime</span>
                            </h1>
                            {isHistorical && (
                                <div style={{ 
                                    padding: '6px 14px', 
                                    backgroundColor: '#fbbf24', 
                                    color: 'black', 
                                    fontSize: '10px', 
                                    fontWeight: '900', 
                                    textTransform: 'uppercase', 
                                    letterSpacing: '0.2em', 
                                    borderRadius: '2px',
                                    marginTop: '1rem'
                                }}>
                                    Archive.Series
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1rem', color: '#444', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.4em' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 15px rgba(16,185,129,0.5)' }}></div>
                            Processing Layer V4.1 <span style={{ color: '#1a1a1a', margin: '0 4px' }}>/</span> <span style={{ color: '#fff' }}>[{meta?.date || 'SYNCING'}]</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
                        <ModelCalendarFilter
                            availableDates={availableDates}
                            selectedDate={selectedDate}
                            onDateChange={(d) => setSelectedDate(d)}
                        />
                    </div>
                </header>

                {/* Main Content Sections */}
                <ReportKPICards meta={meta} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem' }}>
                    <div style={{ minHeight: '520px', backgroundColor: '#0d1117', borderRadius: '24px', border: '1px solid #1a1a1a', padding: '2rem', overflow: 'hidden' }}>
                        <ModelRegimeChart 
                            history={regimeHistory} 
                            selectedDate={selectedDate || meta?.date} 
                            onDateClick={(d) => setSelectedDate(d)} 
                        />
                    </div>
                    <div style={{ minHeight: '520px', backgroundColor: '#0d1117', borderRadius: '24px', border: '1px solid #1a1a1a', padding: '2rem' }}>
                        <RegimeExplainabilityWidget 
                            features={features} 
                            regime={meta?.regime} 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
                    <div className="xl:col-span-4 space-y-10">
                        <MarketStoryChart story={story} />
                        <BrokerSentimentChart broker={broker} />
                    </div>

                    <div className="xl:col-span-8 space-y-10">
                        <SectorFlowChart features={features || {}} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <ActionPlanWidget plan={actionPlan} history={historicalCalls} />
                            <KeyTargetsChart horizons={horizons} />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-10 border-t border-gray-900/40">
                    <div className="lg:col-span-4 space-y-8">
                        <div className="flex items-center gap-3 px-2">
                            <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                            <h2 className="text-[11px] font-black uppercase tracking-[0.4em]">Decision Analysis</h2>
                        </div>
                        <ModelEvaluationWidget evaluation={evaluation} />
                    </div>

                    <div className="lg:col-span-8 space-y-8">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                                <h2 className="text-[11px] font-black uppercase tracking-[0.4em]">Tactical Picks & Warnings</h2>
                            </div>
                            <span className="text-[9px] text-gray-700 font-bold uppercase tracking-[0.3em]">Quantum Strategy Active</span>
                        </div>
                        <MasterStockTable topPicks={topPicks} exitWarnings={exitWarnings} />
                    </div>
                </div>

                <div className="space-y-10 pt-16 border-t border-gray-900/50">
                    <div className="flex items-center gap-3 px-2">
                        <div className="w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                        <h2 className="text-[11px] font-black uppercase tracking-[0.5em]">Historical Benchmarking</h2>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '2.5rem' }}>
                        <div style={{ gridColumn: 'span 4' }}>
                            <PerformanceMetricsGrid metrics={performanceMetrics} />
                        </div>
                        <div style={{ gridColumn: 'span 8' }}>
                            <HistoricalComparisonChart history={historicalCalls} />
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-gray-900 bg-[#0d1117]/20 shadow-2xl">
                        <HistoricalCallsTable history={historicalCalls} />
                    </div>
                </div>

                <footer className="pt-32 pb-16 flex flex-col items-center border-t border-gray-900/20">
                    <div className="flex gap-4 mb-8 grayscale opacity-10">
                        <div className="w-10 h-1 bg-white"></div>
                        <div className="w-10 h-1 bg-white"></div>
                        <div className="w-10 h-1 bg-white"></div>
                    </div>
                    <p className="text-[9px] text-gray-800 font-black uppercase tracking-[1.5em] text-center">
                        PROPRIETARY NEURAL DISCOVERY CORE V2.41
                    </p>
                </footer>
            </div>

            <div className="hidden" id="model-state-debug">
                {JSON.stringify({ hasFeatures: !!features, hasEval: !!evaluation, date: meta?.date })}
            </div>
        </div>
    );
}
