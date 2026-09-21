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

# Find all orders that redeemed DSC-00078 (WATAN96) or DSC-00079 (WATAN223)
watan_orders = list(db['rushwash_sale_orders'].find({
    'lines.catalogCode': {'$in': ['DSC-00078', 'DSC-00079']}
}))

print(f"Total WATAN Orders: {len(watan_orders)}")

# Group orders by status
orders_by_status = {}
for o in watan_orders:
    st = o.get('status')
    orders_by_status.setdefault(st, []).append(o)

for st, ords in orders_by_status.items():
    print(f"  Order Status '{st}': {len(ords)}")

# Look at every customer with a paid/active WATAN order
paid_ords = [o for o in watan_orders if o.get('status') in ['paid', 'active', 'completed']]
print(f"\nPaid/Active WATAN orders count: {len(paid_ords)}")

cust_ids = [o.get('customerId') for o in paid_ords if o.get('customerId')]
cust_codes = [(o.get('customerSnapshot') or {}).get('readableCode') or o.get('customerCode') for o in paid_ords]

all_subs = list(db['rushwash_subscriptions'].find({
    '$or': [
        {'customerId': {'$in': cust_ids}},
        {'customerSnapshot.readableCode': {'$in': cust_codes}}
    ]
}))

print(f"Total Subscriptions found for these customers: {len(all_subs)}")

subs_by_status = {}
for s in all_subs:
    st = s.get('status')
    subs_by_status.setdefault(st, []).append(s)

print("\nSubscription Status Breakdown:")
for st, s_list in subs_by_status.items():
    print(f"  - Status '{st}': {len(s_list)} subscriptions")

print("\n=== COMPLETE LIST OF CANCELLED / FROZEN / INACTIVE SUBSCRIPTIONS ===")
for st, s_list in subs_by_status.items():
    if st != 'active':
        for s in s_list:
            c_snap = s.get('customerSnapshot') or {}
            v_snap = s.get('vehicleSnapshot') or {}
            dt_c = s.get('createdAt') + timedelta(hours=3) if s.get('createdAt') else None
            dt_canc = s.get('cancelledAt') + timedelta(hours=3) if s.get('cancelledAt') else None
            print(f"Subscription: {s.get('readableCode')}")
            print(f"  Status: {st}")
            print(f"  Customer: {c_snap.get('readableCode')} ({c_snap.get('name')}) | Phone: {c_snap.get('phone')}")
            print(f"  Plate: {v_snap.get('displayPlate')}")
            print(f"  Created: {dt_c}")
            print(f"  Cancelled At: {dt_canc}")
            print(f"  Cancel Reason: {s.get('cancelReason')}")
            print(f"  Auto-Renew Enabled: {s.get('autoRenew') or s.get('isAutoRenew')}")
            print("")
