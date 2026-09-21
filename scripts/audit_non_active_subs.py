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

# 1. Get all WATAN sale orders
watan_orders = list(db['rushwash_sale_orders'].find({
    'lines.catalogCode': {'$in': ['DSC-00078', 'DSC-00079']}
}))
print(f"Total WATAN sale orders: {len(watan_orders)}")

order_by_code = {o.get('readableCode'): o for o in watan_orders}
cids = [o.get('customerId') for o in watan_orders if o.get('customerId')]
cust_codes = list(set((o.get('customerSnapshot') or {}).get('readableCode') or o.get('customerCode') for o in watan_orders if (o.get('customerSnapshot') or {}).get('readableCode') or o.get('customerCode')))

# 2. Query all subscriptions for these customers
subs = list(db['rushwash_subscriptions'].find({
    '$or': [
        {'customerId': {'$in': cids}},
        {'customerSnapshot.readableCode': {'$in': cust_codes}}
    ]
}))

print(f"Found {len(subs)} total subscriptions for WATAN customers.")

status_counts = {}
for s in subs:
    st = s.get('status')
    status_counts[st] = status_counts.get(st, 0) + 1

print("\nSubscription Status Breakdown:")
for st, cnt in status_counts.items():
    print(f"  - {st}: {cnt}")

print("\n=== NON-ACTIVE SUBSCRIPTIONS DETAILS ===")
non_active = [s for s in subs if s.get('status') != 'active']
for s in non_active:
    c_snap = s.get('customerSnapshot') or {}
    v_snap = s.get('vehicleSnapshot') or {}
    dt_created = s.get('createdAt')
    dt_cancelled = s.get('cancelledAt')
    dt_frozen = s.get('frozenAt')
    
    dt_c_local = dt_created + timedelta(hours=3) if dt_created else None
    dt_canc_local = dt_cancelled + timedelta(hours=3) if dt_cancelled else None
    
    # Check lines/package
    pkg_title = s.get('planTitleEn') or s.get('planTitleAr') or s.get('packageCode') or (s.get('planSnapshot') or {}).get('titleEn')
    origin_order = s.get('originOrderCode') or s.get('orderCode') or s.get('initialOrderCode')
    
    print(f"\n[!] Subscription Code: {s.get('readableCode')}")
    print(f"    Status: {s.get('status')}")
    print(f"    Customer: {c_snap.get('readableCode')} ({c_snap.get('name')}) | Phone: {c_snap.get('phone')}")
    print(f"    Vehicle: {v_snap.get('displayPlate')} / {v_snap.get('normalizedPlate')}")
    print(f"    Package: {pkg_title}")
    print(f"    Price / Fee: {s.get('price')} SAR (Recurring: {s.get('recurringPrice')})")
    print(f"    Created: {dt_c_local}")
    print(f"    Cancelled At: {dt_canc_local}")
    print(f"    Cancel Reason: {s.get('cancelReason') or s.get('cancellationReason') or s.get('reason')}")
    print(f"    Cancellation Source / User: {s.get('cancelledBy') or s.get('cancelledByRole')}")
    print(f"    Origin Order: {origin_order}")
    if origin_order and origin_order in order_by_code:
        ord_doc = order_by_code[origin_order]
        print(f"    Order Info: Status={ord_doc.get('status')}, TotalCaptured={ord_doc.get('totalCaptured')}, Lines={[l.get('titleEn') for l in ord_doc.get('lines', [])]}")
