'use client';

import React, { useState, useEffect } from 'react';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import MarketValuationChart from '@/app/components/MarketValuationChart';

export default function MarketValuationPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const res = await fetch('/api/market-valuation');
                if (!res.ok) {
                    throw new Error(`Failed to fetch data: ${res.statusText}`);
                }
                const result = await res.json();
                setData(result.data);
            } catch (err) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <LoadingSpinner />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-[60vh] text-red-500">
                <p>Error: {error}</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl animate-fade-in">
            <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-400">
                Market Valuation
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-8">
                Track the VN-Index cycle relative to its historical P/E and P/B ratios. Data parsed up to: <b>{new Date(data?.scraped_at).toLocaleString()}</b>
            </p>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col justify-center items-start transition-transform hover:-translate-y-1">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Current P/E</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{data?.currentPe ? data.currentPe.toFixed(2) : '--'}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col justify-center items-start transition-transform hover:-translate-y-1">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Current P/B</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{data?.currentPb ? data.currentPb.toFixed(2) : '--'}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col justify-center items-start transition-transform hover:-translate-y-1">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">5Y P/E Average</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{data?.avg5yPe ? data.avg5yPe.toFixed(2) : '--'}</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col justify-center items-start transition-transform hover:-translate-y-1">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">5Y P/B Average</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{data?.avg5yPb ? data.avg5yPb.toFixed(2) : '--'}</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-gray-100">Market Cycle Historical Chart</h2>
                <MarketValuationChart data={data?.chartData} />
            </div>
        </div>
    );
}
