import pandas as pd
import json
import os
import time

try:
    from vnstock import Finance
except ImportError:
    import subprocess
    import sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "vnstock"])
    from vnstock import Finance

def fetch_financials(symbol, period='year'):
    print(f"Fetching {period} financials for {symbol}...")
    try:
        # Rate limiting sleep to be safe
        time.sleep(2)
        fin = Finance(symbol=symbol, period=period, source='VCI')
        
        # Pull statements
        bs = fin.balance_sheet(lang='vi', mode='raw') if hasattr(fin, 'balance_sheet') else None
        time.sleep(1)
        
        ist = fin.income_statement(lang='vi', mode='raw') if hasattr(fin, 'income_statement') else None
        time.sleep(1)
        
        cf = fin.cash_flow(lang='vi', mode='raw') if hasattr(fin, 'cash_flow') else None
        time.sleep(1)
        
        ratio = fin.ratio(lang='vi', mode='raw') if hasattr(fin, 'ratio') else None
        
        output_dir = "sample_financials"
        os.makedirs(output_dir, exist_ok=True)
        
        if bs is not None and not bs.empty:
            bs.to_parquet(f"{output_dir}/{symbol}_balance_sheet_{period}.parquet")
            print(f" - Saved Balance Sheet ({len(bs)} rows / {len(bs.columns)} columns)")
            
        if ist is not None and not ist.empty:
            ist.to_parquet(f"{output_dir}/{symbol}_income_statement_{period}.parquet")
            print(f" - Saved Income Statement ({len(ist)} rows / {len(ist.columns)} columns)")
            
        if cf is not None and not cf.empty:
            cf.to_parquet(f"{output_dir}/{symbol}_cash_flow_{period}.parquet")
            print(f" - Saved Cash Flow ({len(cf)} rows / {len(cf.columns)} columns)")
            
        if ratio is not None and not ratio.empty:
            # Flatten MultiIndex columns for parquet
            if isinstance(ratio.columns, pd.MultiIndex):
                ratio.columns = ['_'.join(map(str, col)).strip() for col in ratio.columns.values]
            # Convert values to string or float to avoid mixed types in Parquet
            ratio = ratio.astype(str)
            ratio.to_parquet(f"{output_dir}/{symbol}_ratio_{period}.parquet")
            print(f" - Saved Financial Ratios ({len(ratio)} rows / {len(ratio.columns)} columns)")
            
    except Exception as e:
        print(f"Error fetching for {symbol}: {e}")

if __name__ == "__main__":
    test_symbols = ['PNJ', 'ACB', 'HPG']
    # Test Quarterly
    for sym in test_symbols:
        fetch_financials(sym, period='quarter')
    # Test Yearly
    for sym in test_symbols:
        fetch_financials(sym, period='year')
    print("Done! Data saved to 'sample_financials/' directory.")
