import { r2Client, R2_BUCKET } from '@/lib/r2';
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await auth();
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // List files in the vnd_data/market_valuation/ prefix
        const listCommand = new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            Prefix: 'vnd_data/market_valuation/'
        });

        const listResponse = await r2Client.send(listCommand);

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            return NextResponse.json({ error: 'No data found' }, { status: 404 });
        }

        // The files are typically named something like vnd_market_valuation_YYMMDD.json
        // Let's sort them alphabetically descending to get the latest one
        const sortedFiles = listResponse.Contents.sort((a, b) => b.Key.localeCompare(a.Key));
        const latestKey = sortedFiles[0].Key;

        // Fetch the latest file
        const getCommand = new GetObjectCommand({
            Bucket: R2_BUCKET,
            Key: latestKey,
        });

        const fileContent = await getResponse.Body.transformToString();
        const rawData = JSON.parse(fileContent);

        // Process data for frontend
        const { ratios, prices, scraped_at } = rawData;

        // Map ratios by date for quick lookup
        const peRatios = new Map();
        const pbRatios = new Map();

        if (Array.isArray(ratios)) {
            ratios.forEach(r => {
                if (r.ratioCode === 'PRICE_TO_EARNINGS' && r.value != null) {
                    peRatios.set(r.reportDate, r.value);
                } else if (r.ratioCode === 'PRICE_TO_BOOK' && r.value != null) {
                    pbRatios.set(r.reportDate, r.value);
                }
            });
        }

        // Join prices and ratios. Filter out dates without price.
        let chartData = [];
        if (Array.isArray(prices)) {
            // Sorting prices chronologically for the chart
            prices.sort((a, b) => a.date.localeCompare(b.date)).forEach(p => {
                const pe = peRatios.get(p.date) || null;
                const pb = pbRatios.get(p.date) || null;
                chartData.push({
                    date: p.date,
                    close: p.close,
                    pe: pe,
                    pb: pb
                });
            });
        }

        // Calculate current and 5Y averages
        const latest = chartData.length > 0 ? chartData[chartData.length - 1] : null;
        let currentPe = latest?.pe || null;
        let currentPb = latest?.pb || null;

        let avg5yPe = null;
        let avg5yPb = null;

        if (chartData.length > 0) {
            // Get last 5 years data roughly (5 * 252 trading days)
            const last5Years = chartData.slice(-1260);
            const validPe = last5Years.filter(d => d.pe != null).map(d => d.pe);
            const validPb = last5Years.filter(d => d.pb != null).map(d => d.pb);

            if (validPe.length > 0) avg5yPe = validPe.reduce((a, b) => a + b, 0) / validPe.length;
            if (validPb.length > 0) avg5yPb = validPb.reduce((a, b) => a + b, 0) / validPb.length;

            // if latest doesn't have PE/PB, find the most recent valid one
            if (currentPe === null && validPe.length > 0) currentPe = validPe[validPe.length - 1];
            if (currentPb === null && validPb.length > 0) currentPb = validPb[validPb.length - 1];
        }

        return NextResponse.json({
            data: {
                chartData,
                currentPe,
                currentPb,
                avg5yPe,
                avg5yPb,
                scraped_at
            },
            sourceKey: latestKey
        });

    } catch (error) {
        console.error('Error fetching market valuation:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
