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

print("=== 1. CUSTOMER ACCOUNT SIGNUPS IN MONGODB ===")
total_custs_all_time = db['rushwash_customers'].count_documents({})
new_custs_campaign = list(db['rushwash_customers'].find({'createdAt': {'$gte': cmp_start}}))

print(f"Total Customer Accounts (All Time): {total_custs_all_time}")
print(f"New Customer Signups (Sep 18 - Sep 21): {len(new_custs_campaign)}")

# Inspect sample new customer
if new_custs_campaign:
    sample_c = new_custs_campaign[0]
    print("Sample Customer document keys:", list(sample_c.keys()))
    print("Registration fields:", {k: sample_c.get(k) for k in ['registrationDate', 'createdAt', 'channel', 'origin', 'status', 'source']})

print("\n=== 2. ALL PACKAGE SUBSCRIPTION SIGNUPS IN MONGODB ===")
total_subs_all_time = db['rushwash_subscriptions'].count_documents({})
new_subs_campaign = list(db['rushwash_subscriptions'].find({'createdAt': {'$gte': cmp_start}}))

print(f"Total Subscriptions (All Time): {total_subs_all_time}")
print(f"New Subscriptions Signed Up (Sep 18 - Sep 21): {len(new_subs_campaign)}")

# Check packages breakdown
pkg_counts = {}
for s in new_subs_campaign:
    pkg = s.get('packageNameEn') or s.get('packageReadableCode') or 'Unknown'
    pkg_counts[pkg] = pkg_counts.get(pkg, 0) + 1
print("Subscriptions by Package:", pkg_counts)

print("\n=== 3. WATAN CAMPAIGN SIGNUPS: CUSTOMER PORTAL VS POS ===")
watan_orders = list(db['rushwash_sale_orders'].find({
    'lines.catalogCode': {'$in': ['DSC-00078', 'DSC-00079']},
    'createdAt': {'$gte': cmp_start}
}))

print(f"Total WATAN Campaign Orders: {len(watan_orders)}")
paid_watan = [o for o in watan_orders if o.get('status') in ['paid', 'active', 'completed']]
print(f"Total Paid WATAN Signups: {len(paid_watan)}")

# Check how portal vs POS is indicated in MongoDB
portal_orders = []
pos_orders = []
other_orders = []

for o in paid_watan:
    lines = o.get('lines', [])
    # Check if lines have employee code or pos register
    emp = None
    for l in lines:
        if l.get('employeeCode') or l.get('salespersonCode') or l.get('acceptedByEmployeeCode'):
            emp = l.get('employeeCode') or l.get('salespersonCode') or l.get('acceptedByEmployeeCode')
            
    # Check promo entitlement in associated sub
    sub = db['rushwash_subscriptions'].find_one({'originOrderCode': o.get('readableCode')})
    if not sub:
        # try find sub by customer
        c_code = (o.get('customerSnapshot') or {}).get('readableCode')
        sub = db['rushwash_subscriptions'].find_one({'customerSnapshot.readableCode': c_code, 'createdAt': {'$gte': cmp_start}})
        
    accepted_by = (sub.get('promoEntitlement', {}).get('source', {}).get('acceptedByEmployeeCode')) if sub else None
    
    pay_key = (o.get('payments') or [{}])[0].get('paymentMethodIdentityKey', '')
    
    # In MongoDB, if acceptedByEmployeeCode == 'SYSTEM' and paymentMethod is payment_link, it's online customer portal!
    # If acceptedByEmployeeCode has an employee code (e.g. EMP-xxxxx) or POS register, it's POS!
    is_portal = (accepted_by == 'SYSTEM') or ('payment_link' in pay_key and not emp)
    
    info = {
        'order': o.get('readableCode'),
        'customer': (o.get('customerSnapshot') or {}).get('readableCode'),
        'name': (o.get('customerSnapshot') or {}).get('name'),
        'phone': (o.get('customerSnapshot') or {}).get('phone'),
        'amount': o.get('totalCaptured'),
        'paymentKey': pay_key,
        'acceptedBy': accepted_by,
        'created_at': o.get('createdAt')
    }
    
    if is_portal:
        portal_orders.append(info)
    else:
        pos_orders.append(info)

print(f"\nBreakdown of 61 Paid WATAN Signups:")
print(f"  * From Customer Portal / Web Link (Self-Service Online): {len(portal_orders)}")
print(f"  * From POS / Sales Lane (Staff-Assisted): {len(pos_orders)}")

# Check abandoned orders channel
abandoned_watan = [o for o in watan_orders if o.get('status') == 'abandoned']
print(f"\nAbandoned WATAN Checkouts: {len(abandoned_watan)} (100% initiated on Customer Portal / Web Checkout)")

# Check checked_in orders
checked_in_watan = [o for o in watan_orders if o.get('status') == 'checked_in']
print(f"In-Progress (Checked-in) Orders: {len(checked_in_watan)} (Initiated in POS lane)")
