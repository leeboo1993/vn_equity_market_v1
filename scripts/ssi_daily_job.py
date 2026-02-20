"""
Script to fetch daily stock prices from SSI FastConnect API,
convert to Parquet format (matching CafeF schema), and upload to Cloudflare R2.

Schema:
    Col 0: Ticker
    Col 1: Date (YYYYMMDD integer)
    Col 2: Open (not used by app but good to have)
    Col 3: High
    Col 4: Low
    Col 5: Close
    Col 6: Volume

Usage:
    python scripts/ssi_daily_job.py
"""

import os
import sys
import json
import logging
import datetime
import pandas as pd
import requests
import boto3
from io import BytesIO
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env.local'))

# Add ssi_price_api to path if needed, though we installed the package
# sys.path.append(os.path.join(os.path.dirname(__file__), '../ssi_price_api'))

try:
    from ssi_fc_data import fc_md_client, model
except ImportError:
    print("Error: ssi_fc_data not found. Please install it first.")
    sys.exit(1)

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Configuration ---
# Fallback to ssi_price_api.config if exists
fallback_consumer_id = ""
fallback_consumer_secret = ""
try:
    sys.path.append(os.path.join(os.path.dirname(__file__), '../ssi_price_api'))
    import config as ssi_fallback_config
    fallback_consumer_id = getattr(ssi_fallback_config, 'consumerID', "")
    fallback_consumer_secret = getattr(ssi_fallback_config, 'consumerSecret', "")
except ImportError:
    pass

CONSUMER_ID = os.environ.get("SSI_CONSUMER_ID", fallback_consumer_id)
CONSUMER_SECRET = os.environ.get("SSI_CONSUMER_SECRET", fallback_consumer_secret)
PRIVATE_KEY_PATH = os.environ.get("SSI_PRIVATE_KEY_PATH", "ssi_price_api/private_key.pem")

# Cloudflare R2 Config
R2_BUCKET = os.environ.get("R2_BUCKET", "broker-data")
R2_ENDPOINT = os.environ.get("R2_ENDPOINT", "https://d956c3d2700cc782d68a6c2a994a8913.r2.cloudflarestorage.com")
R2_ACCESS_KEY = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")

class SSIConfig:
    def __init__(self):
        self.consumerID = CONSUMER_ID
        self.consumerSecret = CONSUMER_SECRET
        self.private_key = None
        self.url = 'https://fc-data.ssi.com.vn/'
        self.stream_url = 'https://fc-datahub.ssi.com.vn/'
        self.auth_type = 'Bearer'
        
        # Load private key if path exists
        if PRIVATE_KEY_PATH and os.path.exists(PRIVATE_KEY_PATH):
             with open(PRIVATE_KEY_PATH, 'r') as f:
                 self.private_key = f.read()

def get_ssi_client():
    if not CONSUMER_ID or not CONSUMER_SECRET:
        logger.error("SSI Credentials missing. Please set SSI_CONSUMER_ID and SSI_CONSUMER_SECRET.")
        return None
    
    config = SSIConfig()
    client = fc_md_client.MarketDataClient(config)
    return client, config

def upload_to_r2(data_bytes, filename):
    if not R2_ACCESS_KEY or not R2_SECRET_KEY:
        logger.error("R2 Credentials missing. Skipping upload.")
        return

    s3 = boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY,
        aws_secret_access_key=R2_SECRET_KEY,
        region_name='auto'
    )

    try:
        s3.put_object(Bucket=R2_BUCKET, Key=f"cafef_data/{filename}", Body=data_bytes)
        logger.info(f"Uploaded {filename} to R2 bucket {R2_BUCKET}")
    except Exception as e:
        logger.error(f"Failed to upload to R2: {e}")

def main():
    client, config = get_ssi_client()
    if not client:
        return

    # 1. Get Access Token
    try:
        # The library method access_token expects a model object
        req = model.accessToken(config.consumerID, config.consumerSecret)
        res = client.access_token(req)
        if res.get('status') != 200:
             logger.error(f"Failed to get access token: {res}")
             return
        
        logger.info("Successfully authenticated with SSI")
        # Ensure the client uses this token for subsequent requests if required by the lib
        # The lib might store it in the client instance or we might need to pass header.
        # Looking at sample code, it seems we don't need to manually pass it if using the client methods correctly?
        # Actually checking test_Req_Res.py: client.daily_stock_price(config, ...)
        # It seems the library handles signing/token internally or via config.
        
    except Exception as e:
        logger.error(f"Auth error: {e}")
        return

    # 2. Get Tickers List from R2 metadata
    # Instead of fetching all securities from SSI (which can fail or be too large),
    # we only fetch prices for tickers that our app actually tracks.
    all_tickers = []
    
    # 2. Get Tickers List from existing R2 parquet file
    # We read the latest price history file and extract unique tickers.
    all_tickers = []
    try:
        if not R2_ACCESS_KEY or not R2_SECRET_KEY:
            logger.error(f"R2 Credentials missing. ID: {'Set' if R2_ACCESS_KEY else 'Missing'}, SECRET: {'Set' if R2_SECRET_KEY else 'Missing'}")
            return

        s3 = boto3.client(
            's3',
            endpoint_url=R2_ENDPOINT,
            aws_access_key_id=R2_ACCESS_KEY,
            aws_secret_access_key=R2_SECRET_KEY,
            region_name='auto'
        )
        
        logger.info("Finding latest parquet file to extract tickers...")
        res = s3.list_objects_v2(Bucket=R2_BUCKET, Prefix='cafef_data/')
        if 'Contents' in res:
            files = [c['Key'] for c in res['Contents'] if c['Key'].endswith('.parquet') and ('cafef_stock_price' in c['Key'] or 'ssi_stock_price' in c['Key'])]
            if files:
                # Naive sort by filename, which works for YYMMDD
                files.sort(reverse=True)
                latest_file = files[0]
                logger.info(f"Downloading {latest_file} to extract tickers...")
                
                obj = s3.get_object(Bucket=R2_BUCKET, Key=latest_file)
                df_existing = pd.read_parquet(BytesIO(obj['Body'].read()))
                
                # Assume column 0 is Ticker based on schema
                ticker_col = df_existing.columns[0]
                all_tickers = df_existing[ticker_col].unique().tolist()
                logger.info(f"Loaded {len(all_tickers)} tickers from {latest_file}")
            else:
                 logger.error("No existing parquet files found to extract tickers from.")
                 return
    except Exception as e:
        logger.error(f"Error loading tickers from R2 parquet: {e}")
        return

    # Remove duplicates and clean
    all_tickers = sorted([t for t in set(all_tickers) if isinstance(t, str) and len(t) == 3])
    logger.info(f"Total valid unique tickers to fetch: {len(all_tickers)}")
    
    # 3. Fetch Stock Prices
    # For daily job, we want the LATEST available data.
    # We can fetch 'Daily Stock Price' for today (or last trading day).
    # SSI API: daily_stock_price (symbol, fromDate, toDate, pageIndex, pageSize, market)
    
    today = datetime.datetime.now()
    today_str = today.strftime("%d/%m/%Y")
    # If fetch fails (weekend/holiday), we might want to try a range.
    # Let's try fetching just today. If empty, the parquet will be empty (or we fetch last 3 days to be safe and take latest).
    
    start_date = (today - datetime.timedelta(days=5)).strftime("%d/%m/%Y") 
    end_date = today_str
    
    records = []
    
    # Batch processing or Sequential? API limits?
    # SSI likely has rate limits. Sequential is safer for now.
    
    # Optimize: Fetching 1600+ tickers sequentially might take too long.
    # But for a daily job running in background, maybe OK.
    # FastConnect is fast.
    
    # HOWEVER: ssi_fc_data might not support bulk fetch.
    # Let's look for "Market/DailyStockPrice" endpoint.
    
    count = 0
    for ticker in all_tickers:
        try:
            # daily_stock_price(config, req)
            req = model.daily_stock_price(ticker, start_date, end_date, 1, 100, '') 
            res = client.daily_stock_price(config, req)
            
            if res.get('status') == 200 and 'data' in res:
                # data is list of OHLC
                # We want the latest one
                history = res['data']
                if history:
                    # Sort by date descending
                    # Date format from SSI? usually DD/MM/YYYY or similar
                    # Check sample response in documentation if possible, assume DD/MM/YYYY based on request
                    
                    # We need to collect ALL history for these days? 
                    # No, the goal is "ssi_stock_price_DDMMYY.parquet" which implies a SNAPSHOT of prices for a specific date.
                    # Or does it imply the full history?
                    # The existing `priceHistory.js` logic reads `cafef_stock_price_DDMMYY.parquet`.
                    # Let's check `lib/priceHistory.js` again to see how it consumes the parquet.
                    # It reads: ticker = row[0], dateVal = row[1], close = row[5] * 1000
                    # It builds a MAP: ticker -> [ {time, close}, ... ]
                    # It seems the parquet file contains HISTORY (multiple dates) for multiple tickers?
                    # "cafef_stock_price_DDMMYY.parquet" name suggests it's a file GENERATED/UPDATED on DDMMYY.
                    # If it's just a snapshot of THAT DAY, then `priceHistory.js` would only have 1 data point per ticker?
                    # "map.get(ticker).push({ time: ..., close: ... })"
                    # "val.sort((a,b) => ...)"
                    # This implies the parquet contains MULTIPLE rows per ticker (history).
                    # So we should dump the entire history or a significant window?
                    # A 5MB parquet can hold a lot.
                    # The current file is `cafef_stock_price_241105.parquet`.
                    # It likely contains full history up to that date.
                    
                    # Re-fetching FULL history for 1600 tickers every day is heavy.
                    # But if we want to replace CafeF, we need the history.
                    # Maybe we can fetch full history for last 3 years?
                    
                    # Adjust date range
                    full_start_date = "01/01/2020"
                    
                    # Update request to fetch full history
                    req = model.daily_stock_price(ticker, full_start_date, end_date, 1, 5000, '')
                    res = client.daily_stock_price(config, req)
                    
                    if res.get('status') == 200 and 'data' in res:
                        for row in res['data']:
                            # Transform to schema
                            # SSI row keys: Market, Symbol, TradingDate, Open, High, Low, Close, Volume, Value
                            # Date format: dd/mm/yyyy
                            
                            d_str = row.get('TradingDate', '')
                            # Convert to YYYYMMDD integer
                            try:
                                d_parts = d_str.split('/')
                                d_int = int(f"{d_parts[2]}{d_parts[1]}{d_parts[0]}") # YYYYMMDD
                                
                                records.append({
                                    'Ticker': row.get('Symbol'),
                                    'Date': d_int,
                                    'Open': float(row.get('Open', 0)),
                                    'High': float(row.get('High', 0)),
                                    'Low': float(row.get('Low', 0)),
                                    'Close': float(row.get('Close', 0)), # SSI might be in 1000s or 1s? CafeF was 10.5 -> 10500?
                                    # Existing code: close = Number(row[5]) * 1000;
                                    # CAFEF data was likely in 1000s (e.g. 10.5).
                                    # SSI data usually is in 1s (e.g. 10500).
                                    # ONE IMPORTANT CHECK: SSI 'Close' is usually 10500. 
                                    # If we save 10500, existing code does * 1000 -> 10,500,000. WRONG.
                                    # We should normalize to match CafeF schema OR update `priceHistory.js`.
                                    # Easier to update `priceHistory.js` to handle SSI file differently.
                                    # But to keep schema clean, let's keep it consistent?
                                    # No, let's save Raw SSI and handle in JS.
                                    'Volume': float(row.get('Volume', 0))
                                })
                            except ValueError:
                                pass
            
            count += 1
            if count % 100 == 0:
                logger.info(f"Processed {count}/{len(all_tickers)} tickers...")
                
        except Exception as e:
            logger.error(f"Error processing {ticker}: {e}")

    # 4. Create DataFrame and Save Parquet
    if not records:
        logger.warning("No records found.")
        return

    df = pd.DataFrame(records)
    # Reorder columns to match schema implicitly (though parquet has names)
    # Schema: Ticker, Date, Open, High, Low, Close, Volume
    df = df[['Ticker', 'Date', 'Open', 'High', 'Low', 'Close', 'Volume']]
    
    # Save to buffer
    buffer = BytesIO()
    df.to_parquet(buffer, index=False)
    buffer.seek(0)
    
    # Unique filename for today
    filename = f"ssi_stock_price_{today.strftime('%y%m%d')}.parquet"
    
    # 5. Upload to R2
    upload_to_r2(buffer.getvalue(), filename)
    logger.info("Job completed successfully.")

if __name__ == "__main__":
    main()
