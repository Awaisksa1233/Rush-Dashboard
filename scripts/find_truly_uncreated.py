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

# Build sub maps for subscriptions created >= Aug 22, 2026
subs_after_22_by_plate = defaultdict(list)
subs_after_22_by_cid = defaultdict(list)
all_subs_by_plate = defaultdict(list)

for s in subs:
    s_dt = parse_dt(s.get('createdAt'))
    cid = get_oid(s.get('customerId'))
    for vl in s.get('vehicleLinks', []):
        plate = (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
        if plate:
            all_subs_by_plate[plate].append(s)
            if s_dt and s_dt >= cutoff:
                subs_after_22_by_plate[plate].append(s)
                if cid:
                    subs_after_22_by_cid[cid].append(s)

print(f"Total plates with subscriptions created >= Aug 22: {len(subs_after_22_by_plate)}")

# Find all paid orders >= Aug 22 that do NOT have any subscription created >= Aug 22
# Exclude renewals of existing active subscriptions (where isRenewal == True and active sub existed)
truly_uncreated = []

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
        
    # Check if a subscription was created for this vehicle after Aug 22
    s_recent = subs_after_22_by_plate.get(clean_plate, [])
    s_all = all_subs_by_plate.get(clean_plate, [])
    
    # If NO subscription was created after Aug 22:
    if len(s_recent) == 0:
        # Is this an existing subscription renewal?
        # If it was an existing subscription renewal, the customer had an active sub from before Aug 22
        existing_active = [s for s in s_all if s.get('status') == 'active']
        
        # If the customer had NO active subscription or it was a NEW package purchase with NO record created:
        truly_uncreated.append({
            "orderId": o.get('readableCode'),
            "plate": plate,
            "clean_plate": clean_plate,
            "time": o_dt,
            "amount": paid_amt,
            "isRenewal": is_renewal,
            "hasExistingActiveSub": len(existing_active) > 0,
            "existingSubsCount": len(s_all),
            "lines": [{'pkg': l.get('catalogCode'), 'name': l.get('displayNameEn'), 'price': l.get('price')} for l in sub_lines]
        })

print(f"\nOrders with NO subscription created after Aug 22: {len(truly_uncreated)}")

# Filter out orders that belong to vehicles with existing active subscriptions (like 8843HJS, 2103XXJ)
no_record_orders = [it for it in truly_uncreated if not it['hasExistingActiveSub']]
print(f"Orders where vehicle has NO existing active sub AND NO sub created: {len(no_record_orders)}")

for it in sorted(no_record_orders, key=lambda x: str(x['time'])):
    print(f"Order: {it['orderId']} | Plate: {it['plate']} | Time: {it['time']} | Amount: SAR {it['amount']} | Exists in DB: {it['existingSubsCount']}")

