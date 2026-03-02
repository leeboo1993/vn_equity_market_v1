import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import PriceBoard from '../components/daily-tracking/PriceBoard';

export const metadata = {
    title: 'Live Price Board | Investment Tracker',
    description: 'Real-time stock price board for the Vietnamese market.',
};

export default function PriceBoardPage() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#0a0a0a' }}>
            <Header title="Price Board" />
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <Sidebar />
                <main style={{ flex: 1, overflowY: 'auto' }}>
                    <PriceBoard />
                </main>
            </div>
        </div>
    );
}
