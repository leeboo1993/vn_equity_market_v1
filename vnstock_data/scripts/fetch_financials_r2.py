import os
import time
import json
import logging
import boto3
import pandas as pd
from datetime import datetime

try:
    from vnstock import Finance
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "vnstock"])
    from vnstock import Finance

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("FinancialsR2")

# --- Cloudflare R2 Config ---
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_ENDPOINT = os.environ.get("R2_ENDPOINT")
R2_BUCKET = os.environ.get("R2_BUCKET", "broker-data")

def get_s3_client():
    if not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY or not R2_ENDPOINT:
        logger.error("Missing R2 credentials. Please set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_ENDPOINT.")
        return None
    
    return boto3.client(
        's3',
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name='auto' # Cloudflare R2 uses 'auto'
    )

def fetch_and_merge_quarterly(symbol):
    """Fetches BS, IS, CF, and Ratios for a symbol and merges them into a single dictionary array."""
    logger.info(f"Fetching quarterly financials for {symbol}...")
    try:
        fin = Finance(symbol=symbol, period='quarter', source='VCI')
        
        # 1. Fetch
        time.sleep(2)
        bs = fin.balance_sheet(lang='vi', mode='raw') if hasattr(fin, 'balance_sheet') else pd.DataFrame()
        time.sleep(1)
        ist = fin.income_statement(lang='vi', mode='raw') if hasattr(fin, 'income_statement') else pd.DataFrame()
        time.sleep(1)
        cf = fin.cash_flow(lang='vi', mode='raw') if hasattr(fin, 'cash_flow') else pd.DataFrame()
        time.sleep(1)
        ratio = fin.ratio(lang='vi', mode='raw') if hasattr(fin, 'ratio') else pd.DataFrame()
        
        if bs.empty and ist.empty:
             logger.warning(f"No financial data found for {symbol}.")
             return []

        # 2. Standardize Join Keys
        def get_period_keys(df):
            if 'Năm' in df.columns and 'Kỳ' in df.columns:
                return ['Năm', 'Kỳ']
            elif 'Meta_Năm' in df.columns and 'Meta_Kỳ' in df.columns:
                 return ['Meta_Năm', 'Meta_Kỳ']
            elif 'yearReport' in df.columns and 'lengthReport' in df.columns:
                return ['yearReport', 'lengthReport']
            return None
            
        dfs = [bs, ist, cf, ratio]
        prefixes = ['BS_', 'IS_', 'CF_', 'RATIO_']
        common_dfs = []
        
        for i, df in enumerate(dfs):
            if df.empty:
                 continue
            
            # Flatten multi-index if exists
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = ['_'.join(map(str, col)).strip() for col in df.columns.values]
                
            keys = get_period_keys(df)
            if keys:
                # rename keys
                df = df.rename(columns={keys[0]: 'Year', keys[1]: 'Quarter'})
                # prefix other columns to avoid collisions, ignoring Year/Quarter
                new_cols = {}
                for c in df.columns:
                    if c not in ['Year', 'Quarter']:
                        new_cols[c] = f"{prefixes[i]}{c}"
                df = df.rename(columns=new_cols)
                
                # Force numeric types for join keys
                df['Year'] = pd.to_numeric(df['Year'], errors='coerce').fillna(0).astype('int64')
                df['Quarter'] = pd.to_numeric(df['Quarter'], errors='coerce').fillna(0).astype('int64')
                
                # Filter out any 'Unnamed' columns
                df = df.loc[:, ~df.columns.str.contains('^Unnamed')]
                
                # Drop duplicates on Year/Quarter
                df = df.drop_duplicates(subset=['Year', 'Quarter'])
                common_dfs.append(df)
                
        if not common_dfs:
            logger.error(f"Could not find common period keys for {symbol}.")
            return []
            
        # 3. Merge
        logger.info(f"Merging {len(common_dfs)} datasets for {symbol}...")
        merged = common_dfs[0]
        for i in range(1, len(common_dfs)):
            merged = pd.merge(merged, common_dfs[i], on=['Year', 'Quarter'], how='outer')
            
        # Sort chronologically (newest first)
        merged = merged.sort_values(['Year', 'Quarter'], ascending=[False, False])
        
        # 4. Clean Data for JSON (Replace NaN with None)
        merged = merged.where(pd.notnull(merged), None)
        
        # Convert to list of dictionaries
        result = merged.to_dict(orient='records')
        logger.info(f"Successfully processed {len(result)} quarters for {symbol}.")
        return result
        
    except Exception as e:
        logger.error(f"Error fetching for {symbol}: {e}")
        return []

def upload_json_to_r2(s3_client, symbol, data):
    """Uploads the JSON payload to Cloudflare R2"""
    if not data:
         return False
         
    json_bytes = json.dumps(data, ensure_ascii=False).encode('utf-8')
    s3_key = f"financials/{symbol}_quarterly.json"
    
    try:
        s3_client.put_object(
            Bucket=R2_BUCKET,
            Key=s3_key,
            Body=json_bytes,
            ContentType='application/json'
        )
        logger.info(f"✅ Uploaded {s3_key} to R2 bucket '{R2_BUCKET}'")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to upload {symbol} to R2: {e}")
        return False

def main():
    s3_client = get_s3_client()
    if not s3_client:
        return
        
    # Full list of actively tracked tickers
    tickers = [
        "ACB", "BCG", "BID", "BVH", "CTG", "DGC", "DIG", "FPT", "GAS", "GEX", 
        "HDB", "HPG", "KBC", "KDH", "MBB", "MSN", "MWG", "NLG", "PC1", "PDR", 
        "PNJ", "POW", "PTB", "PVD", "PVS", "REE", "SAB", "SHB", "SSB", "SSI", 
        "STB", "TCB", "TCH", "TPB", "VCB", "VCI", "VGC", "VHC", "VHM", "VIB", 
        "VIC", "VJC", "VND", "VNM", "VPB", "VPI", "VRE"
    ]
    
    logger.info(f"Starting financial update for {len(tickers)} tickers...")
    
    success_count = 0
    for i, symbol in enumerate(tickers, 1):
        logger.info(f"[{i}/{len(tickers)}] Processing {symbol}...")
        
        # We need to capture the returned data array
        data = fetch_and_merge_quarterly(symbol)
        
        if data and len(data) > 0:
             if upload_json_to_r2(s3_client, symbol, data):
                  success_count += 1
                  
        # Polite API delay between companies
        time.sleep(3)
        
    logger.info(f"🎉 Financial Update Complete! Successfully updated {success_count}/{len(tickers)} tickers.")

if __name__ == "__main__":
    main()
