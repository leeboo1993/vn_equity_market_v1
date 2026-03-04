import { r2Client, R2_BUCKET } from '../../../lib/r2';
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        if (key) {
            const cmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
            const res = await r2Client.send(cmd);
            const body = await res.Body.transformToString();
            return new Response(body, { status: 200 });
        }
        return new Response("Missing key", { status: 400 });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
