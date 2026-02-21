import requests

def fetch_daily_valuation(symbol):
    print(f"Fetching daily TTM valuation for {symbol}...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    # VNDirect's famous API for live trailing ratios (51025 is P/E, 51023 is P/B)
    url = f"https://finfo-api.vndirect.com.vn/v4/ratios/latest?filter=itemCode:51025,51023&where=code:{symbol}"
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        data = response.json()
        
        pe_ratio = None
        pb_ratio = None
        
        for item in data.get('data', []):
            if item.get('itemCode') == '51025':
                pe_ratio = item.get('value')
            elif item.get('itemCode') == '51023':
                pb_ratio = item.get('value')
                
        print(f"Current P/E: {pe_ratio}")
        print(f"Current P/B: {pb_ratio}")
        return pe_ratio, pb_ratio
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fetch_daily_valuation('PNJ')
    fetch_daily_valuation('HPG')
