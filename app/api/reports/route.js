import { NextResponse } from 'next/server';
import { getFullRawReports, enrichReportsBatch, getQuarterLabel, getThinReports } from '@/lib/data';
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
            await limiter.check(NextResponse.next(), 20, ip); // 20 requests per minute
        } catch {
            return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
        }

        const { searchParams } = new URL(request.url);
        const quartersParam = searchParams.get('quarters');
        const tickerParam = searchParams.get('ticker');
        const brokerParam = searchParams.get('broker'); // issued_company
        const sectorParam = searchParams.get('sector');
        const rawParam = searchParams.get('raw') === 'true';
        const idsParam = searchParams.get('ids');

        // PERFORMANCE: Use thin reports for "raw" initial loads.
        // Use full reports ONLY for enrichment (raw=false) or specific requests.
        let reports;
        if (rawParam && !idsParam) {
            reports = await getThinReports();
        } else {
            reports = await getFullRawReports();
        }

        // 1. Filter by Quarter(s)
        if (quartersParam && quartersParam !== 'all') {
            const quartersToLoad = quartersParam.split(',');
            reports = reports.filter(r => {
                const qLabel = getQuarterLabel(r.info_of_report?.date_of_issue);
                return qLabel && quartersToLoad.includes(qLabel);
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

        // 5. Filter by IDs (New for background enrichment)
        if (idsParam) {
            const idList = idsParam.split(',');
            reports = reports.filter(r => idList.includes(r.id));
        }

        // --- OPTIMIZED LOADING ---
        let finalReports;
        if (rawParam) {
            finalReports = reports;
        } else {
            finalReports = await enrichReportsBatch(reports);
        }

        // 6. Pagination
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        const total = finalReports.length;
        const paginatedReports = finalReports.slice(startIndex, endIndex);

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
