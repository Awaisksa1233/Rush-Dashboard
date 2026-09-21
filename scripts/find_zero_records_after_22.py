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

# Build sub maps
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

print("Checking orders >= Aug 22 where ZERO subscription records exist in DB...")

zero_sub_orders_after_22 = []

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
    is_renewal = o.get('isRenewal', False)
    
    if not sub_lines and not is_renewal:
        continue
        
    vid = get_oid(o.get('vehicleId'))
    cid = get_oid(o.get('customerId'))
    plate = o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or 'Unknown'
    clean_plate = plate.replace(' ', '').upper()
    
    v_subs = subs_by_vid.get(vid, []) + subs_by_plate.get(clean_plate, [])
    c_subs = subs_by_cid.get(cid, [])
    
    paid_amt = 0
    if totalCaptured > 0:
        paid_amt = totalCaptured
    elif paid_payments:
        paid_amt = sum(p.get('amount', 0) for p in paid_payments)
    else:
        paid_amt = o.get('postDiscountTotal') or o.get('lineSubtotal') or 0
        
    # Check if this vehicle has ZERO subscription records in DB
    if len(v_subs) == 0:
        zero_sub_orders_after_22.append({
            "orderId": o.get('readableCode'),
            "plate": plate,
            "time": o_dt,
            "amount": paid_amt,
            "customerSubsCount": len(c_subs),
            "lines": [{'pkg': l.get('catalogCode'), 'name': l.get('displayNameEn'), 'price': l.get('price')} for l in sub_lines]
        })

print(f"\nOrders >= Aug 22 with ZERO subscription records for the vehicle: {len(zero_sub_orders_after_22)}")
for it in zero_sub_orders_after_22:
    print(f"Order: {it['orderId']} | Plate: {it['plate']} | Time: {it['time']} | Amount: SAR {it['amount']} | Lines: {it['lines']}")

