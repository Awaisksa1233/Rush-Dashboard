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

def inspect_customer(cust_code, label):
    print(f"\n=======================================================")
    print(f"=== {label}: {cust_code} ===")
    print(f"=======================================================")
    
    # Customer
    c = db['rushwash_customers'].find_one({'readableCode': cust_code})
    if c:
        print(f"Customer Name: {c.get('name')}, Phone: {c.get('phone')}, Created: {c.get('createdAt')}")
        cid = c.get('_id')
    else:
        print("Customer not found in rushwash_customers!")
        cid = None

    # Orders
    print("\n--- Orders ---")
    orders = list(db['rushwash_sale_orders'].find({
        '$or': [{'customerSnapshot.readableCode': cust_code}, {'customerCode': cust_code}, {'customerId': cid}]
    }))
    for o in orders:
        dt = o.get('createdAt')
        dt_local = dt + timedelta(hours=3) if dt else None
        print(f"Order: {o.get('readableCode')} | Status: {o.get('status')} | TotalCaptured: {o.get('totalCaptured')} | Created: {dt_local}")
        for l in o.get('lines', []):
            print(f"   Line: {l.get('titleEn')} | catalogCode: {l.get('catalogCode')} | unitPrice: {l.get('unitPrice')} | lineKind: {l.get('lineKind')}")
        if o.get('payments'):
            print(f"   Payments: {o.get('payments')}")

    # Subscriptions
    print("\n--- Subscriptions ---")
    subs = list(db['rushwash_subscriptions'].find({
        '$or': [{'customerSnapshot.readableCode': cust_code}, {'customerCode': cust_code}, {'customerId': cid}]
    }))
    for s in subs:
        dt_c = s.get('createdAt') + timedelta(hours=3) if s.get('createdAt') else None
        dt_canc = s.get('cancelledAt') + timedelta(hours=3) if s.get('cancelledAt') else None
        print(f"Subscription: {s.get('readableCode')} | Status: {s.get('status')} | Plan: {s.get('planTitleEn') or s.get('packageCode')} | Created: {dt_c} | Cancelled: {dt_canc} | CancelReason: {s.get('cancelReason')}")
        # print full cancellation metadata if exists
        for k in ['cancelReason', 'cancellationReason', 'cancelledBy', 'cancelledByRole', 'cancellationNotes', 'metadata', 'history']:
            if s.get(k):
                print(f"   {k}: {s.get(k)}")

    # Audit events
    print("\n--- Audit Events ---")
    events = list(db['rushwash_audit_events'].find({
        '$or': [
            {'targetCode': {'$in': [s.get('readableCode') for s in subs] + [o.get('readableCode') for o in orders] + [cust_code]}},
            {'customerCode': cust_code}
        ]
    }))
    for ev in events:
        dt_ev = ev.get('createdAt') + timedelta(hours=3) if ev.get('createdAt') else None
        print(f"Audit: {ev.get('action')} on {ev.get('targetCode')} | Actor: {ev.get('actorSnapshot', {}).get('name')} | Time: {dt_ev} | Details: {ev.get('details') or ev.get('payload')}")

inspect_customer('CUS-12957', 'CUS-12957 (علي عسيري - SUB-34224)')
inspect_customer('CUS-12116', 'CUS-12116 (اميره - SUB-34309)')
