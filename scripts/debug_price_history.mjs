import { getPriceHistoryMap } from '../lib/priceHistory.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkPriceHistory() {
    console.log('Fetching price history map...');
    const map = await getPriceHistoryMap();
    console.log(`Map size: ${map.size}`);

    const tickers = Array.from(map.keys()).slice(0, 5);
    for (const ticker of tickers) {
        const history = map.get(ticker);
        console.log(`\nTicker: ${ticker}`);
        console.log(`History length: ${history.length}`);
        if (history.length > 0) {
            console.log('First entry:', JSON.stringify(history[0]));
            console.log('Last entry:', JSON.stringify(history[history.length - 1]));
        }
    }
}

checkPriceHistory().catch(console.error);
