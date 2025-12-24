import Dashboard from '../components/Dashboard';

// Cache page for 3 hours (10800 seconds) - Check for updates periodically
export const revalidate = 10800;
export const dynamic = 'force-static';

export const metadata = {
    title: 'Company Research | Investment Tracker',
    description: 'Track broker recommendations and company reports',
};

export default function CompanyResearchPage() {
    // Client-side fetching strategy to avoid 60MB payload limit on Vercel Functions
    // Data is pre-built into public/reports.json
    return <Dashboard initialReports={[]} shouldFetchData={true} />;
}
