import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const dataDir = '/Users/leeboo/Desktop/broker_data/others/github_automation_data/vnindex_github_action/data';
        const csvPath = path.join(dataDir, 'vnindex_forecast_vs_actual_6m.csv');
        
        // Dynamically find the latest model file
        const files = fs.readdirSync(dataDir)
            .filter(f => f.startsWith('vnindex_model_') && f.endsWith('.json'))
            .sort((a, b) => b.localeCompare(a));
            
        if (!fs.existsSync(csvPath) || files.length === 0) {
            return NextResponse.json({ error: 'Data files not found' }, { status: 404 });
        }
        
        const jsonPath = path.join(dataDir, files[0]);

        if (!fs.existsSync(csvPath) || !fs.existsSync(jsonPath)) {
            return NextResponse.json({ error: 'Data files not found' }, { status: 404 });
        }

        // 1. Parse CSV for prices
        const csvContent = fs.readFileSync(csvPath, 'utf8');
        const csvLines = csvContent.split('\n').filter(line => line.trim() !== '');
        const pricesMap = {};
        
        // Skip header
        for (let i = 1; i < csvLines.length; i++) {
            const parts = csvLines[i].split(',');
            if (parts.length >= 2) {
                pricesMap[parts[0]] = parseFloat(parts[1]);
            }
        }

        // 2. Parse JSON for regimes and features
        const jsonContent = fs.readFileSync(jsonPath, 'utf8');
        const jsonData = JSON.parse(jsonContent);
        
        const history = jsonData.map(entry => {
            const price = pricesMap[entry.date] || null;
            return {
                date: entry.date,
                price: price,
                regime: entry.market_regime?.regime || 'Neutral',
                confidence: entry.market_regime?.confidence || 0,
                features: entry.features ? Object.entries(entry.features)
                    .filter(([, val]) => val !== null && val !== undefined)
                    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                    .slice(0, 10)
                    .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {}) : null
            };
        }).filter(item => item.price !== null);

        return NextResponse.json({ history });
    } catch (error) {
        console.error('Error fetching model regime history:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
