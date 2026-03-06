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
        const listCommand = new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            Prefix: 'vnd_data/industry_analysis/'
        });

        const listResponse = await r2Client.send(listCommand);

        if (!listResponse.Contents || listResponse.Contents.length === 0) {
            return NextResponse.json({ error: 'No data found' }, { status: 404 });
        }

        const sortedFiles = listResponse.Contents.sort((a, b) => b.Key.localeCompare(a.Key));
        const latestKey = sortedFiles[0].Key;

        const getCommand = new GetObjectCommand({
            Bucket: R2_BUCKET,
            Key: latestKey,
        });

        const getResponse = await r2Client.send(getCommand);
        const fileContent = await getResponse.Body.transformToString();
        const rawData = JSON.parse(fileContent);

        // Process data for frontend
        const { classification, ratios, scraped_at } = rawData;

        // Build a lookup map for modern Level 2 industries
        const industryMap = new Map();
        if (Array.isArray(classification)) {
            classification.forEach(c => {
                if (c.industryLevel === '2') {
                    industryMap.set(c.industryCode, c);
                }
            });
        }

        // We want the LATEST available data for the Heatmap. 
        // We also want historical series for Trendlines.

        // 1. Heatmap Data (e.g. 1-Month Price Change & P/E)
        // Groups ratio by code then by date. Let's find the latest valid date for each industry.
        const latestRatiosByIndustry = {};

        // We will track history for Sector Rotation (RS Momentum)
        const historyData = {};

        const TARGET_RATIOS = [
            'PRICE_CHG_PCT_CR_1M',
            'PRICE_CHG_PCT_CR_1Y',
            'PRICE_TO_EARNINGS',
            'WEEKLY_JDK_RS_MOMENTUM_CR',
            'WEEKLY_JDK_RS_CR'
        ];

        if (Array.isArray(ratios)) {
            // Sort by reportDate DESC so we encounter newest first
            ratios.sort((a, b) => b.reportDate.localeCompare(a.reportDate));

            ratios.forEach(r => {
                if (!industryMap.has(r.code)) return; // Only track Level 2 industries we cared about
                if (!TARGET_RATIOS.includes(r.ratioCode)) return;

                // Init industry objects
                if (!latestRatiosByIndustry[r.code]) {
                    const ind = industryMap.get(r.code);
                    latestRatiosByIndustry[r.code] = {
                        code: r.code,
                        nameEn: ind.englishName,
                        nameVn: ind.vietnameseName,
                        stocksCount: ind.totalCount,
                        metrics: {}
                    };
                }

                if (!historyData[r.code]) {
                    const ind = industryMap.get(r.code);
                    historyData[r.code] = {
                        code: r.code,
                        nameEn: ind.englishName,
                        nameVn: ind.vietnameseName,
                        series: []
                    };
                }

                // Heatmap logic: just keep the very first (latest) value we see for a target ratio
                if (latestRatiosByIndustry[r.code].metrics[r.ratioCode] === undefined) {
                    latestRatiosByIndustry[r.code].metrics[r.ratioCode] = r.value;
                }

                // History logic: build timeseries for RS and PE
                // We'll group by reportDate inside series
                let dateEntry = historyData[r.code].series.find(d => d.date === r.reportDate);
                if (!dateEntry) {
                    dateEntry = { date: r.reportDate };
                    historyData[r.code].series.push(dateEntry);
                }
                dateEntry[r.ratioCode] = r.value;
            });
        }

        const heatmapData = Object.values(latestRatiosByIndustry).sort((a, b) => {
            const valA = a.metrics['PRICE_CHG_PCT_CR_1M'] || 0;
            const valB = b.metrics['PRICE_CHG_PCT_CR_1M'] || 0;
            return valB - valA; // Descending
        });

        // Clean up history series (sort them ASC for charts)
        const trendlineData = Object.values(historyData).map(h => {
            h.series.sort((a, b) => a.date.localeCompare(b.date));
            return h;
        });

        return NextResponse.json({
            data: {
                heatmapData,
                trendlineData,
                scraped_at
            },
            sourceKey: latestKey
        });

    } catch (error) {
        console.error('Error fetching industry analysis:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
