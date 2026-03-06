import { NextResponse } from 'next/server';
import { r2Client, R2_BUCKET } from '@/lib/r2';
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const ticker = searchParams.get('ticker')?.toUpperCase();

        if (!ticker) {
            return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
        }

        // List files for this ticker under vnd_data/financials/
        const prefix = `vnd_data/financials/${ticker}_financials_`;
        const listCmd = new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix });
        const listResult = await r2Client.send(listCmd);
        const files = (listResult.Contents || []).filter(f => f.Key.endsWith('.json'));

        if (!files.length) {
            return NextResponse.json({ error: 'No financial data found for ' + ticker }, { status: 404 });
        }

        // Sort by LastModified descending, take the latest file
        files.sort((a, b) => new Date(b.LastModified) - new Date(a.LastModified));
        const latestKey = files[0].Key;

        const getCmd = new GetObjectCommand({ Bucket: R2_BUCKET, Key: latestKey });
        const res = await r2Client.send(getCmd);
        const raw = await res.Body.transformToString();
        const data = JSON.parse(raw);

        // data.reports is array of { reportType, fiscalDate, data: [{itemCode, itemName, itemNameEn, value}] }
        // Separate into IS, BS, CF by itemCode range (VNDirect model codes):
        //   IS (Income Statement): modelType 2,90,102,412
        //   BS (Balance Sheet):    modelType 1,89,101,411
        //   CF (Cash Flow):        modelType 3,91,103,413
        // We don't have the modelType in the stored data, so we'll return all and let the client split.

        // Build structured response: { periods, annual: {...}, quarterly: {...} }
        // Each period key -> { IS: [{code, name, value}], BS: [...], CF: [...] }

        const annual = {};
        const quarterly = {};

        for (const report of data.reports) {
            const dt = new Date(report.fiscalDate);
            const year = dt.getFullYear();
            const month = dt.getMonth() + 1;

            let label;
            if (report.reportType === 'ANNUAL') {
                label = `FY${year}`;
            } else {
                const q = month <= 3 ? 1 : month <= 6 ? 2 : month <= 9 ? 3 : 4;
                label = `Q${q}/${year}`;
            }

            const target = report.reportType === 'ANNUAL' ? annual : quarterly;
            if (!target[label]) target[label] = [];

            for (const item of report.data) {
                target[label].push({
                    code: item.itemCode,
                    name: item.itemName || item.itemNameEn || `Item ${item.itemCode}`,
                    nameEn: item.itemNameEn || '',
                    value: item.value,
                    stmtType: item.stmtType,
                    displayOrder: item.displayOrder
                });
            }
        }

        return NextResponse.json({
            ticker,
            lastUpdated: data.last_updated,
            annual,
            quarterly
        });

    } catch (error) {
        console.error('Financials API error:', error);
        if (error.name === 'NoSuchKey') {
            return NextResponse.json({ error: 'Financial data not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to fetch financials' }, { status: 500 });
    }
}
