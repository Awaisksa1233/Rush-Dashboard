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

print("=== 1. CHECKING SALE ORDERS FOR WATAN96 & WATAN223 ===")

orders_78 = list(db['rushwash_sale_orders'].find({'lines.catalogCode': 'DSC-00078'}))
orders_79 = list(db['rushwash_sale_orders'].find({'lines.catalogCode': 'DSC-00079'}))

print(f"Total WATAN96 (DSC-00078) Orders: {len(orders_78)}")
print(f"Total WATAN223 (DSC-00079) Orders: {len(orders_79)}")

status_78 = {}
for o in orders_78:
    st = o.get('status')
    status_78[st] = status_78.get(st, 0) + 1
print("WATAN96 Order Statuses:", status_78)

status_79 = {}
for o in orders_79:
    st = o.get('status')
    status_79[st] = status_79.get(st, 0) + 1
print("WATAN223 Order Statuses:", status_79)

all_promo_orders = orders_78 + orders_79
paid_order_codes = [o.get('readableCode') for o in all_promo_orders if o.get('status') in ['paid', 'active', 'completed']]
all_order_codes = [o.get('readableCode') for o in all_promo_orders if o.get('readableCode')]

print(f"\nTotal Paid/Active Promo Orders: {len(paid_order_codes)}")

print("\n=== 2. CHECKING ASSOCIATED SUBSCRIPTIONS ===")

# Look for subscriptions created by these orders or customers
subs = list(db['rushwash_subscriptions'].find({
    '$or': [
        {'originOrderCode': {'$in': all_order_codes}},
        {'orderCode': {'$in': all_order_codes}},
        {'initialOrderCode': {'$in': all_order_codes}},
        {'couponCode': {'$in': ['WATAN96', 'WATAN223', 'DSC-00078', 'DSC-00079']}},
        {'discountCode': {'$in': ['WATAN96', 'WATAN223', 'DSC-00078', 'DSC-00079']}}
    ]
}))

print(f"Found {len(subs)} directly linked subscriptions in rushwash_subscriptions.")

sub_status_counts = {}
cancelled_subs = []
active_subs = []

for s in subs:
    st = s.get('status')
    sub_status_counts[st] = sub_status_counts.get(st, 0) + 1
    c_snap = s.get('customerSnapshot') or {}
    v_snap = s.get('vehicleSnapshot') or {}
    
    sub_info = {
        'subCode': s.get('readableCode'),
        'customerCode': c_snap.get('readableCode') or s.get('customerCode'),
        'customerName': c_snap.get('name'),
        'phone': c_snap.get('phone'),
        'plate': v_snap.get('displayPlate') or v_snap.get('normalizedPlate'),
        'status': st,
        'createdAt': s.get('createdAt'),
        'cancelledAt': s.get('cancelledAt'),
        'cancelReason': s.get('cancelReason') or s.get('cancellationReason'),
        'originOrderCode': s.get('originOrderCode') or s.get('orderCode')
    }
    
    if st in ['cancelled', 'canceled', 'terminated', 'refunded']:
        cancelled_subs.append(sub_info)
    else:
        active_subs.append(sub_info)

print("Subscription Statuses:", sub_status_counts)
print(f"Total Cancelled Subscriptions: {len(cancelled_subs)}")
for cs in cancelled_subs:
    print(f"  * CANCELLED SUB: {cs['subCode']} | Cust: {cs['customerCode']} ({cs['customerName']}) | CancelledAt: {cs['cancelledAt']} | Reason: {cs['cancelReason']}")

# Check if there are any subscriptions by customer codes of the paid orders
paid_customers = list(set((o.get('customerSnapshot') or {}).get('readableCode') or o.get('customerCode') for o in all_promo_orders if o.get('status') in ['paid', 'active', 'completed']))
print(f"\nUnique customers with paid WATAN orders: {len(paid_customers)}")

all_customer_subs = list(db['rushwash_subscriptions'].find({'customerCode': {'$in': paid_customers}}))
print(f"Total subscriptions across these {len(paid_customers)} customers: {len(all_customer_subs)}")
for cs in all_customer_subs:
    st = cs.get('status')
    c_snap = cs.get('customerSnapshot') or {}
    if st in ['cancelled', 'canceled', 'terminated', 'refunded']:
        print(f"  * Customer {cs.get('customerCode')} has a cancelled sub: {cs.get('readableCode')}, status: {st}, created: {cs.get('createdAt')}, cancelled: {cs.get('cancelledAt')}, reason: {cs.get('cancelReason')}")

print("\n=== 3. CHECKING REFUND REQUESTS ===")
refunds = list(db['rushwash_refund_requests'].find({
    '$or': [
        {'orderCode': {'$in': all_order_codes}},
        {'customerCode': {'$in': paid_customers}}
    ]
}))
print(f"Total refund requests for WATAN orders/customers: {len(refunds)}")
for ref in refunds:
    print("  * REFUND:", ref)

print("\n=== 4. CHECKING ANY CANCELLED ORDERS ===")
cancelled_orders = [o for o in all_promo_orders if o.get('status') in ['cancelled', 'canceled', 'refunded']]
print(f"Cancelled Promo Orders: {len(cancelled_orders)}")
for co in cancelled_orders:
    c_snap = co.get('customerSnapshot') or {}
    print(f"  * CANCELLED ORDER: {co.get('readableCode')} | Cust: {c_snap.get('readableCode')} ({c_snap.get('name')}) | Status: {co.get('status')} | Lines: {[l.get('titleEn') for l in co.get('lines', [])]}")
