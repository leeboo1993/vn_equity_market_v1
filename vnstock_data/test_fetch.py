from extract_full_market_v2 import fetch_single
import pandas as pd
df, err = fetch_single("FPT", "quarter")
if df is not None:
    print("Success: ", len(df))
else:
    print("Error: ", err)
