import os
import sys
import json
from datetime import datetime, timezone
from collections import defaultdict

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

paid_no_sub = []

for o in orders:
    odt = parse_dt(o.get('createdAt') or o.get('completedAt'))
    if not odt or odt < cutoff:
        continue
    lines = o.get('lines') or []
    spk_lines = [l for l in lines if str(l.get('catalogCode', '')).startswith('SPK-') or str(l.get('planReadableCode', '')).startswith('SPK-')]
    if not spk_lines:
        continue

    status = o.get('status')
    totalCaptured = o.get('totalCaptured') or 0
    payments = o.get('payments') or []
    paid_payments = [p for p in payments if p.get('status') == 'paid' and (p.get('amount', 0) > 0 or p.get('amount') is not None)]
    is_paid = (status in ['paid', 'completed']) or (totalCaptured > 0) or bool(paid_payments)
    
    if not is_paid:
        continue

    plate = (o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or 'UNKNOWN').replace(' ', '').upper()
    cid = get_oid(o.get('customerId'))
    
    matched_subs = subs_by_plate.get(plate, []) + subs_by_cid.get(cid, [])
    unique_subs = {s.get('readableCode'): s for s in matched_subs if s.get('readableCode')}
    
    created_subs = [s for s in unique_subs.values() if parse_dt(s.get('createdAt')) and parse_dt(s.get('createdAt')) >= odt - datetime.resolution]
    renewed_subs = [s for s in unique_subs.values() if parse_dt(s.get('renewalDate')) and parse_dt(s.get('renewalDate')) > odt]
    
    if not created_subs and not renewed_subs:
        paid_amt = 0
        if totalCaptured > 0:
            paid_amt = totalCaptured
        elif paid_payments:
            paid_amt = sum(p.get('amount', 0) for p in paid_payments)
        else:
            paid_amt = o.get('postDiscountTotal') or o.get('lineSubtotal') or 0
            
        cust = cust_by_id.get(cid) or o.get('customerSnapshot') or {}
        
        paid_no_sub.append({
            'orderId': o.get('readableCode'),
            'odt': odt,
            'time_str': odt.strftime('%Y-%m-%d %H:%M:%S'),
            'plate': plate,
            'status': status,
            'amount': paid_amt,
            'isRenewal': o.get('isRenewal'),
            'lines': [{'pkg': l.get('catalogCode'), 'name': l.get('displayNameEn'), 'price': l.get('price')} for l in spk_lines],
            'customer_name': cust.get('name') or '',
            'customer_phone': cust.get('phone') or '',
            'matched_subs_count': len(unique_subs),
            'matched_subs': [{'code': s.get('readableCode'), 'status': s.get('status'), 'created': str(s.get('createdAt')), 'renewal': str(s.get('renewalDate'))} for s in unique_subs.values()],
            'payments': [{'method': p.get('paymentMethodNameEn') or p.get('provider'), 'amt': p.get('amount'), 'status': p.get('status'), 'id': p.get('providerPaymentId')} for p in payments]
        })

paid_no_sub.sort(key=lambda x: x['odt'])

print(f"Total: {len(paid_no_sub)}")
print(f"{'#':<3} | {'Order ID':<10} | {'Plate':<10} | {'Date (UTC)':<19} | {'Amount':<10} | {'Status':<10} | {'Payment Method':<15} | {'Package':<30} | {'Customer Phone':<15}")
print("-" * 130)
for i, x in enumerate(paid_no_sub, 1):
    pkgs = ", ".join([l['pkg'] for l in x['lines']])
    pay_methods = ", ".join([p['method'] or 'Unknown' for p in x['payments'] if p['status'] in ['paid', 'completed', 'refunded']]) or 'N/A'
    print(f"{i:<3} | {x['orderId']:<10} | {x['plate']:<10} | {x['time_str']:<19} | SAR {x['amount']:<6} | {x['status']:<10} | {pay_methods:<15} | {pkgs:<30} | {x['customer_phone']:<15}")

