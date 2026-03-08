import os
import boto3
import json
from dotenv import load_dotenv

load_dotenv('.env.local')

s3 = boto3.client('s3',
    endpoint_url=os.environ['R2_ENDPOINT'],
    aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
    region_name='auto'
)

resp = s3.get_object(Bucket=os.environ['R2_BUCKET'], Key='cafef_data/gov_bond_yield/hnx_bond_yield_260306.json')
data = json.loads(resp['Body'].read().decode('utf-8'))
if isinstance(data, dict):
    print("Keys:", list(data.keys())[:10])
    first_key = list(data.keys())[0]
    print(f"Sample for {first_key}:", data[first_key])
else:
    print(json.dumps(data[:5], indent=2))
