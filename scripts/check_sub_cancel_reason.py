import os
import sys
import json
from datetime import datetime, timezone, timedelta
import dns.resolver
import pymongo
from dotenv import load_dotenv

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

load_dotenv()
resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '1.1.1.1']
dns.resolver.default_resolver = resolver

client = pymongo.MongoClient(os.getenv('MONGODB_URI'), serverSelectionTimeoutMS=10000)
db = client.get_database('rushwash')

print("=== 1. FULL SUBSCRIPTION DOCUMENT: SUB-34224 ===")
sub = db['rushwash_subscriptions'].find_one({'readableCode': 'SUB-34224'})
if sub:
    clean_sub = {k: v for k, v in sub.items() if k != '_id'}
    print(json.dumps(clean_sub, indent=2, default=str))
else:
    print("SUB-34224 not found!")

print("\n=== 2. AUDIT EVENTS FOR SUB-34224 & CUS-12957 ===")
events = list(db['rushwash_audit_events'].find({
    '$or': [
        {'targetCode': 'SUB-34224'},
        {'targetCode': 'ORD-29702'},
        {'targetCode': 'CUS-12957'},
        {'customerCode': 'CUS-12957'}
    ]
}))
print(f"Total audit events found: {len(events)}")
for ev in events:
    clean_ev = {k: v for k, v in ev.items() if k != '_id'}
    print(json.dumps(clean_ev, indent=2, default=str))

print("\n=== 3. ANY EVENTS AROUND 2026-09-18 18:14 UTC (21:14 AST) ===")
t_from = datetime(2026, 9, 18, 18, 10, 0, tzinfo=timezone.utc)
t_to = datetime(2026, 9, 18, 18, 20, 0, tzinfo=timezone.utc)
time_events = list(db['rushwash_audit_events'].find({
    'createdAt': {'$gte': t_from, '$lte': t_to}
}))
print(f"Total audit events in 10-minute window: {len(time_events)}")
for ev in time_events:
    clean_ev = {k: v for k, v in ev.items() if k != '_id'}
    print(json.dumps(clean_ev, indent=2, default=str))
