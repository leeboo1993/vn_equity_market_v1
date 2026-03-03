'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Header from '../components/Header';
import { useFeatureAccess } from '@/lib/useFeatureAccess';

import DailyTrackingPage from '../components/DailyBrokerConsensus';
import Dashboard from '../components/Dashboard';
import MacroResearchPage from '../macro-research/page.js';
import StrategyResearchPage from '../strategy-research/page.js';

export default function BrokerConsensusPage() {
    const { data: session, status } = useSession();
    const role = session?.user?.role;
    const { hasAccess, loading: loadingFeatures } = useFeatureAccess();

    const [activeTab, setActiveTab] = useState('Daily');
    const [portalNode, setPortalNode] = useState(null);

    const availableTabs = useMemo(() => {
        const tabs = [];
        if (hasAccess('Broker Consensus - Daily')) tabs.push('Daily');
        if (hasAccess('Broker Consensus - Company')) tabs.push('Company');
        if (hasAccess('Broker Consensus - Macro')) tabs.push('Macro');
        if (hasAccess('Broker Consensus - Strategy')) tabs.push('Strategy');
        return tabs;
    }, [hasAccess]);

    useEffect(() => {
        if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
            setTimeout(() => {
                setActiveTab(availableTabs[0]);
            }, 0);
        }
    }, [availableTabs, activeTab]);

    if (loadingFeatures || status === 'loading') {
        return <div style={{ background: '#0a0a0a', minHeight: '100vh' }}></div>;
    }


    return (
        <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#ccc', fontFamily: 'Inter, sans-serif' }}>
            <Header title="Broker Consensus" />

            {/* Top Tabs */}
            <div style={{ padding: '0 1.5rem', borderBottom: '1px solid #222', background: '#0a0a0a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }} className="hidden-scrollbar">
                    {availableTabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                borderBottom: activeTab === tab ? '2px solid #00a884' : '2px solid transparent',
                                color: activeTab === tab ? '#00a884' : '#888',
                                padding: '12px 4px',
                                fontSize: '13px',
                                fontWeight: activeTab === tab ? 600 : 400,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                marginBottom: '-1px',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
                {/* Filters Portal Target */}
                <div ref={setPortalNode} className="portal-filters-container" style={{
                    display: 'flex',
                    alignItems: 'center',
                    minHeight: '40px'
                }}></div>
                <style jsx>{`
                    @media (max-width: 768px) {
                        .portal-filters-container {
                            width: 100%;
                            justify-content: flex-start;
                        }
                    }
                `}</style>
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeTab === 'Company' && (
                    <Dashboard initialReports={[]} shouldFetchData={true} hideHeader={true} portalNode={portalNode} />
                )}
                {activeTab === 'Macro' && (
                    <MacroResearchPage />
                )}
                {activeTab === 'Strategy' && (
                    <StrategyResearchPage />
                )}
                {activeTab === 'Daily' && (
                    <DailyTrackingPage hideHeader={true} />
                )}
            </div>
        </div>
    );
}
