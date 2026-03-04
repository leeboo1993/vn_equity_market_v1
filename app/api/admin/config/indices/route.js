import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const r2Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

export const dynamic = 'force-dynamic';

export async function GET() {
    const session = await auth();
    if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const command = new GetObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: "config/indices.json",
        });
        const response = await r2Client.send(command);
        const str = await response.Body.transformToString();
        return NextResponse.json(JSON.parse(str));
    } catch (error) {
        console.error('Error fetching indices config:', error);
        return NextResponse.json({ error: 'Failed to fetch configuration' }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await auth();
    if (!session || session.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        if (!Array.isArray(body)) {
            return NextResponse.json({ error: 'Invalid configuration format' }, { status: 400 });
        }

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET,
            Key: "config/indices.json",
            Body: JSON.stringify(body, null, 2),
            ContentType: 'application/json'
        });
        await r2Client.send(command);

        return NextResponse.json({ message: 'Configuration saved successfully' });
    } catch (error) {
        console.error('Error saving indices config:', error);
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
    }
}
