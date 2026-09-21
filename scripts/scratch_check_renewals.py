import os
import sys
import json
from datetime import datetime, timezone

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

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

orders = load_json('rushwash_sale_orders')
subs = load_json('rushwash_subscriptions')

cutoff = datetime(2026, 8, 22, 0, 0, 0, tzinfo=timezone.utc)

renewal_orders_paid = []

for o in orders:
    odt = parse_dt(o.get('createdAt') or o.get('completedAt'))
    if not odt or odt < cutoff:
        continue
    if not o.get('isRenewal') and o.get('subscriptionTransitionKind') != 'renewal':
        continue
    status = o.get('status')
    totalCaptured = o.get('totalCaptured') or 0
    payments = o.get('payments') or []
    paid_payments = [p for p in payments if p.get('status') == 'paid' and (p.get('amount', 0) > 0 or p.get('amount') is not None)]
    is_paid = (status in ['paid', 'completed']) or (totalCaptured > 0) or bool(paid_payments)
    if not is_paid:
        continue
    
    plate = (o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
    sub_code = o.get('subscriptionReadableCode') or o.get('subCode')
    
    # find sub
    sub = next((s for s in subs if s.get('readableCode') == sub_code), None)
    if not sub:
        v_subs = [s for s in subs if any(plate == (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '').replace(' ', '').upper() for vl in s.get('vehicleLinks', []))]
        sub = v_subs[0] if v_subs else None
        
    renewal_dt = parse_dt(sub.get('renewalDate')) if sub else None
    
    if not renewal_dt or renewal_dt <= odt:
        renewal_orders_paid.append({
            'code': o.get('readableCode'),
            'plate': plate,
            'odt': odt,
            'sub_code': sub_code or (sub.get('readableCode') if sub else 'None'),
            'renewal_dt': renewal_dt,
            'amount': totalCaptured or (paid_payments[0].get('amount') if paid_payments else 0)
        })

print(f"Paid renewals where renewal date was NOT extended: {len(renewal_orders_paid)}")
for r in renewal_orders_paid:
    print(r)
