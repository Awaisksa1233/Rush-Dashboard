import os
import sys
from datetime import datetime, timezone, timedelta
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

print("=== Checking Wash History for CUS-12957 ===")
washes = list(db['rushwash_wash_histories'].find({
    '$or': [{'customerSnapshot.readableCode': 'CUS-12957'}, {'customerCode': 'CUS-12957'}]
}))
print(f"Total washes found: {len(washes)}")
for w in washes:
    dt = w.get('washDate') or w.get('createdAt')
    dt_local = dt + timedelta(hours=3) if dt else None
    print(f"Wash: {w.get('readableCode')} | Plate: {w.get('normalizedPlate')} | Date: {dt_local} | Service: {w.get('serviceSnapshot', {}).get('nameAr')} | Package: {w.get('packageSnapshot', {}).get('nameAr')}")
