import { NextResponse } from 'next/server';
import { getFullRawReports } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const reports = await getFullRawReports();

        // Extract unique metadata from RAW reports (FAST)
        const uniqueTickers = [...new Set(reports.map(r => r.info_of_report?.ticker).filter(Boolean))].sort();
        const uniqueBrokers = [...new Set(reports.map(r => r.info_of_report?.issued_company).filter(Boolean))].sort();
        const uniqueSectors = [...new Set(reports.map(r => r.info_of_report?.sector).filter(Boolean))].sort();

        // Extract unique quarters
        // Support YYMMDD or YYYYMMDD
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
