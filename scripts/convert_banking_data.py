import pandas as pd
import os
import json
import numpy as np

# Define paths
# Assuming this script is run from the project root (investment_website)
PROJECT_ROOT = os.getcwd()
BANKING_PROJECT_DIR = os.path.join(PROJECT_ROOT, 'banking_project_tab', 'Projectbanking')
DATA_DIR = os.path.join(BANKING_PROJECT_DIR, 'Data')
OUTPUT_DIR = os.path.join(PROJECT_ROOT, 'public', 'data', 'banking')

# Ensure output directory exists
os.makedirs(OUTPUT_DIR, exist_ok=True)

def convert_parquet_to_json(filename, output_name):
    parquet_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(parquet_path):
        print(f"Warning: {filename} not found at {parquet_path}")
        return

    print(f"Reading {filename}...")
    df = pd.read_parquet(parquet_path)
    
    # Handle NaN/Inf for JSON serialization
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.where(pd.notnull(df), None)
    
    # Convert dates to string if necessary
    # (Parquet often handles dates well, but JSON needs valid types)
    
    json_path = os.path.join(OUTPUT_DIR, output_name)
    print(f"Writing to {json_path}...")
    
    # Use orient='records' for a list of objects
    df.to_json(json_path, orient='records', date_format='iso')

def convert_excel_to_json(filename, output_name):
    excel_path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(excel_path):
        print(f"Warning: {filename} not found at {excel_path}")
        return

    print(f"Reading {filename}...")
    df = pd.read_excel(excel_path)
    
    df = df.replace([np.inf, -np.inf], np.nan)
    df = df.where(pd.notnull(df), None)
    
    json_path = os.path.join(OUTPUT_DIR, output_name)
    print(f"Writing to {json_path}...")
    df.to_json(json_path, orient='records')

def main():
    print("Starting banking data conversion...")
    
    # Convert Quarter Data
    convert_parquet_to_json('dfsectorquarter.parquet', 'banking_quarterly.json')
    
    # Convert Year Data
    convert_parquet_to_json('dfsectoryear.parquet', 'banking_yearly.json')
    
    # Convert Forecast Data
    convert_parquet_to_json('dfsectorforecast.parquet', 'banking_forecast.json')
    
    # Convert Key Items
    convert_excel_to_json('Key_items.xlsx', 'key_items.json')
    
    print("Conversion complete.")

if __name__ == "__main__":
    main()
