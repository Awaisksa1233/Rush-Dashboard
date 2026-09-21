import os
import sys
import json
from collections import defaultdict
from datetime import datetime, timezone

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

def get_oid(val):
    if not val:
        return None
    if isinstance(val, dict):
        return val.get('$oid') or str(val)
    return str(val)

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

orders = load_collection('rushwash_sale_orders')
subs = load_collection('rushwash_subscriptions')
customers = load_collection('rushwash_customers')
vehicles = load_collection('rushwash_vehicles')

customer_by_id = {get_oid(c.get('_id')): c for c in customers if get_oid(c.get('_id'))}
vehicle_by_id = {get_oid(v.get('_id')): v for v in vehicles if get_oid(v.get('_id'))}

# Build index of subscriptions by vehicle
subs_by_vid = defaultdict(list)
subs_by_plate = defaultdict(list)
subs_by_cid = defaultdict(list)

for s in subs:
    cid = get_oid(s.get('customerId'))
    if cid:
        subs_by_cid[cid].append(s)
    for vl in s.get('vehicleLinks', []):
        vid = get_oid(vl.get('vehicleId'))
        plate = (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
        if vid:
            subs_by_vid[vid].append(s)
        if plate:
            subs_by_plate[plate].append(s)

# Identify all paid orders where:
# 1. No subscription created at all (Category A)
# 2. Subscription was created but immediately terminated/failed (Category B - exactly like 9840XKR)
# 3. Paid renewal order exists, but subscription was terminated/cancelled and customer has no active subscription (Category C)

category_b_like_9840xkr = []
for s in subs:
    if s.get('status') == 'terminated' and s.get('terminatedReason') == 'parent_cancelled':
        s_created = parse_dt(s.get('createdAt'))
        s_term = parse_dt(s.get('terminatedAt'))
        delta_sec = (s_term - s_created).total_seconds() if (s_created and s_term) else None
        
        c_oid = get_oid(s.get('customerId'))
        cust = customer_by_id.get(c_oid) or s.get('customerSnapshot')
        vl = s.get('vehicleLinks', [{}])[0]
        plate = (vl.get('snapshot', {}).get('displayPlate') or vl.get('snapshot', {}).get('normalizedPlate') or '').replace(' ', '').upper()
        
        # Match order
        matched_order = None
        for o in orders:
            o_dt = parse_dt(o.get('createdAt') or o.get('completedAt'))
            o_plate = (o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
            if o_plate == plate:
                if o_dt and s_created and abs((o_dt - s_created).total_seconds()) < 86400:
                    matched_order = o
                    break
        
        # If order was paid
        if matched_order and (matched_order.get('status') == 'paid' or (matched_order.get('totalCaptured') or 0) > 0 or any(p.get('status') == 'paid' for p in (matched_order.get('payments') or []))):
            category_b_like_9840xkr.append({
                "subCode": s.get('readableCode'),
                "parentSubCode": s.get('parentSubCode'),
                "package": s.get('packageNameEn'),
                "plate": plate,
                "customerName": cust.get('name') if cust else 'Unknown',
                "customerPhone": cust.get('phone') if cust else 'Unknown',
                "orderCode": matched_order.get('readableCode'),
                "orderDate": parse_dt(matched_order.get('createdAt')).strftime('%Y-%m-%d %H:%M:%S') if parse_dt(matched_order.get('createdAt')) else 'Unknown',
                "orderAmount": matched_order.get('totalCaptured') or sum(p.get('amount', 0) for p in (matched_order.get('payments') or []) if p.get('status') == 'paid'),
                "subCreated": s_created.strftime('%Y-%m-%d %H:%M:%S') if s_created else 'Unknown',
                "subTerminated": s_term.strftime('%Y-%m-%d %H:%M:%S') if s_term else 'Unknown',
                "deltaSec": delta_sec,
                "reason": s.get('terminatedReason')
            })

print(f"\n=======================================================")
print(f" CATEGORY B (Exactly Like 9840XKR): Paid Order, but Subscription Immediately Terminated ({len(category_b_like_9840xkr)} cases)")
print(f"=======================================================")
for idx, r in enumerate(sorted(category_b_like_9840xkr, key=lambda x: x['orderDate'], reverse=True), 1):
    print(f"{idx:2d}. Order: {r['orderCode']} | Date: {r['orderDate']} | Amount: SAR {r['orderAmount']}")
    print(f"    Customer: {r['customerName']} | Phone: {r['customerPhone']} | Plate: {r['plate']}")
    print(f"    Sub: {r['subCode']} ({r['package']}) -> Terminated after {r['deltaSec']:.1f}s | Reason: {r['reason']} (Parent: {r['parentSubCode']})")

