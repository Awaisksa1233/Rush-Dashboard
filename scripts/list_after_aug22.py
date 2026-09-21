import os
import sys
import json
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

cutoff = datetime(2026, 8, 22, 0, 0, 0, tzinfo=timezone.utc)

# Build sub maps
subs_by_plate = {}
for s in subs:
    for vl in s.get('vehicleLinks', []):
        plate = (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
        if plate:
            if plate not in subs_by_plate:
                subs_by_plate[plate] = []
            subs_by_plate[plate].append(s)

unique_flagged_orders = {}

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
        
    plate = o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or 'Unknown'
    clean_plate = plate.replace(' ', '').upper()
    
    v_subs = subs_by_plate.get(clean_plate, [])
    
    paid_amt = 0
    if totalCaptured > 0:
        paid_amt = totalCaptured
    elif paid_payments:
        paid_amt = sum(p.get('amount', 0) for p in paid_payments)
    else:
        paid_amt = o.get('postDiscountTotal') or o.get('lineSubtotal') or 0
        
    ocode = o.get('readableCode')
    
    # Check if a valid sub was created for this order
    created_subs = [s for s in v_subs if parse_dt(s.get('createdAt')) and parse_dt(s.get('createdAt')) >= o_dt]
    
    # Check if no sub or terminated like 9840XKR
    is_flagged = False
    flag_reason = ""
    
    if not created_subs and not is_renewal:
        is_flagged = True
        flag_reason = "Subscription not created"
    else:
        for s in created_subs:
            if s.get('status') == 'terminated' and s.get('terminatedReason') == 'parent_cancelled':
                is_flagged = True
                flag_reason = f"Terminated ({s.get('readableCode')})"
                break
                
    if is_flagged:
        unique_flagged_orders[ocode] = {
            "orderId": ocode,
            "plate": plate,
            "time": o_dt.strftime('%Y-%m-%d %H:%M:%S'),
            "amount": f"{paid_amt:.2f}" if isinstance(paid_amt, (int, float)) else str(paid_amt),
            "reason": flag_reason,
            "dt": o_dt
        }

print(f"Total Unique Flagged Orders: {len(unique_flagged_orders)}")
sorted_orders = sorted(unique_flagged_orders.values(), key=lambda x: x['dt'])

print("\nMarkdown Table Format:")
print("| Order ID | Plate | Time (UTC) | Amount (SAR) |")
print("|---|---|---|---|")
for it in sorted_orders:
    print(f"| `{it['orderId']}` | `{it['plate']}` | {it['time']} | SAR {it['amount']} |")

