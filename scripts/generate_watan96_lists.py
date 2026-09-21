import os
import sys
import json
import csv
from datetime import datetime, timezone

# Ensure utf-8 output
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import dns.resolver
import pymongo
from dotenv import load_dotenv

load_dotenv()

# Configure DNS for MongoDB SRV lookups on Windows
resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '1.1.1.1']
dns.resolver.default_resolver = resolver

mongo_uri = os.getenv('MONGODB_URI')
client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
db = client.get_database('rushwash')

workspace_dir = r"c:\Users\Rush\Documents\antigravity\gallant-volta"

print("1. Loading customers from live DB...")
customers = {}
cid_to_code = {}
for c in db['rushwash_customers'].find({}, {'readableCode': 1, 'name': 1, 'phone': 1, 'normalizedPhone': 1, 'status': 1, 'createdAt': 1}):
    code = c.get('readableCode')
    cid = str(c.get('_id'))
    if cid and code:
        cid_to_code[cid] = code
    if code:
        customers[code] = {
            'id': cid,
            'code': code,
            'name': (c.get('name') or '').strip(),
            'phone': (c.get('phone') or c.get('normalizedPhone') or '').strip(),
            'status': c.get('status', ''),
            'createdAt': c.get('createdAt')
        }

print(f"   Loaded {len(customers)} customers.")

print("2. Identifying customers who ever purchased a package/subscription...")
package_cust_codes = set()
for s in db['rushwash_subscriptions'].find({}, {'customerId': 1, 'customerCode': 1, 'customerSnapshot.readableCode': 1}):
    cid = str(s.get('customerId')) if s.get('customerId') else None
    cc = s.get('customerCode') or (s.get('customerSnapshot') or {}).get('readableCode')
    if cc:
        package_cust_codes.add(cc)
    if cid and cid in cid_to_code:
        package_cust_codes.add(cid_to_code[cid])

for o in db['rushwash_sale_orders'].find({'lines.lineKind': 'package', 'status': {'$in': ['paid', 'active', 'completed']}}, {'customerId': 1, 'customerCode': 1, 'customerSnapshot.readableCode': 1}):
    cid = str(o.get('customerId')) if o.get('customerId') else None
    cc = o.get('customerCode') or (o.get('customerSnapshot') or {}).get('readableCode')
    if cc:
        package_cust_codes.add(cc)
    if cid and cid in cid_to_code:
        package_cust_codes.add(cid_to_code[cid])

print(f"   Identified {len(package_cust_codes)} customers who have purchased a package before.")

print("3. Loading wash histories for visit stats...")
wash_count = {}
last_wash = {}

# Fast read from local latest backup jsonl
wash_jsonl = os.path.join(workspace_dir, 'database/atlas_backup/latest/rushwash/rushwash_wash_histories.jsonl')
if os.path.exists(wash_jsonl):
    with open(wash_jsonl, 'r', encoding='utf-8') as f:
        for line in f:
            doc = json.loads(line)
            c_snap = doc.get('customerSnapshot')
            cc = c_snap.get('readableCode') if isinstance(c_snap, dict) else None
            if not cc:
                cid = doc.get('customerId')
                oid = cid.get('$oid') if isinstance(cid, dict) else str(cid) if cid else None
                cc = cid_to_code.get(oid)
            if not cc:
                continue
            wash_count[cc] = wash_count.get(cc, 0) + 1
            wdt_val = doc.get('washDate') or doc.get('createdAt')
            if isinstance(wdt_val, dict) and '$date' in wdt_val:
                dt_str = str(wdt_val['$date']).replace('Z', '+00:00')
                try:
                    wdt = datetime.fromisoformat(dt_str)
                    if cc not in last_wash or wdt > last_wash[cc]:
                        last_wash[cc] = wdt
                except:
                    pass

print(f"   Loaded wash stats for {len(wash_count)} customers.")

print("4. Loading WATAN96 redemptions...")
redeemed_customers = {}
for r in db['rushwash_coupon_redemptions'].find({'couponReadableCode': 'DSC-00078'}):
    cc = r.get('customerCode')
    if cc:
        redeemed_customers[cc] = {
            'orderCode': r.get('orderCode'),
            'redeemedAt': r.get('redeemedAt')
        }

for o in db['rushwash_sale_orders'].find({'lines.catalogCode': 'DSC-00078', 'status': {'$in': ['paid', 'active', 'completed']}}):
    cc = (o.get('customerSnapshot') or {}).get('readableCode') or o.get('customerCode')
    if cc:
        redeemed_customers[cc] = {
            'orderCode': o.get('readableCode'),
            'orderStatus': o.get('status'),
            'totalCaptured': o.get('totalCaptured', 96),
            'redeemedAt': o.get('completedAt') or o.get('createdAt')
        }

print(f"   Found {len(redeemed_customers)} redeemed customers: {list(redeemed_customers.keys())}")

print("5. Loading POS evaluation / suggested audit events for CMP-00017...")
suggested_events = list(db['rushwash_audit_events'].find({'entityReadableCode': 'CMP-00017', 'eventType': 'crm.promotional.suggested'}))
suggested_custs = {}
for e in suggested_events:
    cc = (e.get('after') or {}).get('customerCode')
    dt = e.get('occurredAt')
    if cc and dt:
        suggested_custs.setdefault(cc, []).append(dt)

print(f"   Found {len(suggested_events)} suggestion events across {len(suggested_custs)} unique customers.")

now_ref = datetime.now(timezone.utc)

# -------------------------------------------------------------
# EXPORT 1: Redeemed Customers (3)
# -------------------------------------------------------------
redeemed_csv = os.path.join(workspace_dir, 'watan96_redeemed_customers.csv')
with open(redeemed_csv, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.writer(f)
    writer.writerow([
        'Customer Code',
        'Customer Name',
        'Phone Number',
        'Customer Status',
        'Order Code',
        'Order Status',
        'Total Paid (SAR)',
        'Redemption Date (UTC)',
        'Was Evaluated at POS'
    ])
    for cc, rinfo in redeemed_customers.items():
        cust = customers.get(cc, {})
        red_dt = rinfo.get('redeemedAt')
        red_dt_str = red_dt.strftime('%Y-%m-%d %H:%M:%S') if isinstance(red_dt, datetime) else str(red_dt)
        was_eval = 'Yes' if cc in suggested_custs else 'No'
        writer.writerow([
            cc,
            cust.get('name', ''),
            cust.get('phone', ''),
            cust.get('status', ''),
            rinfo.get('orderCode', ''),
            rinfo.get('orderStatus', 'paid'),
            rinfo.get('totalCaptured', 96),
            red_dt_str,
            was_eval
        ])
print(f"Generated {redeemed_csv} with {len(redeemed_customers)} rows.")

# -------------------------------------------------------------
# EXPORT 2: POS-Suggested Eligible Unredeemed Customers (High-Intent)
# -------------------------------------------------------------
unredeemed_suggested_codes = [cc for cc in sorted(suggested_custs.keys()) if cc not in redeemed_customers]
suggested_csv = os.path.join(workspace_dir, 'watan96_eligible_unredeemed_suggested.csv')
with open(suggested_csv, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.writer(f)
    writer.writerow([
        'Customer Code',
        'Customer Name',
        'Phone Number',
        'Customer Status',
        'Account Created At',
        'Total Washes',
        'Last Wash Date',
        'Days Since Last Wash',
        'POS Suggestion Count',
        'First POS Suggestion (UTC)',
        'Latest POS Suggestion (UTC)'
    ])
    for cc in unredeemed_suggested_codes:
        cust = customers.get(cc, {})
        s_times = sorted(suggested_custs[cc])
        first_s = s_times[0].strftime('%Y-%m-%d %H:%M:%S') if s_times else ''
        latest_s = s_times[-1].strftime('%Y-%m-%d %H:%M:%S') if s_times else ''
        s_count = len(s_times)
        lw = last_wash.get(cc)
        lw_str = lw.strftime('%Y-%m-%d %H:%M:%S') if lw else 'No wash recorded'
        days_ago = (now_ref - lw).days if lw else ''
        c_at = cust.get('createdAt')
        c_at_str = c_at.strftime('%Y-%m-%d %H:%M:%S') if isinstance(c_at, datetime) else ''
        t_washes = wash_count.get(cc, 0)
        writer.writerow([
            cc,
            cust.get('name', ''),
            cust.get('phone', ''),
            cust.get('status', ''),
            c_at_str,
            t_washes,
            lw_str,
            days_ago,
            s_count,
            first_s,
            latest_s
        ])
print(f"Generated {suggested_csv} with {len(unredeemed_suggested_codes)} rows.")

# -------------------------------------------------------------
# EXPORT 3: Full Database Eligible Unredeemed Customers (Never Purchased Package)
# -------------------------------------------------------------
# Note: When a customer redeems WATAN96, they enroll into a package. We exclude any who already redeemed.
all_eligible_codes = [cc for cc in customers.keys() if cc not in package_cust_codes and cc not in redeemed_customers]

# Sort by created date descending (newest first)
all_eligible_codes.sort(key=lambda cc: customers[cc].get('createdAt') or datetime.min, reverse=True)

full_eligible_csv = os.path.join(workspace_dir, 'watan96_eligible_unredeemed_all_customers.csv')
with open(full_eligible_csv, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.writer(f)
    writer.writerow([
        'Customer Code',
        'Customer Name',
        'Phone Number',
        'Customer Status',
        'Account Created At',
        'Total Washes',
        'Last Wash Date',
        'Days Since Last Wash',
        'Evaluated at POS Today'
    ])
    for cc in all_eligible_codes:
        cust = customers.get(cc, {})
        lw = last_wash.get(cc)
        lw_str = lw.strftime('%Y-%m-%d %H:%M:%S') if lw else 'No wash recorded'
        days_ago = (now_ref - lw).days if lw else ''
        c_at = cust.get('createdAt')
        c_at_str = c_at.strftime('%Y-%m-%d %H:%M:%S') if isinstance(c_at, datetime) else ''
        t_washes = wash_count.get(cc, 0)
        was_eval = 'Yes' if cc in suggested_custs else 'No'
        writer.writerow([
            cc,
            cust.get('name', ''),
            cust.get('phone', ''),
            cust.get('status', ''),
            c_at_str,
            t_washes,
            lw_str,
            days_ago,
            was_eval
        ])
print(f"Generated {full_eligible_csv} with {len(all_eligible_codes)} rows.")
