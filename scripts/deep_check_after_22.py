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
subs_by_order_id = defaultdict(list)

for s in subs:
    cid = get_oid(s.get('customerId'))
    oid = get_oid(s.get('orderId')) or get_oid(s.get('saleOrderId'))
    if cid:
        subs_by_cid[cid].append(s)
    if oid:
        subs_by_order_id[oid].append(s)
    for vl in s.get('vehicleLinks', []):
        vid = get_oid(vl.get('vehicleId'))
        plate = (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
        if vid:
            subs_by_vid[vid].append(s)
        if plate:
            subs_by_plate[plate].append(s)

print(f"Total subscriptions in DB: {len(subs)}")

# Let's inspect all paid orders after 22 August
all_recent_paid_orders = []

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
    
    # Check if lines have packages
    if not sub_lines:
        continue
        
    vid = get_oid(o.get('vehicleId'))
    cid = get_oid(o.get('customerId'))
    plate = (o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
    
    v_subs = subs_by_vid.get(vid, []) + subs_by_plate.get(plate, [])
    c_subs = subs_by_cid.get(cid, [])
    
    paid_amt = 0
    if totalCaptured > 0:
        paid_amt = totalCaptured
    elif paid_payments:
        paid_amt = sum(p.get('amount', 0) for p in paid_payments)
    else:
        paid_amt = o.get('postDiscountTotal') or o.get('lineSubtotal') or 0
        
    # Unique sub codes
    v_sub_codes = list(set([s.get('readableCode') for s in v_subs]))
    c_sub_codes = list(set([s.get('readableCode') for s in c_subs]))
    
    # Subscriptions created AFTER this order date
    recent_created = [s for s in (v_subs + c_subs) if parse_dt(s.get('createdAt')) and parse_dt(s.get('createdAt')) >= o_dt]
    recent_created_codes = list(set([s.get('readableCode') for s in recent_created]))
    
    all_recent_paid_orders.append({
        "orderId": o.get('readableCode'),
        "plate": plate,
        "time": o_dt,
        "amount": paid_amt,
        "isRenewal": o.get('isRenewal'),
        "v_sub_count": len(v_sub_codes),
        "c_sub_count": len(c_sub_codes),
        "recent_created_count": len(recent_created_codes),
        "recent_created_codes": recent_created_codes,
        "v_sub_codes": v_sub_codes[:5]
    })

print(f"Total paid package orders >= Aug 22: {len(all_recent_paid_orders)}")

# Check breakdown of v_sub_count and recent_created_count
zero_v_subs = [it for it in all_recent_paid_orders if it['v_sub_count'] == 0]
zero_c_subs = [it for it in all_recent_paid_orders if it['c_sub_count'] == 0]
zero_recent_created = [it for it in all_recent_paid_orders if it['recent_created_count'] == 0]

print(f"Orders where vehicle has 0 subscriptions in entire DB: {len(zero_v_subs)}")
print(f"Orders where customer has 0 subscriptions in entire DB: {len(zero_c_subs)}")
print(f"Orders where NO subscription was created on/after order date: {len(zero_recent_created)}")

