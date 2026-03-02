import { NextResponse } from 'next/server';
export const dynamic = "force-dynamic";
import { r2Client, R2_BUCKET } from '@/lib/r2';
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";

const BUCKET_NAME = R2_BUCKET;

export async function GET(request) {
    try {
        try {
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: `config/custom_sectors.json`,
            });

            const response = await r2Client.send(command);
            const str = await response.Body.transformToString();
            const data = JSON.parse(str);

            return NextResponse.json(data);
        } catch (s3Error) {
            if (s3Error.name === 'NoSuchKey') {
                return NextResponse.json({}); // Default empty sectors
            }
            throw s3Error;
        }
    } catch (error) {
        console.error('Error fetching custom sectors:', error);
        return NextResponse.json({ error: 'Failed to fetch sectors' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const session = await auth();
        // Only allow admins to update the global custom sectors
        if (!session || !session.user || session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized. Admins only.' }, { status: 401 });
        }

        const body = await request.json();
        // Body should be an object mapping sector names to arrays of ticker strings

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: `config/custom_sectors.json`,
            Body: JSON.stringify(body),
            ContentType: "application/json",
        });

        await r2Client.send(command);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving custom sectors:', error);
        return NextResponse.json({ error: 'Failed to save sectors' }, { status: 500 });
    }
}
