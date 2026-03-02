import { NextResponse } from 'next/server';
export const dynamic = "force-dynamic";
import { r2Client, R2_BUCKET } from '@/lib/r2';
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";

const BUCKET_NAME = R2_BUCKET;

export async function GET(request) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const userId = session.user.email; // Use email as unique identifier for watchlists

        try {
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: `watchlists/${userId}.json`,
            });

            const response = await r2Client.send(command);
            const str = await response.Body.transformToString();
            const data = JSON.parse(str);

            return NextResponse.json(data);
        } catch (s3Error) {
            // If file not found, return empty default structure
            if (s3Error.name === 'NoSuchKey') {
                return NextResponse.json({ watchlist: [], weights: {} });
            }
            throw s3Error;
        }

    } catch (error) {
        console.error('Error fetching watchlist:', error);
        return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await auth();
        if (!session || !session.user || !session.user.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.email;
        const body = await request.json();

        // Expecting body: { watchlist: ['AAPL', 'MSFT'], weights: { 'AAPL': 50, 'MSFT': 50 } }

        if (!body.watchlist || !Array.isArray(body.watchlist)) {
            return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 });
        }

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `watchlists/${userId}.json`,
            Body: JSON.stringify(body),
            ContentType: "application/json",
        });

        await r2Client.send(command);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving watchlist:', error);
        return NextResponse.json({ error: 'Failed to save watchlist' }, { status: 500 });
    }
}
