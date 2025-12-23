import { getReports } from '@/lib/data';
import Dashboard from './components/Dashboard';

// Cache page for 3 hours (10800 seconds) - Check for updates periodically
export const revalidate = 10800;
export const dynamic = 'force-static'; // Optional: force static generation if possible

export default async function Home() {
    const reports = await getReports();
    // Ensure reports is an array before reversing
    const recentReports = Array.isArray(reports) ? [...reports].reverse() : [];

    return <Dashboard initialReports={recentReports} />;
}
