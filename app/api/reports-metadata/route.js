import { NextResponse } from 'next/server';
import { getReportsMetadata } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const metadata = await getReportsMetadata();
        return NextResponse.json(metadata);
    } catch (error) {
        console.error('Error in /api/reports-metadata:', error);
        return NextResponse.json({ error: 'Failed to load metadata' }, { status: 500 });
    }
}
