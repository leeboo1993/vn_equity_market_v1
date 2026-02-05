import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Helper to get quarter from date string
function getQuarterFromDate(dateString) {
    if (!dateString || dateString.length !== 6) return null;

    const yy = parseInt(dateString.substring(0, 2));
    const mm = parseInt(dateString.substring(2, 4));
    const dd = parseInt(dateString.substring(4, 6));
    const year_yymmdd = 2000 + yy;

    const isValidYYMMDD = (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && year_yymmdd <= 2030);

    if (isValidYYMMDD) {
        const quarter = Math.ceil(mm / 3);
        return { quarter, year: year_yymmdd, label: `Q${quarter} ${year_yymmdd}` };
    }

    return null;
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        // Filter parameters (same as reports endpoint)
        const ticker = searchParams.get('ticker') || 'All';
        const broker = searchParams.get('broker') || 'All';
        const sector = searchParams.get('sector') || 'All';
        const period = searchParams.get('period') || 'All';
        const filterTargets = searchParams.get('filterTargets') === 'true';

        // Read reports.json from public directory
        const reportsPath = path.join(process.cwd(), 'public', 'reports.json');

        if (!fs.existsSync(reportsPath)) {
            return NextResponse.json({ error: 'Reports data not found' }, { status: 404 });
        }

        const reportsData = JSON.parse(fs.readFileSync(reportsPath, 'utf-8'));

        if (!Array.isArray(reportsData)) {
            return NextResponse.json({ error: 'Invalid reports data format' }, { status: 500 });
        }

        // Apply same filters as reports endpoint
        let filteredReports = reportsData.filter(r => {
            if (ticker !== 'All' && r.info_of_report?.ticker !== ticker) return false;
            if (broker !== 'All' && r.info_of_report?.issued_company !== broker) return false;
            if (sector !== 'All' && r.info_of_report?.sector !== sector) return false;

            if (period !== 'All') {
                const q = getQuarterFromDate(r.info_of_report?.date_of_issue);
                if (!q || q.label !== period) return false;
            }

            if (filterTargets) {
                const tp = r.recommendation?.target_price;
                const numericTp = Number(tp);
                const hasTP = tp != null && !isNaN(numericTp) && numericTp > 0;

                const cp = r.recommendation?.price_now;
                const numericCp = Number(cp);
                const hasCP = cp != null && !isNaN(numericCp) && numericCp > 0;

                if (!hasTP || !hasCP) return false;
            }

            return true;
        });

        // Calculate statistics
        const uniqueTickers = [...new Set(filteredReports.map(r => r.info_of_report?.ticker))].filter(Boolean).sort();
        const uniqueBrokers = [...new Set(filteredReports.map(r => r.info_of_report?.issued_company))]
            .filter(b => b && b.length < 15)
            .sort();
        const uniqueSectors = [...new Set(filteredReports.map(r => r.info_of_report?.sector))].filter(Boolean).sort();
        const uniqueQuarters = [...new Set(filteredReports.map(r => {
            const q = getQuarterFromDate(r.info_of_report?.date_of_issue);
            return q ? q.label : null;
        }).filter(Boolean))].sort((a, b) => {
            const [qA, yA] = a.split(' ');
            const [qB, yB] = b.split(' ');
            const valA = parseInt(yA) * 10 + parseInt(qA.replace('Q', ''));
            const valB = parseInt(yB) * 10 + parseInt(qB.replace('Q', ''));
            return valB - valA; // Descending
        });

        // Top calls by upside_at_call
        const topCalls = [...filteredReports]
            .filter(r => r.recommendation?.upside_at_call != null)
            .sort((a, b) => (b.recommendation?.upside_at_call ?? -999) - (a.recommendation?.upside_at_call ?? -999))
            .slice(0, 10)
            .map(r => ({
                id: r.id,
                ticker: r.info_of_report?.ticker,
                broker: r.info_of_report?.issued_company,
                date: r.info_of_report?.date_of_issue,
                recommendation: r.recommendation?.recommendation,
                target_price: r.recommendation?.target_price,
                upside_at_call: r.recommendation?.upside_at_call
            }));

        // Distribution for chart
        let buy = 0, hold = 0, sell = 0;
        filteredReports.forEach(r => {
            const rec = r.recommendation?.recommendation;
            if (!rec) { hold++; return; }
            const recLower = rec.toLowerCase();
            if (['buy', 'outperform', 'add', 'accumulate', 'overweight', 'strong buy'].some(k => recLower.includes(k))) {
                buy++;
            } else if (['sell', 'underperform', 'reduce', 'underweight'].some(k => recLower.includes(k))) {
                sell++;
            } else {
                hold++;
            }
        });

        return NextResponse.json({
            total: filteredReports.length,
            uniqueTickers,
            uniqueBrokers,
            uniqueSectors,
            uniqueQuarters,
            topCalls,
            distribution: { buy, hold, sell }
        });

    } catch (error) {
        console.error('Error in reports-metadata API:', error);
        return NextResponse.json(
            { error: 'Failed to fetch metadata', details: error.message },
            { status: 500 }
        );
    }
}
