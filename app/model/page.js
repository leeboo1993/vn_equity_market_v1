'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Header from '../components/Header';
import { useFeatureAccess } from '@/lib/useFeatureAccess';
import VNIndexModelTab from '../components/model/VNIndexModelTab';

export default function ModelsPage() {
    const { data: session, status } = useSession();
    const { hasAccess, loading: loadingFeatures } = useFeatureAccess();

    const [activeTab, setActiveTab] = useState('VN-Index Model');

    const availableTabs = useMemo(() => {
        const tabs = [];
        // Optional feature access gates:
        if (hasAccess('Model')) {
            tabs.push('VN-Index Model');
        }
        return tabs;
    }, [hasAccess]);

    useEffect(() => {
        if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
            setActiveTab(availableTabs[0]);
        }
    }, [availableTabs, activeTab]);

    if (loadingFeatures || status === 'loading') {
        return <div style={{ background: '#0a0a0a', minHeight: '100vh' }}></div>;
    }

    return (
        <div style={{ backgroundColor: '#0a0a0a', minHeight: '100vh', color: '#ccc', fontFamily: 'Inter, sans-serif' }}>
            <Header title="Quantitative Models" />

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
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeTab === 'VN-Index Model' && (
                    <VNIndexModelTab />
                )}
            </div>
        </div>
    );
}
