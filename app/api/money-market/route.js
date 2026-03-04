import { r2Client, R2_BUCKET } from '../../../lib/r2';
import { GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

export const dynamic = 'force-dynamic';

const VALID_BANKS = {
    'VIETCOMBANK': 'VCB', 'VCB': 'VCB',
    'TECHCOMBANK': 'TCB', 'TCB': 'TCB',
    'MB': 'MBB', 'MBBANK': 'MBB', 'MBB': 'MBB',
    'BIDV': 'BID', 'BID': 'BID',
    'VIETINBANK': 'CTG', 'CTG': 'CTG',
    'ACB': 'ACB',
    'HDBANK': 'HDB', 'HDB': 'HDB',
    'VIB': 'VIB',
    'MSB': 'MSB',
    'SACOMBANK': 'STB', 'STB': 'STB',
    'LPBANK': 'LPB', 'LIENVIETPOSTBANK': 'LPB', 'LPB': 'LPB',
    'TPBANK': 'TPB', 'TPB': 'TPB',
    'SHB': 'SHB',
    'EXIMBANK': 'EIB', 'EXIMBANK (CUỐI TUẦN)': 'EIB', 'EIB': 'EIB',
    'OCB': 'OCB',
    'SEABANK': 'SSB', 'SSB': 'SSB',
    'ABBANK': 'ABB', 'ABB': 'ABB',
    'BACA': 'BAB', 'BAC A BANK': 'BAB', 'BACA BANK': 'BAB', 'BAB': 'BAB',
    'NAMABANK': 'NAB', 'NAM A BANK': 'NAB', 'NAM Á BANK': 'NAB', 'NAB': 'NAB',
    'KIENLONGBANK': 'KLB', 'KIENLONG BANK': 'KLB', 'KLB': 'KLB',
    'VIETBANK': 'VBB', 'VBB': 'VBB',
    'BAOVIETBANK': 'BVB', 'BVBANK': 'BVB', 'BVB': 'BVB',
    'NCB': 'NVB', 'NATIONAL CITIZEN BANK': 'NVB', 'NVB': 'NVB',
    'PGBANK': 'PGB', 'PGB': 'PGB',
    'VIETABANK': 'VAB', 'VIETA BANK': 'VAB', 'VAB': 'VAB',
    'SAIGONBANK': 'SGB', 'SGB': 'SGB'
};

export async function GET(request) {
    try {
        const fetchFiles = async (prefix, count = 5) => {
            const listCommand = new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix });
            const listResponse = await r2Client.send(listCommand);
            return (listResponse.Contents || [])
                .filter(c => !c.Key.includes('_backup/'))
                .sort((a, b) => b.LastModified - a.LastModified)
                .slice(0, count);
        };

        const fetchBody = async (key) => {
            const response = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
            return await response.Body.transformToString();
        };

        const [goldFs, vcbFs, blackFs, depositF, economicsBody] = await Promise.all([
            fetchFiles('cafef_data/gold_price/', 5),
            fetchFiles('cafef_data/vcb_fx_data/', 1),
            fetchFiles('cafef_data/usd_black_market/', 1),
            new Promise(async (resolve) => {
                const listCommand = new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: 'cafef_data/deposit_rate/deposit_rate_backup/' });
                const res = await r2Client.send(listCommand);
                resolve((res.Contents || []).filter(c => c.Key.endsWith('.json')).sort((a, b) => b.LastModified - a.LastModified).slice(0, 45));
            }),
            fetchBody('cafef_data/dl_equity/economics.json').catch(e => null)
        ]);

        const parseCsv = (csv) => {
            const lines = csv.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length === 0) return [];
            // Strip BOM if present
            const headerLine = lines[0].replace(/^\uFEFF/, '');
            const headers = headerLine.split(',').map(h => h.trim());
            return lines.slice(1).map(line => {
                const parts = line.split(',');
                const obj = {};
                headers.forEach((h, i) => obj[h] = parts[i]?.trim());
                return obj;
            });
        };

        const normDate = (d) => {
            if (!d) return d;
            if (d.match(/^\d{4}-\d{2}-\d{2}$/)) return d;
            const m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
            if (m) return `${m[3]}-${m[2]}-${m[1]}`;
            return d;
        };

        let goldData = [];
        // Try gold files one by one until success
        for (const f of goldFs) {
            try {
                const body = await fetchBody(f.Key);
                if (body.trim().startsWith('{')) {
                    const parsed = JSON.parse(body);
                    const dataObj = parsed.data || parsed.history || parsed;
                    Object.entries(dataObj).forEach(([date, vals]) => {
                        if (vals && typeof vals === 'object' && date.match(/^\d{4}|\d{2}-\d{2}-\d{2,4}$/)) {
                            goldData.push({ date: normDate(date), ...vals });
                        }
                    });
                    if (goldData.length > 0) break;
                } else {
                    goldData = parseCsv(body).map(d => ({ ...d, date: normDate(d.date) }));
                    if (goldData.length > 0) break;
                }
            } catch (e) { console.error(`Failed to parse gold file ${f.Key}:`, e); }
        }

        let vcbData = [];
        if (vcbFs.length > 0) {
            const body = await fetchBody(vcbFs[0].Key);
            vcbData = parseCsv(body).map(d => ({ ...d, date: normDate(d.date) }));
        }

        let blackMarketData = [];
        if (blackFs.length > 0) {
            const body = await fetchBody(blackFs[0].Key);
            blackMarketData = parseCsv(body).map(d => ({ ...d, date: normDate(d.date) }));
        }

        const fetchDepositDay = async (key) => {
            try {
                const body = await fetchBody(key);
                const parsed = JSON.parse(body.replace(/:\s*NaN/g, ': null'));
                const dateMatch = key.match(/deposit_rate_(\d{2})(\d{2})(\d{2})\.json/);
                let dateStr = parsed.last_updated?.split('T')[0];
                if (dateMatch) dateStr = `20${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
                const banks = {};
                (parsed.data || []).forEach(item => {
                    const rawBank = (item.bank || '').toUpperCase().trim();
                    const norm = VALID_BANKS[rawBank];
                    if (norm) {
                        banks[norm] = {
                            "1M": item['1m'],
                            "3M": item['3m'],
                            "6M": item['6m'],
                            "9M": item['9m'],
                            "12M": item['12m'],
                            "18M": item['18m'],
                            "24M": item['24m']
                        };
                    }
                });
                return { date: dateStr, banks };
            } catch (e) { return null; }
        };
        const depositResults = await Promise.all(depositF.map(f => fetchDepositDay(f.Key)));
        const depositTimeSeries = depositResults.filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));

        let treasury = [];
        let interbank = [];
        let dl_deposit = [];
        let eco_keys = [];
        if (economicsBody) {
            try {
                const eco = JSON.parse(economicsBody);
                eco_keys = Object.keys(eco);
                treasury = eco.treasury || [];
                interbank = eco.interbank || [];
                dl_deposit = eco.deposit || [];
            } catch (e) { console.error("Failed to parse economics.json", e); }
        }

        return new Response(JSON.stringify({
            gold: goldData.sort((a, b) => a.date.localeCompare(b.date)),
            vcb: vcbData,
            black_market: blackMarketData.sort((a, b) => a.date.localeCompare(b.date)),
            deposit_quote: depositTimeSeries,
            dl_deposit,
            treasury,
            interbank,
            eco_keys
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60, s-maxage=60'
            }
        });

    } catch (error) {
        console.error("Error in money-market API:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
