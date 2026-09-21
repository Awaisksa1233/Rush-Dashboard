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

# Campaign start: 2026-09-18 00:00:00 UTC
cmp_start = datetime(2026, 9, 18, 0, 0, 0, tzinfo=timezone.utc)

print("=== 1. DEFINING & COUNTING SIGNUPS SINCE CAMPAIGN LAUNCH (Sep 18 - Sep 21) ===")

# A. New Customer Accounts Registered
new_custs = list(db['rushwash_customers'].find({'createdAt': {'$gte': cmp_start}}))
print(f"A. Total New Customer Accounts Registered: {len(new_custs)}")

cust_origins = {}
for c in new_custs:
    orig = c.get('origin') or c.get('source') or c.get('channel') or (c.get('metadata') or {}).get('channel') or 'N/A'
    cust_origins[orig] = cust_origins.get(orig, 0) + 1
print("   Customer Registration Sources/Channels:", cust_origins)

# B. Total New Package Subscriptions Created (All Packages)
new_subs = list(db['rushwash_subscriptions'].find({'createdAt': {'$gte': cmp_start}}))
print(f"\nB. Total New Subscriptions Created (All Packages): {len(new_subs)}")
sub_status = {}
for s in new_subs:
    st = s.get('status')
    sub_status[st] = sub_status.get(st, 0) + 1
print("   Subscription Statuses:", sub_status)

# C. WATAN Campaign Package Subscriptions / Orders
watan_orders = list(db['rushwash_sale_orders'].find({
    'lines.catalogCode': {'$in': ['DSC-00078', 'DSC-00079']},
    'createdAt': {'$gte': cmp_start}
}))
print(f"\nC. Total WATAN Campaign Orders: {len(watan_orders)}")

paid_watan_orders = [o for o in watan_orders if o.get('status') in ['paid', 'active', 'completed']]
print(f"   Paid/Active WATAN Signups: {len(paid_watan_orders)}")

print("\n=== 2. CHANNEL ANALYSIS: HOW MANY FROM CUSTOMER PORTAL? ===")

# Let's inspect fields in paid_watan_orders to see how portal vs POS is identified
channel_breakdown = {}
payment_methods = {}
created_by_types = {}

for o in paid_watan_orders:
    # Check origin/channel
    ch = o.get('channel') or o.get('origin') or (o.get('metadata') or {}).get('channel') or 'unspecified'
    
    # Check payment method
    pm = (o.get('payments') or [{}])[0].get('paymentMethodNameEn') or (o.get('payments') or [{}])[0].get('paymentMethodIdentityKey') or 'none'
    
    # Check createdById vs actor
    cb = str(o.get('createdById') or 'unknown')
    
    # Check lines
    has_pos_register = any(l.get('posRegisterId') for l in o.get('lines', []))
    pos_session = o.get('posSessionId')
    
    # Is it Customer Portal?
    # In RushWash: online orders from rush.com.sa have channel='portal' or paymentMethod='platform:payment_link' or posSessionId is None
    is_portal = False
    if ch in ['portal', 'customer_portal', 'web', 'online', 'website']:
        is_portal = True
    elif 'payment_link' in str(pm) or 'moyasar_link' in str(pm) or 'online' in str(pm):
        is_portal = True
    elif pos_session is None and not has_pos_register:
        is_portal = True
        
    tag = "Customer Portal (Web)" if is_portal else "POS Sales Lane (Branch)"
    channel_breakdown[tag] = channel_breakdown.get(tag, 0) + 1
    payment_methods[pm] = payment_methods.get(pm, 0) + 1

print("WATAN Paid Signups by Channel:")
for ch, cnt in channel_breakdown.items():
    print(f"   * {ch}: {cnt}")

print("\nPayment Method Identities:")
for pm, cnt in payment_methods.items():
    print(f"   * {pm}: {cnt}")

# Let's also check all orders (including abandoned checkouts)
print("\n--- ALL WATAN Orders (Paid + Abandoned + In-Progress) by Channel ---")
all_watan_channels = {}
for o in watan_orders:
    st = o.get('status')
    pm = (o.get('payments') or [{}])[0].get('paymentMethodIdentityKey') or ''
    pos_session = o.get('posSessionId')
    is_portal = pos_session is None or 'payment_link' in pm or o.get('channel') in ['portal', 'customer_portal', 'web']
    tag = "Customer Portal" if is_portal else "POS Sales Lane"
    all_watan_channels[f"{tag} - {st}"] = all_watan_channels.get(f"{tag} - {st}", 0) + 1

for k, v in sorted(all_watan_channels.items()):
    print(f"   * {k}: {v}")
