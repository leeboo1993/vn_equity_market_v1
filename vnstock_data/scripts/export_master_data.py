import os
import time
import json
import pandas as pd
from fetch_financials_r2 import fetch_and_merge_quarterly

def create_master_files():
    tickers = [
        "ACB", "BCG", "BID", "BVH", "CTG", "DGC", "DIG", "FPT", "GAS", "GEX", 
        "HDB", "HPG", "KBC", "KDH", "MBB", "MSN", "MWG", "NLG", "PC1", "PDR", 
        "PNJ", "POW", "PTB", "PVD", "PVS", "REE", "SAB", "SHB", "SSB", "SSI", 
        "STB", "TCB", "TCH", "TPB", "VCB", "VCI", "VGC", "VHC", "VHM", "VIB", 
        "VIC", "VJC", "VND", "VNM", "VPB", "VPI", "VRE"
    ]
    
    # Store all data
    all_data_flattened = []
    
    print(f"Starting extraction for {len(tickers)} tickers to create a master file...")
    print("-" * 50)
    print(f"{'TICKER':<10} | {'QUARTERS':<10} | {'COLUMNS':<10} | {'MIN YEAR':<10} | {'MAX YEAR':<10}")
    print("-" * 50)
    
    for symbol in tickers:
        try:
            # Reusing the existing extraction logic
            data_list = fetch_and_merge_quarterly(symbol)
            
            if not data_list:
                print(f"{symbol:<10} | {'0':<10} | {'0':<10} | {'N/A':<10} | {'N/A':<10}")
                continue
                
            # Add ticker symbol to each row
            years = []
            columns = 0
            for row in data_list:
                row['Ticker'] = symbol
                years.append(row.get('Year', 0))
                columns = len(row.keys())
                all_data_flattened.append(row)
            
            # Print coverage summary for this ticker
            min_y = min(years) if years else "N/A"
            max_y = max(years) if years else "N/A"
            print(f"{symbol:<10} | {len(data_list):<10} | {columns:<10} | {min_y:<10} | {max_y:<10}")
            
            # Rate limit
            time.sleep(2)
            
        except Exception as e:
            print(f"{symbol:<10} | ERROR: {e}")
            
    print("-" * 50)
    print(f"Extraction complete! Total rows pooled: {len(all_data_flattened)}")
    
    if not all_data_flattened:
        print("No data extracted.")
        return
        
    df_master = pd.DataFrame(all_data_flattened)
    
    # Export to Parquet
    parquet_path = "/Users/leeboo/Desktop/Broker_Master_Financials.parquet"
    df_master.to_parquet(parquet_path, index=False)
    print(f"✅ Saved Master Parquet: {parquet_path}")
    
    # Export to JSON
    json_path = "/Users/leeboo/Desktop/Broker_Master_Financials.json"
    df_master.to_json(json_path, orient='records', force_ascii=False, indent=2)
    print(f"✅ Saved Master JSON: {json_path}")


if __name__ == "__main__":
    create_master_files()
