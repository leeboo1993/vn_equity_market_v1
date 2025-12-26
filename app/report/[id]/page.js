import { getReport, getReports } from '@/lib/data';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ReportDetailClient from '@/app/components/ReportDetailClient';

export async function generateStaticParams() {
    // Return empty array to generate all pages on-demand (ISR/SSR behavior for build)
    // 7000+ pages is too many for standard build validation
    return [];
}

export default async function ReportPage(props) {
    const params = await props.params;
    const report = await getReport(params.id);

    if (!report) {
        notFound();
    }

    // Fetch all reports for peer comparison
    const allReports = await getReports();

    return (
        <div className="pb-20">
            <Link href="/" className="button mb-8">
                ← Back to Dashboard
            </Link>

            <ReportDetailClient report={report} allReports={allReports} />
        </div>
    );
}
