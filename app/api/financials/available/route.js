import { NextResponse } from 'next/server';
import { r2Client, R2_BUCKET } from '@/lib/r2';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
    try {
        const tickers = new Set();
        let isTruncated = true;
        let continuationToken = undefined;

        while (isTruncated) {
            const listCmd = new ListObjectsV2Command({
                Bucket: R2_BUCKET,
                Prefix: 'vnd_data/financials/',
                ContinuationToken: continuationToken
            });

            const response = await r2Client.send(listCmd);
            const contents = response.Contents || [];

            for (const obj of contents) {
                // Filename pattern: vnd_data/financials/TICKER_financials_Q...json
                const match = obj.Key.match(/vnd_data\/financials\/([A-Z0-9]+)_financials_/);
                if (match) {
                    tickers.add(match[1]);
                }
            }

            isTruncated = response.IsTruncated;
            continuationToken = response.NextContinuationToken;
        }

        return NextResponse.json(Array.from(tickers).sort());
    } catch (error) {
        console.error('Available Financials API error:', error);
        return NextResponse.json({ error: 'Failed to fetch available tickers' }, { status: 500 });
    }
}
