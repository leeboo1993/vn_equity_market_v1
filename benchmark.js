
import { getFullRawReports, enrichReportsBatch, getReportsMetadata, getThinReports } from './lib/data.js';
import { getStockInfoMap } from './lib/stockInfo.js';
import { getPriceHistoryMap } from './lib/priceHistory.js';

async function benchmark() {
    console.time('getStockInfoMap');
    await getStockInfoMap();
    console.timeEnd('getStockInfoMap');

    console.time('getPriceHistoryMap');
    await getPriceHistoryMap();
    console.timeEnd('getPriceHistoryMap');

    console.time('getFullRawReports - First Load');
    const reports = await getFullRawReports();
    console.timeEnd('getFullRawReports - First Load');
    console.log('Total Reports:', reports.length);

    console.time('getReportsMetadata');
    await getReportsMetadata();
    console.timeEnd('getReportsMetadata');

    console.time('getThinReports');
    const thin = await getThinReports();
    console.timeEnd('getThinReports');
    console.log('Total Thin Reports:', thin.length);

    console.time('enrichReportsBatch - Page (400)');
    await enrichReportsBatch(thin.slice(0, 400));
    console.timeEnd('enrichReportsBatch - Page (400)');
}

benchmark().catch(console.error);
