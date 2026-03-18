import { r2Client, R2_BUCKET } from '../../../lib/r2';
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import fs from 'fs';
import path from 'path';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date'); // Format: YYYY-MM-DD

    try {
        // 1. Fetch available dates from R2
        const listCommand = new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            Prefix: 'vnindex_model_data/',
        });
        const listResponse = await r2Client.send(listCommand);
        const availableDates = (listResponse.Contents || [])
            .map(c => {
                const match = c.Key.match(/vnindex_model_(\d{6})\.json/);
                if (match) {
                    const d = match[1];
                    return `20${d.substring(0, 2)}-${d.substring(2, 4)}-${d.substring(4, 6)}`;
                }
                return null;
            })
            .filter(Boolean)
            .sort((a, b) => b.localeCompare(a)); // Newest first

        let text = "";
        let isHistorical = false;
        let jsonDataEntry = null;

        if (dateParam) {
            const parts = dateParam.split('-');
            if (parts.length === 3) {
                const yymmdd = parts[0].substring(2) + parts[1] + parts[2];
                const key = `vnindex_model_data/vnindex_model_${yymmdd}.json`;

                try {
                    const getCommand = new GetObjectCommand({
                        Bucket: R2_BUCKET,
                        Key: key,
                    });
                    const getResponse = await r2Client.send(getCommand);
                    const jsonContent = await getResponse.Body.transformToString();

                    // Sanitize JSON
                    const sanitized = jsonContent.replace(/:\s*NaN/g, ': null');
                    const jsonData = JSON.parse(sanitized);

                    jsonDataEntry = Array.isArray(jsonData)
                        ? (jsonData.find(e => e.date === dateParam) || jsonData[0])
                        : jsonData;

                    text = jsonDataEntry.report_text || "";
                    isHistorical = true;
                } catch (e) {
                    console.warn(`Historical report not found for ${dateParam}`);
                }
            }
        }

        if (!text) {
            const command = new GetObjectCommand({
                Bucket: R2_BUCKET,
                Key: "cafef_data/website/latest_report.txt",
            });
            const response = await r2Client.send(command);
            text = await response.Body.transformToString();

            // Try to find the matching JSON for this latest report to get features
            const latestDate = availableDates[0]; // e.g. "2026-02-06"
            if (latestDate) {
                const parts = latestDate.split('-');
                const yymmdd = parts[0].substring(2) + parts[1] + parts[2];
                const key = `vnindex_model_data/vnindex_model_${yymmdd}.json`;
                try {
                    const getCommand = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
                    const getResp = await r2Client.send(getCommand);
                    const jsonContent = await getResp.Body.transformToString();
                    const sanitized = jsonContent.replace(/:\s*NaN/g, ': null');
                    const jsonData = JSON.parse(sanitized);
                    jsonDataEntry = Array.isArray(jsonData)
                        ? (jsonData.find(e => e.date === latestDate) || jsonData[0])
                        : jsonData;
                } catch (e) {
                    console.warn("Could not load supplementary JSON for live view");
                }
            }
        }

        // Load recommendation history for performance tracking
        let recHistory = {};
        try {
            const historyPath = '/Users/leeboo/Desktop/broker_data/others/github_automation_data/vnindex_github_action/data/recommendation_history.json';
            if (fs.existsSync(historyPath)) {
                recHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            }
        } catch (e) {
            console.error("Error loading recommendation history:", e);
        }

        // ----------------------------------------------------
        // Parsing Logic
        // ----------------------------------------------------

        // Meta / Summary
        const dateMatch = text.match(/VN-INDEX DAILY INSIGHT \| (.+)/);
        const marketViewMatch = text.match(/Market View:\s+(.+)/);
        const marketRegimeMatch = text.match(/Market Regime:\s+(.+)\s+\(Confidence:\s+(.+)\)/);
        const targetMatch = text.match(/Target for VN-Index on (.+):\s+([\d,.]+)\s+\((.+)\)/);
        const forecastConvictionMatch = text.match(/Forecast Conviction:\s+(?:.*?)\s+\(Conf:\s*(.+)\)/);

        // The Story
        const retailNNMatch = text.match(/- Deep Learning View \(Retail NN\):\s+Are\s+(.+)\s+\(((?:-|\+)?[\d.]+%)\)/);
        const whalesMatch = text.match(/- Whales \(Smart Money\):\s+Are\s+(.+)\s+\(((?:-|\+)?[\d.]+%)\)/);
        const crowdMatch = text.match(/- The Crowd \(Retail\):\s+Are\s+(.+)\s+\(((?:-|\+)?[\d.]+%)\)/);

        // Broker View
        const brokerSentimentMatch = text.match(/Sentiment:\s+(.+)\s+\(Pos:\s+(.+)%\s+\|\s+Neu:\s+(.+)%\s+\|\s+Neg:\s+(.+)%\)/);

        // Horizons
        const horizons = [];
        const horizonSectionRegex = /KEY TARGETS[\s\S]*?-----------------------------------------------------------------------------------------------[\s\S]*?-----------------------------------------------------------------------------------------------([\s\S]*?)-----------------------------------------------------------------------------------------------/m;
        const horizonSectionMatch = text.match(horizonSectionRegex);
        if (horizonSectionMatch) {
            const hLines = horizonSectionMatch[1].trim().split('\n');
            for (const line of hLines) {
                const parts = line.split('|').map(p => p.trim());
                if (parts.length >= 5) {
                    horizons.push({
                        term: parts[0],
                        forecast: parts[1],
                        action_magnitude: parts[2],
                        bucket: parts[3],
                        trend: parts[4]
                    });
                }
            }
        }

        // Action Plan
        const actionPlanMatches = text.matchAll(/(\d+\.)\s+(.*?):\s+(.*?)\s+\(Target:\s+(.+?)\)(?:\s+\((.*?)\))?/g);
        const actionPlan = [];
        for (const match of actionPlanMatches) {
            actionPlan.push({
                type: match[2].trim(),
                action: match[3].trim(),
                target: match[4].trim(),
                note: match[5] ? match[5].trim() : ""
            });
        }

        // Historical Calls Table
        const historicalCalls = [];
        const historyTableRegex = /Date\s+\|\s+Forecast \(T\+1\)\s+\|\s+Broker View\s+\|\s+Actual Ret\(T\+1\)\s+\|\s+Decision\s+\|\s+Logic\s+\|\s+Dec\. Acc\s+\|\s+Dir\. Acc\s+\|\s+Brok Acc\s+\|\s+Mod\. Acc\.\s+\|\s+Model Bucket\s+\|\s+Actual Bucket[\s\S]*?-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------([\s\S]*?)-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------/m;
        const historyMatch = text.match(historyTableRegex);

        if (historyMatch) {
            const lines = historyMatch[1].trim().split('\n');
            let currentRow = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('|')) {
                    const parts = line.split('|').map(p => p.trim());
                    if (parts[0].match(/^\d{2}\/\d{2}\/\d{4}$/) && parts.length >= 12) {
                        currentRow = {
                            date: parts[0],
                            forecast: parts[1],
                            brokerView: parts[2],
                            actualRet: parts[3],
                            decision: parts[4],
                            logic: parts[5],
                            decAcc: parts[6],
                            dirAcc: parts[7],
                            brokAcc: parts[8],
                            modAcc: parts[9],
                            modelBucket: parts[10],
                            actualBucket: parts[11]
                        };
                        historicalCalls.push(currentRow);
                    } else if (currentRow && parts.length === 2 && !parts[0].match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                        currentRow.modelBucket += ` ${parts[0]}`;
                        currentRow.actualBucket += ` ${parts[1]}`;
                    }
                }
            }
        }

        // Performance Metrics
        const perfMetrics = {};
        const perfRegex = /([A-Za-z\s]+(?:\([\w\s+±]+\))?)\s*:\s*([\d.]+%)/g;
        let m;
        const perfSection = historyMatch ? text.substring(text.indexOf(historyMatch[0]) + historyMatch[0].length) : "";
        while ((m = perfRegex.exec(perfSection)) !== null) {
            perfMetrics[m[1].trim()] = m[2];
        }

        // Stocks (Sectioned and Performance Aware)
        const processStocks = (stocksArray, type) => {
            return stocksArray.map(s => {
                const ticker = s.ticker;
                const hist = recHistory[ticker];
                let perfSinceCall = "0.00%";
                let callDate = "N/A";

                if (hist && hist.price) {
                    const currentPrice = s.price || 0;
                    if (currentPrice > 0) {
                        const diff = ((currentPrice - hist.price) / hist.price) * 100;
                        perfSinceCall = (diff >= 0 ? '+' : '') + diff.toFixed(2) + '%';
                    }
                    callDate = hist.date;
                }

                return {
                    ...s,
                    recommendation: type === 'exit' ? 'SELL' : (s.forecast_return > 0.05 ? 'BUY' : (s.forecast_return < 0 ? 'SELL' : 'NEUTRAL')),
                    perfSinceCall,
                    callDate,
                    returnPct: (s.forecast_return * 100).toFixed(2) + '%',
                    flags: s.risk_flags || 'N/A',
                    logic: s.logic || 'N/A'
                };
            });
        };

        let topPicks = [];
        let exitWarnings = [];

        if (jsonDataEntry && jsonDataEntry.all_stocks) {
            // Use historical JSON stocks if available
            topPicks = processStocks(jsonDataEntry.all_stocks.filter(s => s.is_top_pick), 'top');
            exitWarnings = processStocks(jsonDataEntry.all_stocks.filter(s => !s.is_top_pick && (s.risk_flags?.includes('Net Selling') || s.forecast_return < 0)), 'exit');
        } else {
            // Fallback to text parsing
            const parseStockTable = (tablePattern, type) => {
                if (!tablePattern) return [];
                const arr = [];
                const rowRegex = /([A-Z0-9]+)\s+\|\s+((?:-|\+)?[0-9.]+%)\s+\|\s+([0-9.]+)\s+\|\s+(.+?)\s+\|\s+(.+)/g;
                let rm;
                while ((rm = rowRegex.exec(tablePattern)) !== null) {
                    const ticker = rm[1].trim();
                    const returnVal = parseFloat(rm[2].replace('%', ''));

                    const hist = recHistory[ticker];
                    let perfSinceCall = "0.00%";
                    let callDate = "N/A";
                    if (hist) {
                        callDate = hist.date;
                        // For text parsing we don't have current price, but we assume it's roughly current
                    }

                    arr.push({
                        ticker,
                        returnPct: rm[2].trim(),
                        whale: parseFloat(rm[3].trim()),
                        flags: rm[4].trim(),
                        logic: rm[5].trim(),
                        recommendation: type === 'exit' ? 'SELL' : (returnVal > 5 ? 'BUY' : (returnVal < 0 ? 'SELL' : 'NEUTRAL')),
                        perfSinceCall,
                        callDate
                    });
                }
                return arr;
            };

            if (text.includes('TOP PICKS')) {
                const topPicksSection = text.substring(text.indexOf('TOP PICKS'), text.indexOf('EXIT WARNINGS'));
                topPicks = parseStockTable(topPicksSection, 'top');
            }
            if (text.includes('EXIT WARNINGS')) {
                const exitWarningsSection = text.substring(text.indexOf('EXIT WARNINGS'), text.indexOf('APPENDIX'));
                exitWarnings = parseStockTable(exitWarningsSection, 'exit');
            }
        }

        const data = {
            meta: {
                date: dateMatch ? dateMatch[1].trim() : "Unknown",
                view: marketViewMatch ? marketViewMatch[1].trim() : "Unknown",
                regime: marketRegimeMatch ? marketRegimeMatch[1].trim() : "Unknown",
                regimeConfidence: marketRegimeMatch ? marketRegimeMatch[2].trim() : "Unknown",
                targetDate: targetMatch ? targetMatch[1].trim() : "Unknown",
                targetValue: targetMatch ? targetMatch[2].trim() : "Unknown",
                targetReturn: targetMatch ? targetMatch[3].trim() : "Unknown",
                forecastConfidence: forecastConvictionMatch ? forecastConvictionMatch[1] : null,
                isHistorical
            },
            story: {
                retail_nn: retailNNMatch ? { action: retailNNMatch[1].trim(), metric: retailNNMatch[2].trim() } : null,
                whales: whalesMatch ? { action: whalesMatch[1].trim(), metric: whalesMatch[2].trim() } : null,
                crowd: crowdMatch ? { action: crowdMatch[1].trim(), metric: crowdMatch[2].trim() } : null
            },
            broker: {
                sentiment: brokerSentimentMatch ? brokerSentimentMatch[1].trim() : null,
                pos: brokerSentimentMatch ? parseFloat(brokerSentimentMatch[2]) : 0,
                neu: brokerSentimentMatch ? parseFloat(brokerSentimentMatch[3]) : 0,
                neg: brokerSentimentMatch ? parseFloat(brokerSentimentMatch[4]) : 0,
            },
            horizons: horizons,
            actionPlan: actionPlan,
            historicalCalls: historicalCalls,
            performanceMetrics: perfMetrics,
            topPicks: topPicks,
            exitWarnings: exitWarnings,
            availableDates,
            features: jsonDataEntry?.features || null,
            evaluation: jsonDataEntry?.previous_day_evaluation || null
        };

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=30, stale-while-revalidate=60'
            },
        });

    } catch (error) {
        console.error("Error fetching or parsing model report:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch model report data." }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}
