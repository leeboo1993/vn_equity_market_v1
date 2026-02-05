import { NextResponse } from 'next/server';
import { getFullRawReports, enrichReportsBatch } from '@/lib/data';
import { getStockInfoMap } from '@/lib/stockInfo';
import { getPriceHistoryMap } from '@/lib/priceHistory';
import rateLimit from '@/lib/rateLimit';

const limiter = rateLimit({
    interval: 60 * 1000, // 60 seconds
    uniqueTokenPerInterval: 500, // Max 500 users per second
});

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        // Trigger background fetches immediately (Parallel Execution)
        // We don't await them here; we let them start downloading/parsing while we do other checks.
        // They will be awaited downstream in enrichReportsBatch or getRawReports.
        getStockInfoMap();
        getPriceHistoryMap();

        // Rate Limiting
        const ip = request.headers.get('x-forwarded-for') || 'anonymous';
        try {
            await limiter.check(NextResponse.next(), 200, ip); // Increased to 200 to support parallel pagination
        } catch {
            return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
        }

        const { searchParams } = new URL(request.url);
        const idParam = searchParams.get('id');

        // 0. Single Report Fetch (Full Detail)
        if (idParam) {
            const { getReport } = await import('@/lib/data');
            const report = await getReport(idParam);
            if (report) {
                return NextResponse.json(report);
            } else {
                return NextResponse.json({ error: 'Report not found' }, { status: 404 });
            }
        }

        const quartersParam = searchParams.get('quarters');
        const tickerParam = searchParams.get('ticker');
        const brokerParam = searchParams.get('broker'); // issued_company
        const sectorParam = searchParams.get('sector');

        // 1. Get Raw Reports (FULL DATA now, as requested)
        let reports = await getFullRawReports();

        // 2. Filter by Quarter(s)
        if (quartersParam && quartersParam !== 'all') {
            const quartersToLoad = quartersParam.split(',');
            // Format of reports date: YYMMDD
            // Helper to get Q from YYMMDD
            reports = reports.filter(r => {
                const dStr = String(r.info_of_report?.date_of_issue || '').trim();
                let year, mm;

                if (dStr.length === 8) {
                    year = parseInt(dStr.substring(0, 4));
                    mm = parseInt(dStr.substring(4, 6));
                } else if (dStr.length === 6) {
                    year = 2000 + parseInt(dStr.substring(0, 2));
                    mm = parseInt(dStr.substring(2, 4));
                }

                if (year && mm >= 1 && mm <= 12 && year <= 2030) {
                    const q = Math.ceil(mm / 3);
                    const qLabel = `Q${q} ${year}`;
                    return quartersToLoad.includes(qLabel);
                }
                return false;
            });
        }

        // 3. Filter by Ticker
        if (tickerParam) {
            reports = reports.filter(r => r.info_of_report?.ticker === tickerParam);
        }

        // 4. Filter by Broker
        if (brokerParam) {
            reports = reports.filter(r => r.info_of_report?.issued_company === brokerParam);
        }

        // 5. Filter by Sector
        if (sectorParam && sectorParam !== 'All') {
            reports = reports.filter(r => r.info_of_report?.sector === sectorParam);
        }

        // 6. Pagination (Slice RAW data first)
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        const total = reports.length;

        // Calculate available quarters from the filtered set (for UI dropdowns)
        const quartersSet = new Set();
        reports.forEach(r => {
            const dStr = String(r.info_of_report?.date_of_issue || '').trim();
            let year, mm;

            if (dStr.length === 8) {
                year = parseInt(dStr.substring(0, 4));
                mm = parseInt(dStr.substring(4, 6));
            } else if (dStr.length === 6) {
                year = 2000 + parseInt(dStr.substring(0, 2));
                mm = parseInt(dStr.substring(2, 4));
            }

            if (year && mm >= 1 && mm <= 12 && year <= 2030) {
                const q = Math.ceil(mm / 3);
                quartersSet.add(`Q${q} ${year}`);
            }
        });
        const loadedQuarters = Array.from(quartersSet).sort((a, b) => b.localeCompare(a));

        // Optimization: Slice first, then enrich only the slice
        const paginatedRawReports = reports.slice(startIndex, endIndex);

        // 7. Enrich ONLY the paginated chunk
        const enrichedReports = await enrichReportsBatch(paginatedRawReports);

        return NextResponse.json({
            reports: enrichedReports,
            total,
            page,
            limit,
            hasMore: endIndex < total,
            loadedQuarters // Return calculated quarters
        });
    } catch (error) {
        console.error('Error in /api/reports:', error);
        return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 });
    }
}
