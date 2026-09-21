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
    except Exception:
        pass

load_dotenv()
resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '1.1.1.1']
dns.resolver.default_resolver = resolver

client = pymongo.MongoClient(os.getenv('MONGODB_URI'), serverSelectionTimeoutMS=10000)
db = client.get_database('rushwash')

print("--- 1. Inspecting one paid WATAN order in detail ---")
o = db['rushwash_sale_orders'].find_one({'lines.catalogCode': 'DSC-00078', 'status': {'$in': ['paid', 'active', 'completed']}})
if o:
    print("Order keys:", list(o.keys()))
    print("Order readableCode:", o.get('readableCode'))
    print("customerId:", o.get('customerId'), type(o.get('customerId')))
    print("customerSnapshot:", o.get('customerSnapshot'))
    print("subscriptionId:", o.get('subscriptionId'))
    print("lines:")
    for l in o.get('lines', []):
        print("  line:", {k: v for k, v in l.items() if k not in ['image', 'description']})

print("\n--- 2. How are subscriptions indexed in rushwash_subscriptions? ---")
sample_sub = db['rushwash_subscriptions'].find_one()
if sample_sub:
    print("Sample sub keys:", list(sample_sub.keys()))
    print("customerId in sub:", sample_sub.get('customerId'), type(sample_sub.get('customerId')))
    print("customerSnapshot in sub:", sample_sub.get('customerSnapshot'))
    print("status in sub:", sample_sub.get('status'))

print("\n--- 3. Check subscriptions by customerId (ObjectId) ---")
# Get all customerIds from the 61 paid WATAN orders
order_cursor = db['rushwash_sale_orders'].find({
    'lines.catalogCode': {'$in': ['DSC-00078', 'DSC-00079']},
    'status': {'$in': ['paid', 'active', 'completed']}
})

cids = []
cust_codes = []
for doc in order_cursor:
    cid = doc.get('customerId')
    if cid: cids.append(cid)
    cc = (doc.get('customerSnapshot') or {}).get('readableCode') or doc.get('customerCode')
    if cc: cust_codes.append(cc)

print(f"Collected {len(cids)} customerIds and {len(cust_codes)} customerCodes")

subs_by_cid = list(db['rushwash_subscriptions'].find({'customerId': {'$in': cids}}))
print(f"Subscriptions found by customerId: {len(subs_by_cid)}")
for s in subs_by_cid:
    print(f"  Sub: {s.get('readableCode')} | Cust: {s.get('customerSnapshot', {}).get('readableCode')} | Status: {s.get('status')} | CancelledAt: {s.get('cancelledAt')} | CancelReason: {s.get('cancelReason')}")

subs_by_code = list(db['rushwash_subscriptions'].find({'customerSnapshot.readableCode': {'$in': cust_codes}}))
print(f"Subscriptions found by customerSnapshot.readableCode: {len(subs_by_code)}")
for s in subs_by_code:
    print(f"  Sub: {s.get('readableCode')} | Cust: {s.get('customerSnapshot', {}).get('readableCode')} | Status: {s.get('status')} | CancelledAt: {s.get('cancelledAt')} | CancelReason: {s.get('cancelReason')}")
