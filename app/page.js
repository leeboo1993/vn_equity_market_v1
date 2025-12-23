import { getReports } from '@/lib/data';
import Dashboard from './components/Dashboard';

// Cache page for 3 hours (10800 seconds) - Check for updates periodically
export const revalidate = 10800;
export const dynamic = 'force-static'; // Optional: force static generation if possible

export default function Home() {
    // Client-side fetching strategy to avoid 60MB payload limit on Vercel Functions
    // Data is pre-built into public/reports.json
    return <Dashboard initialReports={[]} shouldFetchData={true} />;
}
