import pandas as pd
import numpy as np

def analyze_data():
    file_path = "data/Master_Financials_All.parquet"
    print(f"Loading {file_path}...")
    df = pd.read_parquet(file_path)
    
    # 1. Basic Stats
    total_rows = len(df)
    unique_tickers = df['Ticker'].nunique()
    print("\n" + "="*50)
    print("DATASET OVERVIEW")
    print("="*50)
    print(f"Total Rows:        {total_rows:,}")
    print(f"Total Columns:     {len(df.columns):,}")
    print(f"Unique Tickers:    {unique_tickers:,}")
    
    # 2. Coverage by Period Type (Yearly vs Quarterly)
    if 'Quarter' in df.columns:
        yearly_rows = len(df[df['Quarter'] == 5])
        quarterly_rows = len(df[df['Quarter'] != 5])
        print(f"Yearly Reports:    {yearly_rows:,}")
        print(f"Quarterly Reports: {quarterly_rows:,}")
    
    # 3. Time Range
    if 'Year' in df.columns:
        min_year = df['Year'].min()
        max_year = df['Year'].max()
        print(f"Time Range:        {min_year} - {max_year}")
        
    # 4. Missing Values Analysis
    print("\n" + "="*50)
    print("MISSING VALUES ANALYSIS")
    print("="*50)
    
    # Calculate missing percentages for all columns
    missing_stats = df.isnull().mean() * 100
    
    # Group columns by missing severity
    print(f"Total Columns: {len(df.columns)}")
    print(f"  - 0% missing (perfect):       {(missing_stats == 0).sum()} columns")
    print(f"  - 1% to 25% missing:          {((missing_stats > 0) & (missing_stats <= 25)).sum()} columns")
    print(f"  - 25% to 50% missing:         {((missing_stats > 25) & (missing_stats <= 50)).sum()} columns")
    print(f"  - 50% to 75% missing:         {((missing_stats > 50) & (missing_stats <= 75)).sum()} columns")
    print(f"  - > 75% missing:              {(missing_stats > 75).sum()} columns")
    
    print("\nTop 10 Most Complete Financial Metric Columns:")
    # Filter out metadata columns for this view
    meta_cols = ['Ticker', 'Year', 'Quarter']
    data_cols = [c for c in df.columns if c not in meta_cols]
    best_cols = missing_stats[data_cols].sort_values().head(10)
    for col, pct in best_cols.items():
        print(f"  {col[:35]:<35} : {pct:.1f}% missing")
        
    print("\nTop 10 Most Empty Financial Metric Columns:")
    worst_cols = missing_stats[data_cols].sort_values(ascending=False).head(10)
    for col, pct in worst_cols.items():
        print(f"  {col[:35]:<35} : {pct:.1f}% missing")

    # 5. Missing Data per Ticker (Who has the worst data?)
    print("\n" + "="*50)
    print("TICKER DATA QUALITY")
    print("="*50)
    
    # Calculate percentage of NaN cells for each row, then average by ticker
    row_missing_pct = df.isnull().mean(axis=1) * 100
    df['missing_pct'] = row_missing_pct
    
    ticker_quality = df.groupby('Ticker')['missing_pct'].mean().sort_values()
    
    print("Top 5 Most Complete Tickers (Least Missing Data):")
    for ticker, pct in ticker_quality.head(5).items():
        print(f"  {ticker:<10} : {pct:.1f}% data is missing/empty")
        
    print("\nTop 5 Most Sparse Tickers (Most Missing Data):")
    for ticker, pct in ticker_quality.tail(5).items():
        print(f"  {ticker:<10} : {pct:.1f}% data is missing/empty")

if __name__ == "__main__":
    analyze_data()
