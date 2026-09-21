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

print("--- Inspecting creator and source fields of WATAN orders ---")
watan_orders = list(db['rushwash_sale_orders'].find({
    'lines.catalogCode': {'$in': ['DSC-00078', 'DSC-00079']},
    'status': {'$in': ['paid', 'active', 'completed']}
}))

creator_counts = {}
user_ids = set()

for o in watan_orders:
    cb = str(o.get('createdById') or 'none')
    user_ids.add(cb)
    creator_counts[cb] = creator_counts.get(cb, 0) + 1

print("CreatedById distribution:", creator_counts)

# Look up who these createdByIds belong to in rushwash_users or rushwash_employees or customers
print("\n--- Resolving user IDs ---")
for uid in user_ids:
    if uid == 'none': continue
    u = db['rushwash_users'].find_one({'_id': pymongo.collection.ObjectId(uid) if len(uid) == 24 else uid})
    if not u:
        # try as string
        u = db['rushwash_users'].find_one({'_id': uid})
    if u:
        print(f"User ID {uid}: Name='{u.get('name')}', Role='{u.get('role')}', Email='{u.get('email')}'")
    else:
        # check customer
        c = db['rushwash_customers'].find_one({'_id': pymongo.collection.ObjectId(uid) if len(uid) == 24 else uid})
        if c:
            print(f"Customer ID {uid}: Name='{c.get('name')}', Phone='{c.get('phone')}'")
        else:
            print(f"ID {uid}: Unknown entity")

# Inspect sample order metadata
print("\n--- Inspecting 5 sample order metadata ---")
for o in watan_orders[:5]:
    print(f"\nOrder: {o.get('readableCode')} | Customer: {o.get('customerSnapshot', {}).get('name')}")
    print("  Metadata:", o.get('metadata'))
    print("  Origin:", o.get('origin'))
    print("  Channel:", o.get('channel'))
    print("  posSessionId:", o.get('posSessionId'))
    print("  posRegisterId:", o.get('posRegisterId'))
    print("  createdById:", o.get('createdById'))
    if o.get('payments'):
        p = o['payments'][0]
        print("  Payment details:", {k: v for k, v in p.items() if k not in ['paymentToken']})
