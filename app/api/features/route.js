import { NextResponse } from 'next/server';
import { getFeatureSettings } from '../../../lib/rbac';

// Public endpoint - anyone can read feature settings
export async function GET() {
    try {
        const features = await getFeatureSettings();
        return NextResponse.json(features);
    } catch (error) {
        console.error('Error fetching features:', error);
        return NextResponse.json(
            { error: 'Failed to fetch features' },
            { status: 500 }
        );
    }
}
