'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';

export function useFeatureAccess() {
    const { data: session } = useSession();
    const [features, setFeatures] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchFeatures() {
            try {
                const res = await fetch('/api/admin/features');
                if (res.ok) {
                    const data = await res.json();
                    setFeatures(data);
                }
            } catch (e) {
                console.error('Failed to fetch features:', e);
            } finally {
                setLoading(false);
            }
        }

        if (session?.user) {
            fetchFeatures();
        }
    }, [session]);

    const hasAccess = (featureName) => {
        if (!session?.user?.role || !features) return false;
        if (session.user.role === 'admin') return true;

        const allowedRoles = features[featureName] || [];
        return allowedRoles.includes(session.user.role);
    };

    return { hasAccess, features, loading };
}
