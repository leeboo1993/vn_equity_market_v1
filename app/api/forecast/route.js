import { r2Client, R2_BUCKET } from '../../../lib/r2';
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');

        // If a date is provided, fetch the per-day file; otherwise fetch latest
        const key = date
            ? `forecasts/forecast_${date}.json`
            : 'forecast_latest.json';

        const command = new GetObjectCommand({
            Bucket: R2_BUCKET,
            Key: key,
        });

        const response = await r2Client.send(command);
        const str = await response.Body.transformToString();
        const data = JSON.parse(str);

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': date
                    ? 'public, max-age=86400' // Historical data is immutable, cache for 1 day
                    : 'public, max-age=300, stale-while-revalidate=600'
            },
        });

    } catch (error) {
        console.error("Error fetching forecast from R2:", error);

        if (error.name === 'NoSuchKey') {
            return new Response(JSON.stringify({ error: "Forecast not available for this date." }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ error: "Failed to fetch forecast data." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
