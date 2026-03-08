import os
import boto3
from dotenv import load_dotenv

load_dotenv('.env.local')

s3 = boto3.client('s3',
    endpoint_url=os.environ['R2_ENDPOINT'],
    aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'],
    region_name='auto'
)

resp = s3.list_objects_v2(Bucket=os.environ['R2_BUCKET'], Prefix='cafef_data/dl_equity/')
for obj in resp.get('Contents', []):
    print(obj['Key'])
