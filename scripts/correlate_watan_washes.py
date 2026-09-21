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

cmp_start = datetime(2026, 9, 18, 0, 0, 0, tzinfo=timezone.utc)

paid_watan_orders = list(db['rushwash_sale_orders'].find({
    'lines.catalogCode': {'$in': ['DSC-00078', 'DSC-00079']},
    'status': {'$in': ['paid', 'active', 'completed']},
    'createdAt': {'$gte': cmp_start}
}).sort('createdAt', 1))

print(f"Total Paid WATAN Orders: {len(paid_watan_orders)}")

# Check for wash activity within +/- 60 minutes of order creation
physical_lane_sales = []
remote_online_sales = []

for o in paid_watan_orders:
    c_snap = o.get('customerSnapshot') or {}
    cc = c_snap.get('readableCode') or o.get('customerCode')
    name = c_snap.get('name')
    phone = c_snap.get('phone')
    o_code = o.get('readableCode')
    o_time = o.get('createdAt')
    
    # Check washes for this customer on the same day (+/- 2 hours)
    t_min = o_time - timedelta(minutes=120)
    t_max = o_time + timedelta(minutes=120)
    
    washes = list(db['rushwash_wash_histories'].find({
        '$or': [{'customerSnapshot.readableCode': cc}, {'customerCode': cc}],
        '$or': [
            {'washDate': {'$gte': t_min, '$lte': t_max}},
            {'createdAt': {'$gte': t_min, '$lte': t_max}}
        ]
    }))
    
    # Also check if any wash at all occurred on the same calendar day
    same_day_min = datetime(o_time.year, o_time.month, o_time.day, 0, 0, 0, tzinfo=timezone.utc)
    same_day_max = same_day_min + timedelta(days=1)
    same_day_washes = list(db['rushwash_wash_histories'].find({
        '$or': [{'customerSnapshot.readableCode': cc}, {'customerCode': cc}],
        '$or': [
            {'washDate': {'$gte': same_day_min, '$lt': same_day_max}},
            {'createdAt': {'$gte': same_day_min, '$lt': same_day_max}}
        ]
    }))
    
    dt_local = o_time + timedelta(hours=3) if o_time else None
    
    record = {
        'order': o_code,
        'customer': cc,
        'name': name,
        'phone': phone,
        'order_time': dt_local.strftime('%Y-%m-%d %I:%M %p') if dt_local else 'N/A',
        'washes_immediate': len(washes),
        'washes_same_day': len(same_day_washes),
        'wash_times': [(w.get('washDate') or w.get('createdAt') + timedelta(hours=3)).strftime('%I:%M %p') for w in washes]
    }
    
    if washes or same_day_washes:
        physical_lane_sales.append(record)
    else:
        remote_online_sales.append(record)

print(f"\n=======================================================")
print(f"=== PHYSICAL LANE SALES (Washed at Station on Same Day) ===")
print(f"=======================================================")
print(f"Count: {len(physical_lane_sales)}")
for r in physical_lane_sales[:10]:
    print(f"  {r['order']} | {r['customer']} ({r['name']}) | Order: {r['order_time']} | Immediate Washes: {r['washes_immediate']} {r['wash_times']}")

print(f"\n=======================================================")
print(f"=== REMOTE / PURE ONLINE PORTAL SALES (No Wash Same Day) ===")
print(f"=======================================================")
print(f"Count: {len(remote_online_sales)}")
for r in remote_online_sales[:10]:
    print(f"  {r['order']} | {r['customer']} ({r['name']}) | Order: {r['order_time']}")
