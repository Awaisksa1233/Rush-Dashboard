import os
import sys
import json
from datetime import datetime, timezone
from collections import Counter, defaultdict
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

backup_dir = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_collection(name):
    for ext in ['.json', '.jsonl']:
        fpath = os.path.join(backup_dir, f"{name}{ext}")
        if os.path.exists(fpath):
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                try:
                    return json.loads(content)
                except Exception:
                    docs = []
                    for line in content.split('\n'):
                        line = line.strip()
                        if line:
                            try:
                                docs.append(json.loads(line))
                            except Exception:
                                pass
                    return docs
    return []

def parse_dt(val):
    if not val:
        return None
    if isinstance(val, dict):
        val = val.get('$date')
    if not val:
        return None
    try:
        if isinstance(val, (int, float)):
            return datetime.fromtimestamp(val / 1000.0, tz=timezone.utc)
        s = str(val).replace('Z', '+00:00')
        return datetime.fromisoformat(s)
    except Exception:
        return None

def get_oid(val):
    if not val:
        return None
    if isinstance(val, dict):
        return val.get('$oid') or str(val)
    return str(val)

subs = load_collection('rushwash_subscriptions')
orders = load_collection('rushwash_sale_orders')
customers = load_collection('rushwash_customers')
vehicles = load_collection('rushwash_vehicles')

start_dt = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)
end_dt = datetime(2026, 9, 7, 23, 59, 59, tzinfo=timezone.utc)

sub_by_code = {s.get('readableCode'): s for s in subs}
cust_by_id = {get_oid(c.get('_id')): c for c in customers}
cust_by_code = {c.get('readableCode'): c for c in customers}

# 1. Orders by sub code
renewal_orders = []
for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if odt and start_dt <= odt <= end_dt:
        if o.get('isRenewal') or o.get('subscriptionTransitionKind') == 'renewal':
            renewal_orders.append((o, odt))

sub_code_to_orders = defaultdict(list)
for o, odt in renewal_orders:
    sub_code = o.get('subscriptionReadableCode') or o.get('subCode')
    if sub_code:
        sub_code_to_orders[sub_code].append(o)

# 2. Identify due subs
cohort_1_codes = set()
for s in subs:
    rd = parse_dt(s.get('renewalDate'))
    if rd and start_dt <= rd <= end_dt:
        cohort_1_codes.add(s.get('readableCode'))

cohort_2_codes = set(sub_code_to_orders.keys())
all_due_sub_codes = cohort_1_codes.union(cohort_2_codes)

renewed = []
not_renewed = []

for code in all_due_sub_codes:
    s = sub_by_code.get(code)
    if not s:
        continue
    
    sub_orders = sub_code_to_orders.get(code, [])
    has_paid_renewal_order = False
    for o in sub_orders:
        if o.get('status') in ['paid', 'completed'] or any(p.get('status') == 'paid' for p in o.get('payments', [])):
            has_paid_renewal_order = True
            break
            
    rd = parse_dt(s.get('renewalDate'))
    date_advanced = (rd and rd > end_dt)
    
    if has_paid_renewal_order or (date_advanced and s.get('status') == 'active' and s.get('readableCode') in cohort_2_codes):
        renewed.append(s)
    else:
        not_renewed.append({
            'sub': s,
            'orders': sub_orders,
            'renewalDate': rd,
            'status': s.get('status'),
            'failureReason': s.get('lastRenewalFailureReason'),
            'autoRenew': s.get('autoRenew')
        })

print(f"Total Due: {len(all_due_sub_codes)} | Renewed: {len(renewed)} | Not Renewed: {len(not_renewed)}")

# Let's inspect the 101 ACTIVE subs that did NOT renew
active_not_renewed = [item for item in not_renewed if item['status'] == 'active']
print(f"\n--- Investigating the {len(active_not_renewed)} ACTIVE subs that did NOT renew ---")

active_failure_reasons = Counter(item['failureReason'] for item in active_not_renewed)
print("Failure reasons for active not renewed:")
for r, cnt in active_failure_reasons.most_common():
    print(f"  {r}: {cnt}")

active_autorenew = Counter(item['autoRenew'] for item in active_not_renewed)
print("Auto-renew flag for active not renewed:")
for ar, cnt in active_autorenew.items():
    print(f"  {ar}: {cnt}")

print("Sample 3 active not renewed:")
for it in active_not_renewed[:3]:
    s = it['sub']
    c_snap = s.get('customerSnapshot') or {}
    v_links = s.get('vehicleLinks') or []
    plate = v_links[0].get('snapshot', {}).get('displayPlate') if v_links else 'N/A'
    print(f"  Sub: {s.get('readableCode')} | Customer: {c_snap.get('name')} ({c_snap.get('phone')}) | Plate: {plate} | Plan: {s.get('packageNameEn')} | Price: SAR {s.get('price')} | RenewalDate: {it['renewalDate']} | Failure: {s.get('lastRenewalFailureReason')} | Orders: {len(it['orders'])}")

# Day-by-day distribution of renewal dates for not renewed
day_distribution = Counter()
for it in not_renewed:
    rd = it['renewalDate']
    if rd:
        day_distribution[rd.strftime('%Y-%m-%d')] += 1
    else:
        day_distribution['No renewalDate'] += 1

print("\n--- Day-by-Day Renewal Dates of NOT Renewed ---")
for d in sorted(day_distribution.keys()):
    print(f"  {d}: {day_distribution[d]} subscriptions")

# Let's check if the customers or vehicles of not_renewed subs made ANY other purchase/subscription
# Build plate and cust order index after Aug 22
orders_after_aug22 = []
for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if odt and odt >= start_dt:
        orders_after_aug22.append(o)

paid_orders_by_cust = defaultdict(list)
paid_orders_by_plate = defaultdict(list)
for o in orders_after_aug22:
    is_paid = (o.get('status') in ['paid', 'completed']) or any(p.get('status') == 'paid' for p in o.get('payments', []))
    if not is_paid:
        continue
    cid = get_oid(o.get('customerId'))
    if cid:
        paid_orders_by_cust[cid].append(o)
    plate = (o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
    if plate:
        paid_orders_by_plate[plate].append(o)

# Check how many not_renewed had subsequent paid orders (e.g. manual renewal / counter purchase)
manual_or_other_paid = 0
for it in not_renewed:
    s = it['sub']
    cid = get_oid(s.get('customerId'))
    plates = [(vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '').replace(' ', '').upper() for vl in s.get('vehicleLinks', [])]
    
    cust_has_paid = bool(paid_orders_by_cust.get(cid))
    plate_has_paid = any(bool(paid_orders_by_plate.get(p)) for p in plates if p)
    if cust_has_paid or plate_has_paid:
        manual_or_other_paid += 1

print(f"\nOf the {len(not_renewed)} not renewed subscriptions:")
print(f"  Customers/vehicles with AT LEAST ONE other paid order in this window: {manual_or_other_paid}")
print(f"  Completely unpaid/no orders at all: {len(not_renewed) - manual_or_other_paid}")
