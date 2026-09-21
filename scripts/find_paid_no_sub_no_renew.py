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

cutoff = datetime(2026, 8, 22, 0, 0, 0, tzinfo=timezone.utc)

# Map all subscriptions by vehicle plate and customer ID
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

# Inspect all paid package orders >= Aug 22, 2026
paid_no_sub_created = []

for o in orders:
    o_dt = parse_dt(o.get('createdAt') or o.get('completedAt'))
    if not o_dt or o_dt < cutoff:
        continue
        
    status = o.get('status')
    totalCaptured = o.get('totalCaptured') or 0
    payments = o.get('payments') or []
    paid_payments = [p for p in payments if p.get('status') == 'paid' and (p.get('amount', 0) > 0 or p.get('amount') is not None)]
    
    is_paid = (status == 'paid') or (totalCaptured > 0) or bool(paid_payments)
    if not is_paid:
        continue
        
    lines = o.get('lines') or o.get('lineSnapshots') or []
    sub_lines = [l for l in lines if l.get('lineKind') == 'package' or l.get('type') == 'monthly_subscription']
    
    if not sub_lines:
        continue
        
    plate = o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or 'Unknown'
    clean_plate = plate.replace(' ', '').upper()
    cid = get_oid(o.get('customerId'))
    
    paid_amt = 0
    if totalCaptured > 0:
        paid_amt = totalCaptured
    elif paid_payments:
        paid_amt = sum(p.get('amount', 0) for p in paid_payments)
    else:
        paid_amt = o.get('postDiscountTotal') or o.get('lineSubtotal') or 0
        
    # Get all subscriptions for this vehicle / customer
    matched_subs = subs_by_plate.get(clean_plate, []) + subs_by_cid.get(cid, [])
    unique_subs = {s.get('readableCode'): s for s in matched_subs if s.get('readableCode')}
    
    # Check 1: Was a NEW subscription created for this order?
    new_sub_created = any(parse_dt(s.get('createdAt')) and parse_dt(s.get('createdAt')) >= o_dt - datetime.resolution for s in unique_subs.values())
    
    # Check 2: Was an existing subscription renewed with renewalDate > o_dt + 15 days?
    existing_sub_renewed = any(parse_dt(s.get('renewalDate')) and parse_dt(s.get('renewalDate')) > o_dt for s in unique_subs.values())
    
    # If NEITHER a new subscription was created NOR an existing subscription renewal date covers after the order date:
    if not new_sub_created and not existing_sub_renewed:
        paid_no_sub_created.append({
            "orderId": o.get('readableCode'),
            "plate": plate,
            "time": o_dt,
            "amount": paid_amt,
            "matchedSubs": len(unique_subs),
            "maxRenewalDate": max([str(s.get('renewalDate')) for s in unique_subs.values()]) if unique_subs else "None"
        })

print(f"Total Paid Orders after Aug 22 where NO subscription was created AND NO renewal date extended: {len(paid_no_sub_created)}")
for it in sorted(paid_no_sub_created, key=lambda x: str(x['time'])):
    print(f"Order: {it['orderId']} | Plate: {it['plate']} | Time: {it['time']} | Amount: SAR {it['amount']} | Max Renewal Date: {it['maxRenewalDate']}")

