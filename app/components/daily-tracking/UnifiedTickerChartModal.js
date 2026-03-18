'use client';

import React from 'react';
import { TradingViewAdvancedChartWidget } from './TradingViewWidgets';

export default function UnifiedTickerChartModal({ ticker, onClose }) {
    if (!ticker) return null;

    // Helper to format ticker for TradingView
    const formatTVSymbol = (symbol) => {
        const s = symbol.toUpperCase().trim();
        // If already has exchange prefix, return as is
        if (s.includes(':')) return s;
        
        // Common indices
        if (s === 'VNINDEX') return 'HOSE:VNINDEX';
        if (s === 'VN30') return 'HOSE:VN30';
        if (s === 'DXY') return 'INDEX:DXY';
        if (s === 'GOLD') return 'TVC:GOLD';
        
        // Common crypto defaults - CHECK THESE BEFORE THE 3-LETTER RULE
        const crypto = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOT', 'DOGE', 'MATIC', 'AVAX', 'LINK'];
        if (crypto.includes(s)) return `BINANCE:${s}USDT`;
        
        // Default to HOSE for 3-letter tickers (standard Vietnamese stocks)
        if (s.length === 3 && /^[A-Z]{3}$/.test(s)) return `HOSE:${s}`;
        
        return s;
    };

    const tvSymbol = formatTVSymbol(ticker);

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }} onClick={onClose}>
            
            <div style={{
                backgroundColor: '#111',
                border: '1px solid #333',
                borderRadius: '12px',
                width: '95%',
                maxWidth: '1200px',
                height: '85vh',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid #222',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'linear-gradient(to bottom, #1a1a1a, #111)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff' }}>
                                {ticker} Chart
                            </h3>
                            <span style={{ fontSize: '12px', color: '#666', background: '#222', padding: '2px 8px', borderRadius: '4px' }}>
                                {tvSymbol}
                            </span>
                        </div>
                        
                        <a 
                            href={`https://www.tradingview.com/symbols/${tvSymbol.replace(':', '-')}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                fontSize: '12px',
                                color: '#38bdf8',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(56, 189, 248, 0.1)',
                                padding: '4px 10px',
                                borderRadius: '4px',
                                transition: 'all 0.2s',
                                fontWeight: 500
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'}
                        >
                            <span>Open in TradingView</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                    </div>
                    
                    <button 
                        onClick={onClose}
                        style={{
                            background: '#222',
                            border: '1px solid #333',
                            color: '#888',
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.color = '#fff';
                            e.currentTarget.style.borderColor = '#555';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.color = '#888';
                            e.currentTarget.style.borderColor = '#333';
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, position: 'relative', padding: '0', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ flex: 1, minHeight: 0 }}>
                        <TradingViewAdvancedChartWidget symbol={tvSymbol} />
                    </div>
                    
                    {/* Fallback Tip */}
                    <div style={{ 
                        padding: '8px 24px', 
                        fontSize: '11px', 
                        color: '#666', 
                        background: '#0a0a0a', 
                        borderTop: '1px solid #1a1a1a',
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '12px'
                    }}>
                        <span>Some tickers may be restricted in embedded views. Use the external link above if the chart fails to load.</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
