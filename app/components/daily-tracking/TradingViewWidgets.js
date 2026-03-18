'use client';

import React, { useEffect, useRef } from 'react';

export function TradingViewCalendarWidget() {
    const containerRef = useRef(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';
        const script = document.createElement('script');
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "width": "100%", "height": "100%", "colorTheme": "dark", "isTransparent": true, "locale": "en",
            "importanceFilter": "-1,0,1", "currencyFilter": "USD,VND,EUR,JPY,GBP,CNY"
        });
        container.appendChild(script);

        return () => {
            if (container) container.innerHTML = '';
        };
    }, []);
    return <div ref={containerRef} style={{ height: '100%', width: '100%', overflow: 'hidden' }} />;
}

export function TradingViewAdvancedChartWidget({ symbol }) {
    const containerRef = useRef(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';
        
        const div = document.createElement('div');
        div.id = "tradingview_advanced_" + symbol.replace(':', '_');
        div.style.height = '100%';
        div.style.width = '100%';
        container.appendChild(div);

        const script = document.createElement('script');
        script.src = "https://s3.tradingview.com/tv.js";
        script.type = "text/javascript";
        script.async = true;
        script.onload = () => {
            if (typeof window.TradingView !== 'undefined') {
                new window.TradingView.widget({
                    "autosize": true,
                    "symbol": symbol,
                    "interval": "D",
                    "timezone": "Etc/UTC",
                    "theme": "dark",
                    "style": "1",
                    "locale": "en",
                    "toolbar_bg": "#f1f3f6",
                    "enable_publishing": false,
                    "withdateranges": true,
                    "hide_side_toolbar": false,
                    "allow_symbol_change": true,
                    "container_id": div.id,
                    "studies": [
                      "MASimple@tv-basicstudies",
                      "RSI@tv-basicstudies",
                      "MACD@tv-basicstudies"
                    ]
                });
            }
        };
        container.appendChild(script);

        return () => {
            if (container) container.innerHTML = '';
        };
    }, [symbol]);

    return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}

export function TradingViewMiniChartWidget({ symbol, timeFilter }) {
    const containerRef = useRef(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.innerHTML = '';

        let dateRange = "12M";
        if (timeFilter === '1M') dateRange = "1M";
        else if (timeFilter === '3M') dateRange = "3M";
        else if (timeFilter === '6M') dateRange = "6M";
        else if (timeFilter === 'YTD') dateRange = "YTD";
        else if (timeFilter === '1Y') dateRange = "12M";
        else if (timeFilter === 'ALL') dateRange = "ALL";

        const script = document.createElement('script');
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
            "symbol": symbol, "width": "100%", "height": "100%", "locale": "en", "dateRange": dateRange,
            "colorTheme": "dark", "isTransparent": true, "autosize": true, "largeChartUrl": ""
        });
        container.appendChild(script);

        return () => {
            if (container) container.innerHTML = '';
        };
    }, [symbol, timeFilter]);
    return <div ref={containerRef} style={{ height: '100%', width: '100%', overflow: 'hidden' }} />;
}
