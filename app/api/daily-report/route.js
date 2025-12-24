import { getDailyReportData } from '@/lib/data';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 10800; // 3 hours

export async function GET() {
    try {
        const data = await getDailyReportData();
        if (!data) {
            return NextResponse.json({ error: 'No daily report data available' }, { status: 404 });
        }
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching daily report data:', error);
        return NextResponse.json({ error: 'Failed to fetch daily report data' }, { status: 500 });
    }
}
