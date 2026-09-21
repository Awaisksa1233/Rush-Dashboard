import os
import sys
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKUP_DIR = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_json(name):
    fpath = os.path.join(BACKUP_DIR, f"{name}.json")
    with open(fpath, 'r', encoding='utf-8') as f:
        return json.load(f)

orders = load_json('rushwash_sale_orders')
subs = load_json('rushwash_subscriptions')
washes = load_json('rushwash_wash_histories')
refunds = load_json('rushwash_refund_requests')
customers = load_json('rushwash_customers')
cust_map = {str(c.get('_id', {}).get('$oid', c.get('_id'))): c for c in customers}

print("=" * 80)
print("COMPREHENSIVE CHECK FOR ORDER: 10909")
print("=" * 80)

# Check 1: Order with legacyId == 10909
legacy_match = [o for o in orders if o.get('legacyId') == 10909]
print(f"\n1. Orders with legacyId == 10909: ({len(legacy_match)} found)")
for o in legacy_match:
    print(json.dumps(o, indent=2, default=str))

# Check 2: Order with readableCode == 'ORD-10909'
code_match = [o for o in orders if o.get('readableCode') == 'ORD-10909']
print(f"\n2. Orders with readableCode == 'ORD-10909': ({len(code_match)} found)")
for o in code_match:
    print(json.dumps(o, indent=2, default=str))

# Check 3: Check subscriptions referencing 10909
sub_match = [s for s in subs if s.get('legacyId') == 10909 or '10909' in str(s)]
print(f"\n3. Subscriptions matching 10909: ({len(sub_match)} found)")
for s in sub_match:
    print(f"Sub: {s.get('readableCode')} | Plan: {s.get('packageNameEn')} | Status: {s.get('status')} | Customer: {s.get('customerSnapshot', {}).get('name')}")

# Check 4: Check wash histories for legacy 10909 or ORD-10807 / ORD-10909
print(f"\n4. Wash Histories & Visits:")
for o in (legacy_match + code_match):
    plate = o.get('normalizedPlate')
    print(f"For Plate {plate} around order date {o.get('createdAt')}:")
    plate_washes = [w for w in washes if w.get('normalizedPlate') == plate or w.get('plateNumber') == plate]
    print(f"  Total washes logged for plate {plate}: {len(plate_washes)}")
    for w in plate_washes[:5]:
        print(f"    - Wash: {w.get('legacyId', w.get('readableCode'))} | Date: {w.get('washDate') or w.get('createdAt')} | Lane: {w.get('laneReadableCode')}")

# Check 5: Check refunds for both
print(f"\n5. Refund Records:")
for r in refunds:
    if r.get('saleOrderCode') in [o.get('readableCode') for o in (legacy_match + code_match)] or '10909' in str(r):
        print("Refund match:", r)
