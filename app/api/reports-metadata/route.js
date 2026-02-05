import { NextResponse } from 'next/server';
import { getReports } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const reports = await getReports();

        // Extract unique metadata
        const uniqueTickers = [...new Set(reports.map(r => r.info_of_report?.ticker).filter(Boolean))].sort();
        const uniqueBrokers = [...new Set(reports.map(r => r.info_of_report?.issued_company).filter(Boolean))].sort();
        const uniqueSectors = [...new Set(reports.map(r => r.info_of_report?.sector).filter(Boolean))].sort();

        // Extract unique quarters
        // Format of reports date: YYMMDD
        const quartersSet = new Set();
        reports.forEach(r => {
            const dStr = r.info_of_report?.date_of_issue;
            if (dStr && dStr.length === 6) {
                const yy = parseInt(dStr.substring(0, 2));
                const mm = parseInt(dStr.substring(2, 4));
                const year = 2000 + yy;
                if (!isNaN(year) && !isNaN(mm)) {
                    const q = Math.ceil(mm / 3);
                    quartersSet.add(`Q${q} ${year}`);
                }
            }
        });

        // Custom sort for quarters (Descending: Q4 2025, Q3 2025...)
        const uniqueQuarters = [...quartersSet].sort((a, b) => {
            const [qA, yA] = a.split(' ');
            const [qB, yB] = b.split(' ');
            if (yA !== yB) return parseInt(yB) - parseInt(yA);
            return parseInt(qB.replace('Q', '')) - parseInt(qA.replace('Q', ''));
        });

        return NextResponse.json({
            uniqueTickers,
            uniqueBrokers,
            uniqueSectors,
            uniqueQuarters,
            totalReports: reports.length
        });
    } catch (error) {
        console.error('Error in /api/reports-metadata:', error);
        return NextResponse.json({ error: 'Failed to load metadata' }, { status: 500 });
    }
}
