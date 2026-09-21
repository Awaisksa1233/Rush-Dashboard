import os
import sys
import json
from datetime import datetime, timezone
from collections import defaultdict

backup_dir = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_json(name):
    fpath = os.path.join(backup_dir, f"{name}.json")
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            return json.load(f)
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

orders = load_json('rushwash_sale_orders')
subs = load_json('rushwash_subscriptions')
customers = load_json('rushwash_customers')
cust_by_id = {get_oid(c.get('_id')): c for c in customers}

cutoff = datetime(2026, 8, 22, 0, 0, 0, tzinfo=timezone.utc)

subs_by_plate = defaultdict(list)
subs_by_cid = defaultdict(list)

for s in subs:
    cid = get_oid(s.get('customerId'))
    if cid:
        subs_by_cid[cid].append(s)
    for vl in s.get('vehicleLinks', []):
        plate = (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
        if plate:
            subs_by_plate[plate].append(s)

print(f"Total orders in DB: {len(orders)}")
print(f"Total subs in DB: {len(subs)}")

# Let's inspect all orders with SPK lines created >= Aug 22
orders_after_22_spk = []

for o in orders:
    odt = parse_dt(o.get('createdAt') or o.get('completedAt'))
    if not odt or odt < cutoff:
        continue
    lines = o.get('lines') or []
    spk_lines = [l for l in lines if str(l.get('catalogCode', '')).startswith('SPK-') or str(l.get('planReadableCode', '')).startswith('SPK-')]
    if not spk_lines:
        continue
    orders_after_22_spk.append((o, odt, spk_lines))

print(f"Orders with SPK- >= Aug 22: {len(orders_after_22_spk)}")

# Breakdown by status
status_counts = defaultdict(int)
for o, odt, lines in orders_after_22_spk:
    status_counts[o.get('status')] += 1
print("Status counts:", dict(status_counts))

# Check paid orders
paid_orders = []
unpaid_orders = []

for o, odt, lines in orders_after_22_spk:
    status = o.get('status')
    totalCaptured = o.get('totalCaptured') or 0
    payments = o.get('payments') or []
    paid_payments = [p for p in payments if p.get('status') == 'paid' and (p.get('amount', 0) > 0 or p.get('amount') is not None)]
    is_paid = (status in ['paid', 'completed']) or (totalCaptured > 0) or bool(paid_payments)
    
    plate = (o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or 'UNKNOWN').replace(' ', '').upper()
    cid = get_oid(o.get('customerId'))
    
    # Subscriptions for this plate / customer
    matched_subs = subs_by_plate.get(plate, []) + subs_by_cid.get(cid, [])
    # Unique
    unique_subs = {s.get('readableCode'): s for s in matched_subs if s.get('readableCode')}
    
    # Check if a subscription was created on or after order date
    created_subs = [s for s in unique_subs.values() if parse_dt(s.get('createdAt')) and parse_dt(s.get('createdAt')) >= odt - datetime.resolution]
    
    # Check if an existing sub was renewed (renewalDate extended to > odt)
    renewed_subs = [s for s in unique_subs.values() if parse_dt(s.get('renewalDate')) and parse_dt(s.get('renewalDate')) > odt]
    
    sub_created_or_renewed = bool(created_subs or renewed_subs)
    
    item = {
        'order': o,
        'odt': odt,
        'lines': lines,
        'plate': plate,
        'cid': cid,
        'is_paid': is_paid,
        'status': status,
        'totalCaptured': totalCaptured,
        'paid_payments': paid_payments,
        'sub_created_or_renewed': sub_created_or_renewed,
        'created_subs': created_subs,
        'renewed_subs': renewed_subs,
        'all_matched_subs': list(unique_subs.values())
    }
    
    if is_paid:
        paid_orders.append(item)
    else:
        unpaid_orders.append(item)

print(f"\nTotal Paid Orders with SPK: {len(paid_orders)}")
print(f"  Paid Orders WITH sub created/renewed: {len([x for x in paid_orders if x['sub_created_or_renewed']])}")
print(f"  Paid Orders WITHOUT sub created/renewed: {len([x for x in paid_orders if not x['sub_created_or_renewed']])}")

print(f"\nTotal Unpaid/Cancelled Orders with SPK: {len(unpaid_orders)}")
print(f"  Unpaid Orders WITHOUT sub created/renewed: {len([x for x in unpaid_orders if not x['sub_created_or_renewed']])}")
