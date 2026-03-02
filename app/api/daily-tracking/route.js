import { r2Client, R2_BUCKET } from '../../../lib/r2';
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'market';

        if (type === 'deposit_quote') {
            const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
            const listCommand = new ListObjectsV2Command({
                Bucket: R2_BUCKET,
                Prefix: 'cafef_data/deposit_rate/deposit_rate_backup/',
            });
            const listResponse = await r2Client.send(listCommand);
            const contents = listResponse.Contents || [];

            // Fetch up to last 60 JSON files
            const jsonFiles = contents
                .filter(c => c.Key.endsWith('.json'))
                .sort((a, b) => b.LastModified - a.LastModified)
                .slice(0, 60);

            if (jsonFiles.length === 0) {
                return new Response(JSON.stringify({ error: "No deposit quote data found." }), { status: 404 });
            }

            const bankMap = {
                'VPBANK': 'VPB', 'TECHCOMBANK': 'TCB', 'MB': 'MBB', 'BIDV': 'BID',
                'VIETCOMBANK': 'VCB', 'VIETINBANK': 'CTG', 'ACB': 'ACB', 'HDBANK': 'HDB',
                'VIB': 'VIB', 'MSB': 'MSB', 'SACOMBANK': 'STB', 'LPBANK': 'LPB',
                'TPBANK': 'TPB', 'SHB': 'SHB', 'EXIMBANK': 'EIB', 'OCB': 'OCB',
                'SEABANK': 'SSB', 'ABBANK': 'ABB'
            };

            const fetchDay = async (key) => {
                try {
                    const response = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
                    let str = await response.Body.transformToString();
                    str = str.replace(/:\s*NaN/g, ': null');
                    const parsed = JSON.parse(str);

                    const dateMatch = key.match(/deposit_rate_(\d{2})(\d{2})(\d{2})\.json/);
                    let dateStr = parsed.last_updated;
                    if (dateMatch) {
                        dateStr = `20${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`; // '2026-02-27'
                    }

                    const banksData = {};
                    (parsed.data || []).forEach(item => {
                        const originalName = item.bank;
                        const normName = bankMap[originalName?.toUpperCase()] || originalName;
                        if (normName) {
                            banksData[normName] = {
                                "1M": item['1m'] ? parseFloat(item['1m']) : null,
                                "3M": item['3m'] ? parseFloat(item['3m']) : null,
                                "6M": item['6m'] ? parseFloat(item['6m']) : null,
                                "12M": item['12m'] ? parseFloat(item['12m']) : null
                            };
                        }
                    });
                    return { date: dateStr, banks: banksData };
                } catch (e) {
                    return null;
                }
            };

            const results = await Promise.all(jsonFiles.map(f => fetchDay(f.Key)));
            const timeSeries = results.filter(Boolean).sort((a, b) => new Date(a.date) - new Date(b.date));

            return new Response(JSON.stringify({ deposit_quote: timeSeries }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' },
            });
        }

        // Allowed types based on the crawler export
        if (!['market', 'economics', 'research', 'fundamentals'].includes(type)) {
            return new Response(JSON.stringify({ error: "Invalid data type requested." }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const key = `cafef_data/dl_equity/${type}.json`;

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
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
            },
        });

    } catch (error) {
        console.error("Error fetching DL equity data from R2:", error);

        if (error.name === 'NoSuchKey') {
            return new Response(JSON.stringify({ error: "Data not available." }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ error: "Failed to fetch DL equity data." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
