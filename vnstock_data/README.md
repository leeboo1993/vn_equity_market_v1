# VNStock Financial Data Extractor (v2)

This tool automates the extraction of historical financial statements (Balance Sheet, Income Statement, Cash Flow, and Financial Ratios) for all ~1,700 tickers on the Vietnamese stock market using the `vnstock` library and Vietcap's data source.

## Features
- **TCP Keep-Alive**: Uses a persistent connection to prevent Web Application Firewall (WAF) IP bans.
- **Safe Pacing**: Enforces a strict 2.5s base delay between requests to stay under Vietcap's rate limits (HTTP 429 Too Many Requests).
- **Graceful Resuming**: Automatically saves progress to `data/checkpoint_v2.json`. You can stop and restart the script anytime; it will instantly skip tickers it has already downloaded.
- **Dynamic Chunking**: Saves data into `chunks/chunk_0000.parquet`, `chunk_0001.parquet`, etc., avoiding memory crashes and data loss.
- **Targeted Updates**: Ability to update only specific tickers or periods to save time.

---

## How to Run

### Option 1: Full Market Download (Overnight)
To download the entire market history (all 1,700+ stocks, both yearly and quarterly), you should run the script in the background. Since this will take a few hours, we use `nohup` (to keep it running if the terminal closes) and `caffeinate` (to stop your Mac from sleeping).

Open your terminal in the `vnstock_data` folder and run:
```bash
# 1. Start the script in the background
nohup python scripts/extract_full_market_v2.py > /dev/null 2>&1 &

# 2. Check the logs to make sure it started, and grab the Process ID (PID)
sleep 2 && ps aux | grep extract_full_market | grep -v grep

# 3. Prevent your Mac from sleeping while the process runs!
# Replace 12345 with the actual PID from the command above.
caffeinate -i -w 12345
```
*Note: As soon as the Python script finishes, `caffeinate` will automatically close and allow your Mac to sleep normally.*

### Option 2: Fast Targeted Update
If you only want to quickly update a few specific stocks (takes seconds) instead of waiting hours for the entire market:
```bash
python scripts/extract_full_market_v2.py --tickers FPT,HPG,MWG
```

### Option 3: Fast Period Update (Quarterly Only)
To skip checking yearly reports and only fetch quarterly data (cuts download time in half for rapid weekly updates):
```bash
python scripts/extract_full_market_v2.py --period quarter
```

### Option 4: Limit History Saved
To prevent your files from growing massively by holding onto 15 years of overlapping history, you can limit the extraction to only the latest `N` periods:
```bash
python scripts/extract_full_market_v2.py --max-periods 4
```
*(This will save only the 4 most recent quarters/years)*

---

## Output Files
When the script finishes, it aggregates everything into:
- **`data/Master_Financials_All.parquet`**: The complete Master File (Fastest to load in Python/Pandas).
- **`data/Master_Financials_All.json`**: The complete Master File in JSON format.
- **`data/coverage_report_v2.csv`**: A summary of how many rows/columns were successfully retrieved for each ticker.
- **`data/extraction_v2.log`**: The log showing success, warnings, and skipped tickers.

## How to Monitor Progress
You can watch the script working in real-time by trailing the log file:
```bash
tail -f data/extraction_v2.log
```
*(Press `Ctrl + C` to stop watching the log. This will NOT stop the download).*

## How to Stop the Download safely
If you need to forcefully stop the background download:
```bash
kill -9 $(ps aux | grep "extract_full_market_v2.py" | grep -v grep | awk '{print $2}')
```
*(Thanks to the checkpoint system, you won't lose any data and can simply restart it later).*
