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

print("[*] Fetching all abandoned WATAN online checkouts...")

# Query abandoned orders with DSC-00078 or DSC-00079
abandoned_cursor = db['rushwash_sale_orders'].find({
    'lines.catalogCode': {'$in': ['DSC-00078', 'DSC-00079']},
    'status': 'abandoned'
}).sort('createdAt', -1)

abandoned_orders = list(abandoned_cursor)
print(f"Total abandoned orders found: {len(abandoned_orders)}")

# Customer ID map to get phone if missing in snapshot
cust_ids = [o.get('customerId') for o in abandoned_orders if o.get('customerId')]
cust_map = {}
for c in db['rushwash_customers'].find({'_id': {'$in': cust_ids}}, {'readableCode': 1, 'name': 1, 'phone': 1, 'normalizedPhone': 1}):
    cust_map[str(c['_id'])] = {
        'code': c.get('readableCode'),
        'name': c.get('name'),
        'phone': c.get('phone') or c.get('normalizedPhone')
    }

results = []
for o in abandoned_orders:
    c_snap = o.get('customerSnapshot') or {}
    cid = str(o.get('customerId')) if o.get('customerId') else None
    c_info = cust_map.get(cid, {})
    
    code = c_snap.get('readableCode') or o.get('customerCode') or c_info.get('code') or 'N/A'
    name = c_snap.get('name') or c_info.get('name') or 'N/A'
    phone = c_snap.get('phone') or c_info.get('phone') or 'N/A'
    
    # Vehicle
    v_snap = o.get('vehicleSnapshot') or {}
    plate = v_snap.get('displayPlate') or v_snap.get('normalizedPlate') or 'N/A'
    
    # Promo & Package
    lines = o.get('lines', [])
    promo = 'WATAN96' if any(l.get('catalogCode') == 'DSC-00078' for l in lines) else 'WATAN223'
    pkg_line = next((l for l in lines if l.get('lineKind') == 'package'), {})
    pkg_name = pkg_line.get('titleEn') or pkg_line.get('titleAr') or 'Nano'
    
    # Price
    price = 96 if promo == 'WATAN96' else 223
    
    # Date
    dt = o.get('createdAt')
    dt_local = (dt + timedelta(hours=3)).strftime('%Y-%m-%d %I:%M %p') if dt else 'N/A'
    
    # Payments info
    payments = o.get('payments', [])
    pay_method = payments[0].get('paymentMethodNameEn') or payments[0].get('provider') if payments else 'Moyasar Link'
    pay_url = (o.get('metadata') or {}).get('checkoutUrl') or (o.get('metadata') or {}).get('paymentUrl') or 'N/A'
    
    results.append({
        'order_code': o.get('readableCode'),
        'customer_code': code,
        'customer_name': name,
        'phone': phone,
        'plate': plate,
        'promo': promo,
        'package': pkg_name,
        'amount': price,
        'datetime_ast': dt_local,
        'payment_method': pay_method,
        'raw_date': dt
    })

print(f"\nExtracted {len(results)} abandoned orders.")
for idx, r in enumerate(results, 1):
    print(f"{idx:02d}. {r['order_code']} | {r['customer_code']} | {r['customer_name']} | Phone: {r['phone']} | Plate: {r['plate']} | {r['promo']} ({r['amount']} SAR) | {r['datetime_ast']}")

# Save to JSON export
export_path = r"c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan_abandoned_online_orders.json"
with open(export_path, 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False, default=str)
print(f"\nSaved export to {export_path}")
