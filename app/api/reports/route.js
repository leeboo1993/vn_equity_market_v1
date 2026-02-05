import { NextResponse } from 'next/server';
import { getReports } from '@/lib/data';
import rateLimit from '@/lib/rateLimit';

const limiter = rateLimit({
    interval: 60 * 1000, // 60 seconds
    uniqueTokenPerInterval: 500, // Max 500 users per second
});

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        // Rate Limiting
        const ip = request.headers.get('x-forwarded-for') || 'anonymous';
        try {
            await limiter.check(NextResponse.next(), 200, ip); // Increased to 200 to support parallel pagination
        } catch {
            return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
        }

        const { searchParams } = new URL(request.url);
        const quartersParam = searchParams.get('quarters');
        const tickerParam = searchParams.get('ticker');
        const brokerParam = searchParams.get('broker'); // issued_company
        const sectorParam = searchParams.get('sector');

        let reports = await getReports();

        // 1. Filter by Quarter(s)
        if (quartersParam && quartersParam !== 'all') {
            const quartersToLoad = quartersParam.split(',');
            // Format of reports date: YYMMDD
            // Helper to get Q from YYMMDD
            reports = reports.filter(r => {
                const dStr = r.info_of_report?.date_of_issue;
                if (!dStr || dStr.length !== 6) return false;

                const yy = parseInt(dStr.substring(0, 2));
                const mm = parseInt(dStr.substring(2, 4));
                const year = 2000 + yy;
                const q = Math.ceil(mm / 3);
                const qLabel = `Q${q} ${year}`;

                return quartersToLoad.includes(qLabel);
            });
        }

        // 2. Filter by Ticker
        if (tickerParam) {
            reports = reports.filter(r => r.info_of_report?.ticker === tickerParam);
        }

        // 3. Filter by Broker
        if (brokerParam) {
            reports = reports.filter(r => r.info_of_report?.issued_company === brokerParam);
        }

        // 4. Filter by Sector
        if (sectorParam && sectorParam !== 'All') {
            reports = reports.filter(r => r.info_of_report?.sector === sectorParam);
        }

        // 5. Pagination
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        const total = reports.length;
        const paginatedReports = reports.slice(startIndex, endIndex);

        return NextResponse.json({
            reports: paginatedReports,
            total,
            page,
            limit,
            hasMore: endIndex < total
        });
    } catch (error) {
        console.error('Error in /api/reports:', error);
        return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 });
    }
}
