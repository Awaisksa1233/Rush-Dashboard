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

# Let's inspect 2103XXJ
print("=== 2103XXJ ===")
for s in subs_by_plate.get('2103XXJ', []):
    print("  Sub:", s.get('readableCode'), s.get('createdAt'), s.get('packageNameEn'), s.get('status'))

# Find all paid orders >= Aug 22 where NO subscription record was created for that order
# Criteria:
# 1. Order createdAt >= Aug 22, 2026
# 2. Order is paid (status == 'paid', totalCaptured > 0, or payments paid)
# 3. Order is a subscription order (has lines with lineKind == 'package' or type == 'monthly_subscription' or isRenewal)
# 4. Check if a subscription record was created for this order:
#    - No sub created at/around the order time (within 1 day) for this vehicle/customer
#    - OR 0 subscriptions in the entire DB for this customer/vehicle

unrecorded_orders = []

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
    order_oid = get_oid(o.get('_id'))
    plate = o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or 'Unknown'
    clean_plate = plate.replace(' ', '').upper()
    
    paid_amt = 0
    if totalCaptured > 0:
        paid_amt = totalCaptured
    elif paid_payments:
        paid_amt = sum(p.get('amount', 0) for p in paid_payments)
    else:
        paid_amt = o.get('postDiscountTotal') or o.get('lineSubtotal') or 0
        
    # Check all subs for this vehicle/customer/order
    v_subs = subs_by_vid.get(vid, []) + subs_by_plate.get(clean_plate, [])
    c_subs = subs_by_cid.get(cid, [])
    o_subs = subs_by_order_id.get(order_oid, [])
    
    # All matching subs
    all_matched = {s.get('readableCode'): s for s in (v_subs + c_subs + o_subs)}
    
    # Check if a subscription was created on or around this order (within 3 days after order date)
    created_for_order = []
    for s in all_matched.values():
        s_dt = parse_dt(s.get('createdAt'))
        if s_dt and s_dt >= o_dt - datetime.resolution: # created at or after order
            diff_days = (s_dt - o_dt).total_seconds() / 86400.0
            if diff_days <= 3:
                created_for_order.append(s)
                
    # If isRenewal is True, does the renewal correspond to an existing active subscription whose renewalDate was extended?
    # Let's check:
    has_sub_record = False
    if len(created_for_order) > 0:
        has_sub_record = True
    elif is_renewal:
        # Check if customer/vehicle had an existing subscription active around that time
        active_around = [s for s in all_matched.values() if parse_dt(s.get('renewalDate')) and parse_dt(s.get('renewalDate')) >= o_dt]
        if active_around:
            has_sub_record = True
            
    if not has_sub_record:
        unrecorded_orders.append({
            "orderId": o.get('readableCode'),
            "plate": plate,
            "time": o_dt,
            "amount": paid_amt,
            "isRenewal": is_renewal,
            "matchedSubsCount": len(all_matched),
            "lines": [{'pkg': l.get('catalogCode'), 'name': l.get('displayNameEn'), 'price': l.get('price')} for l in sub_lines]
        })

print(f"\nTotal Unrecorded Orders (NO subscription record created for the purchase): {len(unrecorded_orders)}")
for it in sorted(unrecorded_orders, key=lambda x: str(x['time'])):
    print(f"Order: {it['orderId']} | Plate: {it['plate']} | Time: {it['time']} | Amount: SAR {it['amount']} | isRenewal: {it['isRenewal']}")
    print(f"  Lines: {it['lines']} | Matched Subs in DB: {it['matchedSubsCount']}")

