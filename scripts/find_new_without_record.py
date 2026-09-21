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

# Group subscriptions created >= Aug 22 by plate
subs_created_after_22_by_plate = {}
for s in subs:
    s_dt = parse_dt(s.get('createdAt'))
    if s_dt and s_dt >= cutoff:
        for vl in s.get('vehicleLinks', []):
            plate = (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
            if plate:
                if plate not in subs_created_after_22_by_plate:
                    subs_created_after_22_by_plate[plate] = []
                subs_created_after_22_by_plate[plate].append(s)

# Find new paid subscription orders after Aug 22 where NO subscription document was created
uncreated_new_purchases = []

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
    
    # Only new subscription purchases (not renewals)
    if not sub_lines or is_renewal:
        continue
        
    plate = o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or 'Unknown'
    clean_plate = plate.replace(' ', '').upper()
    
    # Check if ANY subscription was created after order date for this plate
    recent_s = [s for s in subs_created_after_22_by_plate.get(clean_plate, []) if parse_dt(s.get('createdAt')) and parse_dt(s.get('createdAt')) >= o_dt]
    
    paid_amt = 0
    if totalCaptured > 0:
        paid_amt = totalCaptured
    elif paid_payments:
        paid_amt = sum(p.get('amount', 0) for p in paid_payments)
    else:
        paid_amt = o.get('postDiscountTotal') or o.get('lineSubtotal') or 0
        
    if len(recent_s) == 0:
        uncreated_new_purchases.append({
            "orderId": o.get('readableCode'),
            "plate": plate,
            "time": o_dt,
            "amount": paid_amt,
            "lines": [{'pkg': l.get('catalogCode'), 'name': l.get('displayNameEn'), 'price': l.get('price')} for l in sub_lines]
        })

print(f"Total New Paid Subscription Purchases After Aug 22 WITHOUT created subscription record: {len(uncreated_new_purchases)}")

# Output table
print("\n| Order ID | Plate | Time (UTC) | Amount |")
print("|---|---|---|---|")
for it in sorted(uncreated_new_purchases, key=lambda x: x['time']):
    time_str = it['time'].strftime('%Y-%m-%d %H:%M:%S')
    amt_str = f"SAR {it['amount']:.2f}" if isinstance(it['amount'], (int, float)) else f"SAR {it['amount']}"
    print(f"| `{it['orderId']}` | `{it['plate']}` | {time_str} | {amt_str} |")

