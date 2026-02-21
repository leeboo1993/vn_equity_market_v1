import { NextResponse } from 'next/server';
import { r2Client, R2_BUCKET } from '@/lib/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const ticker = searchParams.get('ticker');

        if (!ticker) {
            return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
        }

        const command = new GetObjectCommand({
            Bucket: R2_BUCKET,
            Key: `financials/${ticker.toUpperCase()}_quarterly.json`,
        });

        const response = await r2Client.send(command);
        const str = await response.Body.transformToString();
        const data = JSON.parse(str);

        return NextResponse.json(data);
    } catch (error) {
        console.error("Error fetching financials from R2:", error);

        // Return 404 cleanly if the file doesn't exist yet
        if (error.name === 'NoSuchKey') {
            return NextResponse.json({ error: 'Financial data not found for ticker' }, { status: 404 });
        }

        return NextResponse.json({ error: 'Failed to fetch financials' }, { status: 500 });
    }
}
