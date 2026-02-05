import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '@/lib/apiAuth';

// Helper to parse YYMMDD date format
function parseDateYYMMDD(dateStr) {
    if (!dateStr) return null;
    const s = String(dateStr).trim();

    // YYYY-MM-DD
    if (s.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return new Date(s);
    }

    // YYMMDD (6 digits)
    if (s.length === 6) {
        const yy = parseInt(s.substring(0, 2));
        const mm = parseInt(s.substring(2, 4)) - 1;
        const dd = parseInt(s.substring(4, 6));
        return new Date(2000 + yy, mm, dd);
    }

    // YYYYMMDD (8 digits)
    if (s.length === 8) {
        const yyyy = parseInt(s.substring(0, 4));
        const mm = parseInt(s.substring(4, 6)) - 1;
        const dd = parseInt(s.substring(6, 8));
        return new Date(yyyy, mm, dd);
    }

    // Fallback: Try native Date parse
    const nativeDate = new Date(s);
    if (!isNaN(nativeDate.getTime())) {
        return nativeDate;
    }

    return null;
}

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
    // ANTI-CRAWLER: Require authentication + Rate limiting
    const { authorized, response, rateLimitHeaders } = await requireAuth(request);
    if (!authorized) return response;

    try {
        const { searchParams } = new URL(request.url);

        // Quarter-based loading: accepts comma-separated quarters like "Q4 2025,Q3 2025"
        const quartersParam = searchParams.get('quarters');
        const quarters = quartersParam ? quartersParam.split(',').map(q => q.trim()) : [];

        // Filter parameters
        const ticker = searchParams.get('ticker') || 'All';
        const broker = searchParams.get('broker') || 'All';
        const sector = searchParams.get('sector') || 'All';
        const period = searchParams.get('period') || 'All';
        const filterTargets = searchParams.get('filterTargets') === 'true';

        // Read reports.json from protected data directory (NOT public)
        const reportsPath = path.join(process.cwd(), 'data', 'reports.json');

        if (!fs.existsSync(reportsPath)) {
            return NextResponse.json({ error: 'Reports data not found' }, { status: 404 });
        }

        const reportsData = JSON.parse(fs.readFileSync(reportsPath, 'utf-8'));

        if (!Array.isArray(reportsData)) {
            return NextResponse.json({ error: 'Invalid reports data format' }, { status: 500 });
        }

        // Apply filters
        let filteredReports = reportsData.filter(r => {
            // Quarter filter (if quarters specified, only include those quarters)
            if (quarters.length > 0) {
                const q = getQuarterFromDate(r.info_of_report?.date_of_issue);
                if (!q || !quarters.includes(q.label)) return false;
            }

            // Ticker filter
            if (ticker !== 'All' && r.info_of_report?.ticker !== ticker) return false;

            // Broker filter
            if (broker !== 'All' && r.info_of_report?.issued_company !== broker) return false;

            // Sector filter
            if (sector !== 'All' && r.info_of_report?.sector !== sector) return false;

            // Period filter (for single quarter selection)
            if (period !== 'All') {
                const q = getQuarterFromDate(r.info_of_report?.date_of_issue);
                if (!q || q.label !== period) return false;
            }

            // Target price filter
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

        // OPTIMIZATION: Strip heavy text fields to reduce payload size (from 172MB to ~15MB)
        // Keep only fields needed for Dashboard listing and charts
        const lightweightReports = filteredReports.map(r => ({
            id: r.id,
            info_of_report: r.info_of_report,
            recommendation: r.recommendation,
            forecast_summary: r.forecast_summary,
            // forecast_table: r.forecast_table, // Removed to fit 5 quarters into 4.5MB limit
            // company_update: r.company_update ? r.company_update.substring(0, 100) + '...' : null,
        }));

        return NextResponse.json({
            reports: lightweightReports,
            total: lightweightReports.length,
            loadedQuarters: quarters.length > 0 ? quarters : ['all']
        }, {
            headers: rateLimitHeaders
        });


    } catch (error) {
        console.error('Error in reports API:', error);
        return NextResponse.json(
            { error: 'Failed to fetch reports', details: error.message },
            { status: 500 }
        );
    }
}

