import os
import json
import pandas as pd
import numpy as np
from fredapi import Fred
from vnstock import Vnstock
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

DATA_FILE = 'public/data/macro_data.json'

def fetch_fred_data(api_key):
    if not api_key:
        print("Warning: FRED_API_KEY not found. Skipping Global Data.")
        return {}
    
    fred = Fred(api_key=api_key)
    
    # FRED Series Codes
    indicators = {
        'FEDFUNDS': 'Fed Funds Rate',
        'CPIAUCSL': 'US CPI',
        'UNRATE': 'US Unemployment',
        'DGS10': 'US 10Y Treasury',
        'M2SL': 'US M2 Money Supply'
    }
    
    data = {}
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365*5) # Last 5 years
    
    print("Fetching FRED data...")
    for code, name in indicators.items():
        try:
            series = fred.get_series(code, observation_start=start_date)
            # Convert to list of dicts: {date, value}
            df = series.reset_index()
            df.columns = ['date', 'value']
            df['date'] = df['date'].dt.strftime('%Y-%m-%d')
            
            # Handle NaN robustly: convert to object type first, then replace
            df['value'] = df['value'].astype(object)
            df = df.replace({np.nan: None})
            
            data[code] = {
                'name': name,
                'data': df.to_dict('records')
            }
            print(f"  - Fetched {name}")
        except Exception as e:
            print(f"  ! Error fetching {name} ({code}): {e}")
            
    return data

def fetch_vietnam_market_data():
    print("Fetching Vietnam Market data...")
    data = {}
    
    try:
        # VNINDEX
        vn = Vnstock()
        stock = vn.stock(symbol='VNINDEX', source='VCI')
        end_date_str = datetime.now().strftime('%Y-%m-%d')
        start_date_str = (datetime.now() - timedelta(days=365*5)).strftime('%Y-%m-%d')
        
        history = stock.quote.history(start=start_date_str, end=end_date_str)
        
        if not history.empty:
            if 'time' in history.columns:
                history['date'] = pd.to_datetime(history['time']).dt.strftime('%Y-%m-%d')
            elif 'date' in history.columns:
                 history['date'] = pd.to_datetime(history['date']).dt.strftime('%Y-%m-%d')
            
            # Ensure safe values for Vietnam data too
            df = history[['date', 'close']].rename(columns={'close': 'value'})
            df['value'] = df['value'].astype(object)
            df = df.replace({np.nan: None})

            data['VNINDEX'] = {
                'name': 'VN-Index',
                'data': df.to_dict('records')
            }
            print("  - Fetched VN-Index")
            
    except Exception as e:
        print(f"  ! Error fetching VNINDEX: {e}")

    return data

def main():
    fred_key = os.getenv('FRED_API_KEY')
    
    global_data = fetch_fred_data(fred_key)
    vietnam_data = fetch_vietnam_market_data()
    
    final_output = {
        'last_updated': datetime.now().isoformat(),
        'global': global_data,
        'vietnam': vietnam_data
    }
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_output, f, indent=2)
    
    print(f"Macro data saved to {DATA_FILE}")

if __name__ == "__main__":
    main()
