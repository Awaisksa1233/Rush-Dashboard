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

cmp_start = datetime(2026, 9, 18, 0, 0, 0, tzinfo=timezone.utc)

paid_watan_orders = list(db['rushwash_sale_orders'].find({
    'lines.catalogCode': {'$in': ['DSC-00078', 'DSC-00079']},
    'status': {'$in': ['paid', 'active', 'completed']},
    'createdAt': {'$gte': cmp_start}
}).sort('createdAt', 1))

print(f"Total Paid WATAN Orders: {len(paid_watan_orders)}")

cust_codes = list(set((o.get('customerSnapshot') or {}).get('readableCode') or o.get('customerCode') for o in paid_watan_orders))
print(f"Unique customer codes: {len(cust_codes)}")

# Fetch ALL washes for these customers since Sep 18 in one single query
all_washes = list(db['rushwash_wash_histories'].find({
    '$or': [
        {'customerSnapshot.readableCode': {'$in': cust_codes}},
        {'customerCode': {'$in': cust_codes}}
    ],
    'createdAt': {'$gte': cmp_start}
}))

print(f"Total wash records found for these 61 customers since Sep 18: {len(all_washes)}")

# Map washes by customer
washes_by_cust = {}
for w in all_washes:
    cc = (w.get('customerSnapshot') or {}).get('readableCode') or w.get('customerCode')
    if cc:
        w_time = w.get('washDate') or w.get('createdAt')
        washes_by_cust.setdefault(cc, []).append({
            'code': w.get('readableCode'),
            'time': w_time,
            'plate': w.get('normalizedPlate') or (w.get('vehicleSnapshot') or {}).get('displayPlate')
        })

physical_lane_sales = []
pure_online_sales = []

for o in paid_watan_orders:
    c_snap = o.get('customerSnapshot') or {}
    cc = c_snap.get('readableCode') or o.get('customerCode')
    name = c_snap.get('name')
    phone = c_snap.get('phone')
    o_code = o.get('readableCode')
    o_time = o.get('createdAt')
    
    cust_w_list = washes_by_cust.get(cc, [])
    
    # Check if any wash occurred within 3 hours of order time
    near_washes = []
    same_day_washes = []
    
    for w in cust_w_list:
        w_t = w['time']
        if not w_t: continue
        diff_minutes = abs((w_t - o_time).total_seconds()) / 60.0
        if diff_minutes <= 180: # within 3 hours
            near_washes.append((w, round(diff_minutes)))
        if w_t.date() == o_time.date():
            same_day_washes.append(w)
            
    dt_local_str = (o_time + timedelta(hours=3)).strftime('%Y-%m-%d %I:%M %p') if o_time else 'N/A'
    
    info = {
        'order': o_code,
        'customer': cc,
        'name': name,
        'phone': phone,
        'order_time': dt_local_str,
        'near_washes': near_washes,
        'same_day_washes_count': len(same_day_washes)
    }
    
    if near_washes or same_day_washes:
        physical_lane_sales.append(info)
    else:
        pure_online_sales.append(info)

print(f"\n=======================================================")
print(f"=== PHYSICAL SALES LANE (Purchased While at the Station) ===")
print(f"=======================================================")
print(f"Count: {len(physical_lane_sales)} ({(len(physical_lane_sales)/len(paid_watan_orders))*100:.1f}%)")
for r in physical_lane_sales[:15]:
    diff_str = f"Washed {r['near_washes'][0][1]} mins from order" if r['near_washes'] else "Washed same day"
    print(f"  * {r['order']} | {r['customer']} ({r['name']}) | Order Time: {r['order_time']} | {diff_str}")

print(f"\n=======================================================")
print(f"=== PURE REMOTE ONLINE PORTAL (Signed up from Home / Web) ===")
print(f"=======================================================")
print(f"Count: {len(pure_online_sales)} ({(len(pure_online_sales)/len(paid_watan_orders))*100:.1f}%)")
for r in pure_online_sales:
    print(f"  * {r['order']} | {r['customer']} ({r['name']}) | Phone: {r['phone']} | Order Time: {r['order_time']}")
