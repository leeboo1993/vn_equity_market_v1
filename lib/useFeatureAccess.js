'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

// Default features - fallback when R2 fetch fails
const DEFAULT_FEATURES = {
    'Daily Tracking': ['admin', 'member', 'guest'],
    'Company Research': ['admin', 'member'],
    'Macro Research': ['admin'],
    'Strategy Research': ['admin', 'member'],
    'Broker Sentiment': ['admin', 'member'],
    'DL Equity': ['admin', 'member'],
    'Export Data': ['admin'],
};

export function useFeatureAccess() {
    const { data: session } = useSession();
    const [features, setFeatures] = useState(DEFAULT_FEATURES);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchFeatures() {
            try {
                // Use public endpoint that doesn't require admin auth
                const res = await fetch('/api/features');
                if (res.ok) {
                    const data = await res.json();
                    setFeatures(data);
                } else {
                    // Use defaults if API fails
                    setFeatures(DEFAULT_FEATURES);
                }
            } catch (e) {
                console.error('Failed to fetch features:', e);
                setFeatures(DEFAULT_FEATURES);
            } finally {
                setLoading(false);
            }
        }

        if (session?.user) {
            fetchFeatures();
        } else {
            setLoading(false);
        }
    }, [session]);

    const hasAccess = (featureName) => {
        if (!session?.user?.role) return false;
        if (session.user.role === 'admin') return true;

        const allowedRoles = features[featureName] || [];
        return allowedRoles.includes(session.user.role);
    };

    return { hasAccess, features, loading };
}
