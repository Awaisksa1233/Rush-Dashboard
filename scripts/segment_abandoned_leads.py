import os
import sys
import json
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

# Load the 18 abandoned orders
with open(r'c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan_abandoned_online_orders.json', 'r', encoding='utf-8') as f:
    abandoned_list = json.load(f)

# Get all customer codes who have a PAID promo order
paid_custs = set()
for o in db['rushwash_sale_orders'].find({
    'lines.catalogCode': {'$in': ['DSC-00078', 'DSC-00079']},
    'status': {'$in': ['paid', 'active', 'completed']}
}):
    c_snap = o.get('customerSnapshot') or {}
    cc = c_snap.get('readableCode') or o.get('customerCode')
    if cc: paid_custs.add(cc)

unrecovered = []
recovered = []

for item in abandoned_list:
    cc = item['customer_code']
    if cc in paid_custs:
        recovered.append(item)
    else:
        unrecovered.append(item)

print(f"Total Abandoned Orders: {len(abandoned_list)}")
print(f"  - Unrecovered (Hot Leads - Still Unpaid): {len(unrecovered)}")
print(f"  - Recovered (Later completed payment): {len(recovered)}")

print("\n=== UNRECOVERED HOT LEADS ===")
for idx, r in enumerate(unrecovered, 1):
    print(f"{idx}. {r['customer_name']} | Phone: {r['phone']} | Plate: {r['plate']} | Order: {r['order_code']} | Promo: {r['promo']} ({r['amount']} SAR) | Date: {r['datetime_ast']}")

# Save separated lists
with open(r'c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan_unrecovered_hot_leads.json', 'w', encoding='utf-8') as f:
    json.dump({
        'unrecovered_hot_leads': unrecovered,
        'recovered_orders': recovered
    }, f, indent=2, ensure_ascii=False)
