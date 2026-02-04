'use client';

import Header from '../components/Header';

export default function StrategyResearchPage() {
    return (
        <>
            <Header title="Strategy Research Panel" />

            <main className="main-container px-6 py-8">
                <div className="placeholder-card bg-[#111] border border-[#222] rounded-xl p-12 text-center">
                    <div className="placeholder-icon text-4xl mb-4">📈</div>
                    <h2 className="text-xl font-bold text-white mb-2">Strategy Research</h2>
                    <p className="text-gray-400">Investment strategies and portfolio analysis coming soon.</p>
                </div>
            </main>
        </>
    );
}
