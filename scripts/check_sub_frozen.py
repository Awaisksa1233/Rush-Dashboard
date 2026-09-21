import os
import sys
import json
import dns.resolver
import pymongo
from dotenv import load_dotenv

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

load_dotenv()
resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '1.1.1.1']
dns.resolver.default_resolver = resolver

client = pymongo.MongoClient(os.getenv('MONGODB_URI'), serverSelectionTimeoutMS=10000)
db = client.get_database('rushwash')

print("=== SUB-34309 (CUS-12116 - FROZEN) ===")
sub = db['rushwash_subscriptions'].find_one({'readableCode': 'SUB-34309'})
if sub:
    clean_sub = {k: v for k, v in sub.items() if k != '_id'}
    print(json.dumps(clean_sub, indent=2, default=str))
