'use client';

import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function ModelPage() {
    const [forecast, setForecast] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    useEffect(() => {
        async function fetchForecast() {
            try {
                const res = await fetch('/api/forecast');
                if (!res.ok) {
                    if (res.status === 404) {
                        setError('No forecast available yet. The model pipeline may not have run today.');
                    } else {
                        setError('Failed to load forecast data.');
                    }
                    return;
                }
                const data = await res.json();
                setForecast(data);
            } catch (e) {
                setError('Connection error. Please try again.');
            } finally {
                setLoading(false);
            }
        }
        if (status === 'authenticated') fetchForecast();
    }, [status]);

    if (status === 'loading' || loading) {
        return (
            <div style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ color: '#888', fontSize: '14px' }}>Loading VN-Index Forecast...</div>
            </div>
        );
    }

    // Helper for formatting
    const fmtPct = (v) => v != null ? `${(v * 100).toFixed(2)}%` : '-';
    const fmtPrice = (v) => v != null ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    const fmtDate = (d) => {
        if (!d) return '-';
        const dt = new Date(d);
        return dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const isUp = forecast?.headline?.direction === 'UP';
    const accentColor = isUp ? '#00ff7f' : '#ff4444';

    // Parse report text into sections
    const parseReportSections = (text) => {
        if (!text) return [];
        const lines = text.split('\n');
        const sections = [];
        let currentSection = null;

        for (const line of lines) {
            // Detect section headers (lines of === or lines followed by ===)
            if (line.match(/^={3,}/) || line.match(/^-{20,}/)) {
                continue;
            }

            // Major section headers
            if (line.match(/^(VN-INDEX DAILY INSIGHT|THE STORY|KEY TARGETS|SIGNAL QUALITY|Action Plan|Stock recommendation|TOP PICKS|ACTIVE RECOMMENDATIONS|EXIT WARNINGS|APPENDIX|BROKER VIEW|📖)/)) {
                currentSection = { title: line.trim(), lines: [] };
                sections.push(currentSection);
                continue;
            }

            if (line.startsWith('Market View:') || line.startsWith('Market Regime:') || line.startsWith('Target for') || line.startsWith('Forecast Conviction:')) {
                // These are header-level lines, skip since we render them in the structured view
                continue;
            }

            if (currentSection) {
                currentSection.lines.push(line);
            }
        }
        return sections;
    };

    return (
        <>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Header */}
            <header className="header-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}
                    >
                        ☰
                    </button>
                    <h1 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                        🧠 VN-Index model
                    </h1>
                </div>
                {forecast?.meta && (
                    <div style={{ color: '#888', fontSize: '10px' }}>
                        Model: {forecast.meta.model_version} | Data: {fmtDate(forecast.meta.data_date)} | Generated: {new Date(forecast.meta.generated_at).toLocaleString()}
                    </div>
                )}
            </header>

            <div style={{
                padding: '1.5rem',
                background: '#0a0a0a',
                minHeight: 'calc(100vh - 60px)',
                maxWidth: '1200px',
                margin: '0 auto'
            }}>
                {error ? (
                    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
                        <div style={{ color: '#888', fontSize: '13px' }}>{error}</div>
                    </div>
                ) : forecast ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                        {/* === ROW 1: Headline + Regime + Forces === */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>

                            {/* Headline Card */}
                            <div className="card" style={{ padding: '1.2rem', background: 'linear-gradient(135deg, rgba(10,10,10,1) 0%, rgba(20,20,20,1) 100%)' }}>
                                <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Tomorrow's Forecast
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', marginBottom: '8px' }}>
                                    <span style={{
                                        fontSize: '32px',
                                        fontWeight: 700,
                                        color: accentColor,
                                        textShadow: `0 0 20px ${accentColor}40`
                                    }}>
                                        {isUp ? '▲' : '▼'} {fmtPct(forecast.headline?.return_1d)}
                                    </span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '4px' }}>
                                    Market View: <span style={{ color: accentColor, fontWeight: 600 }}>{forecast.headline?.market_view}</span>
                                </div>
                                <div style={{ fontSize: '11px', color: '#888' }}>
                                    Close: {fmtPrice(forecast.headline?.close_price)} → Target: <span style={{ color: accentColor, fontWeight: 600 }}>{fmtPrice(forecast.headline?.target_price)}</span>
                                </div>
                            </div>

                            {/* Regime Card */}
                            <div className="card" style={{ padding: '1.2rem' }}>
                                <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Market Regime
                                </div>
                                <div style={{
                                    fontSize: '24px',
                                    fontWeight: 700,
                                    color: forecast.regime?.label === 'Bull' ? '#00ff7f' :
                                        forecast.regime?.label === 'Bear' ? '#ff4444' : '#ffaa00',
                                    marginBottom: '6px'
                                }}>
                                    {forecast.regime?.label || '-'}
                                </div>
                                <div style={{ fontSize: '11px', color: '#888' }}>
                                    Confidence: <span style={{ color: '#fff', fontWeight: 600 }}>{forecast.regime?.confidence ? `${(forecast.regime.confidence * 100).toFixed(0)}%` : '-'}</span>
                                </div>
                            </div>

                            {/* Forces Card */}
                            <div className="card" style={{ padding: '1.2rem' }}>
                                <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    Market Forces
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '11px', color: '#aaa' }}>🐋 Smart Money</span>
                                        <span style={{
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            color: forecast.forces?.smart_money > 0 ? '#00ff7f' : '#ff4444'
                                        }}>
                                            {fmtPct(forecast.forces?.smart_money)}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '11px', color: '#aaa' }}>👥 Retail</span>
                                        <span style={{
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            color: forecast.forces?.retail > 0 ? '#00ff7f' : '#ff4444'
                                        }}>
                                            {fmtPct(forecast.forces?.retail)}
                                        </span>
                                    </div>
                                    {forecast.forces?.convergence && (
                                        <div style={{ fontSize: '9px', color: '#666', marginTop: '4px', borderTop: '1px solid #222', paddingTop: '6px' }}>
                                            {forecast.forces.convergence}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* === ROW 2: Term Structure === */}
                        <div className="card" style={{ padding: '1.2rem' }}>
                            <div style={{ fontSize: '10px', color: '#888', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                Forecast Term Structure
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0' }}>
                                {['t1', 't5', 't22'].map((horizon, i) => {
                                    const d = forecast.term_structure?.[horizon];
                                    if (!d) return null;
                                    const label = ['Tomorrow (T+1)', 'Next Week (T+5)', 'Next Month (T+22)'][i];
                                    const isPositive = d.return > 0;
                                    return (
                                        <div key={horizon} style={{
                                            textAlign: 'center',
                                            padding: '16px 12px',
                                            borderRight: i < 2 ? '1px solid #222' : 'none'
                                        }}>
                                            <div style={{ fontSize: '10px', color: '#888', marginBottom: '6px' }}>{label}</div>
                                            <div style={{
                                                fontSize: '20px',
                                                fontWeight: 700,
                                                color: isPositive ? '#00ff7f' : '#ff4444',
                                                marginBottom: '4px'
                                            }}>
                                                {isPositive ? '+' : ''}{(d.return * 100).toFixed(2)}%
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#aaa' }}>
                                                {fmtPrice(d.price)}
                                            </div>
                                            <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>
                                                {fmtDate(d.date)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* === ROW 3: Full Report === */}
                        {forecast.report_text && (
                            <div className="card" style={{ padding: '1.2rem' }}>
                                <div style={{ fontSize: '10px', color: '#888', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    📋 Full Daily Report
                                </div>
                                <pre style={{
                                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                                    fontSize: '10px',
                                    lineHeight: '1.6',
                                    color: '#ccc',
                                    background: '#111',
                                    padding: '16px',
                                    borderRadius: '8px',
                                    overflowX: 'auto',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    margin: 0,
                                    maxHeight: '600px',
                                    overflowY: 'auto'
                                }}>
                                    {forecast.report_text}
                                </pre>
                            </div>
                        )}

                        {/* === ROW 4: Price Chart === */}
                        {forecast.chart && forecast.chart.length > 0 && (
                            <div className="card" style={{ padding: '1.2rem' }}>
                                <div style={{ fontSize: '10px', color: '#888', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                    📈 VN-Index Price (Last 60 Days)
                                </div>
                                <div style={{ height: '250px', position: 'relative' }}>
                                    <VNIndexChart data={forecast.chart} targetPrice={forecast.headline?.target_price} />
                                </div>
                            </div>
                        )}

                    </div>
                ) : null}
            </div>
        </>
    );
}

// Simple SVG-based chart component (no external dependencies)
function VNIndexChart({ data, targetPrice }) {
    if (!data || data.length === 0) return null;

    const W = 1100;
    const H = 220;
    const PADDING = { top: 20, right: 60, bottom: 30, left: 60 };

    const prices = data.map(d => d.close).filter(Boolean);
    const minPrice = Math.min(...prices) * 0.998;
    const maxPrice = Math.max(...prices, targetPrice || 0) * 1.002;

    const xScale = (i) => PADDING.left + (i / (data.length - 1)) * (W - PADDING.left - PADDING.right);
    const yScale = (v) => PADDING.top + (1 - (v - minPrice) / (maxPrice - minPrice)) * (H - PADDING.top - PADDING.bottom);

    // Build path
    const points = data.map((d, i) => `${xScale(i)},${yScale(d.close)}`);
    const linePath = `M${points.join('L')}`;

    // Area fill
    const areaPath = `${linePath}L${xScale(data.length - 1)},${H - PADDING.bottom}L${xScale(0)},${H - PADDING.bottom}Z`;

    // MA50 path  
    const ma50Points = data.map((d, i) => d.ma_50 ? `${xScale(i)},${yScale(d.ma_50)}` : null).filter(Boolean);
    const ma50Path = ma50Points.length > 1 ? `M${ma50Points.join('L')}` : '';

    // Y-axis labels
    const yTicks = 5;
    const yLabels = Array.from({ length: yTicks }, (_, i) => {
        const val = minPrice + (i / (yTicks - 1)) * (maxPrice - minPrice);
        return { val, y: yScale(val) };
    });

    // X-axis labels (show every ~10th date)
    const xStep = Math.max(1, Math.floor(data.length / 6));
    const xLabels = data.filter((_, i) => i % xStep === 0 || i === data.length - 1);

    const lastPrice = prices[prices.length - 1];
    const lastY = yScale(lastPrice);
    const targetY = targetPrice ? yScale(targetPrice) : null;

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
            {/* Grid lines */}
            {yLabels.map((t, i) => (
                <g key={i}>
                    <line x1={PADDING.left} y1={t.y} x2={W - PADDING.right} y2={t.y} stroke="#1a1a1a" strokeWidth="1" />
                    <text x={PADDING.left - 8} y={t.y + 3} fill="#555" fontSize="9" textAnchor="end">
                        {t.val.toFixed(0)}
                    </text>
                </g>
            ))}

            {/* Area fill */}
            <path d={areaPath} fill="url(#chartGradient)" opacity="0.3" />

            {/* Gradient definition */}
            <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00ff7f" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#00ff7f" stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* MA50 line */}
            {ma50Path && (
                <path d={ma50Path} fill="none" stroke="#ffaa00" strokeWidth="1" strokeDasharray="4,4" opacity="0.5" />
            )}

            {/* Price line */}
            <path d={linePath} fill="none" stroke="#00ff7f" strokeWidth="2" />

            {/* Target price line */}
            {targetY && (
                <>
                    <line x1={PADDING.left} y1={targetY} x2={W - PADDING.right} y2={targetY}
                        stroke={targetPrice > lastPrice ? '#00ff7f' : '#ff4444'} strokeWidth="1" strokeDasharray="6,3" opacity="0.7" />
                    <text x={W - PADDING.right + 4} y={targetY + 3} fill={targetPrice > lastPrice ? '#00ff7f' : '#ff4444'} fontSize="9">
                        T: {targetPrice?.toFixed(0)}
                    </text>
                </>
            )}

            {/* Last price dot */}
            <circle cx={xScale(data.length - 1)} cy={lastY} r="4" fill="#00ff7f" />
            <text x={W - PADDING.right + 4} y={lastY + 3} fill="#fff" fontSize="9" fontWeight="600">
                {lastPrice?.toFixed(0)}
            </text>

            {/* X-axis labels */}
            {data.map((d, i) => {
                if (i % xStep !== 0 && i !== data.length - 1) return null;
                return (
                    <text key={i} x={xScale(i)} y={H - 8} fill="#555" fontSize="8" textAnchor="middle">
                        {d.date?.slice(5)} {/* MM-DD format */}
                    </text>
                );
            })}
        </svg>
    );
}
