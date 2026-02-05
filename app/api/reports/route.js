import { NextResponse } from 'next/server';
import { getReports } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
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

        return NextResponse.json({
            reports,
            total: reports.length
        });
    } catch (error) {
        console.error('Error in /api/reports:', error);
        return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 });
    }
}
