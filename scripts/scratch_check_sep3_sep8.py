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

sep3_dt = datetime(2026, 9, 3, 4, 0, 0, tzinfo=timezone.utc)

orders_sep3_sep8 = []
for o in orders:
    odt = parse_dt(o.get('createdAt') or o.get('completedAt'))
    if odt and odt >= sep3_dt:
        lines = o.get('lines') or []
        spk_lines = [l for l in lines if str(l.get('catalogCode', '')).startswith('SPK-') or str(l.get('planReadableCode', '')).startswith('SPK-')]
        if spk_lines:
            orders_sep3_sep8.append((o, odt, spk_lines))

print(f"Total orders with SPK- from Sep 3 to Sep 8: {len(orders_sep3_sep8)}")
status_map = {}
for o, odt, lines in orders_sep3_sep8:
    status_map[o.get('status')] = status_map.get(o.get('status'), 0) + 1
print("Status breakdown:", status_map)

# Check paid orders between Sep 3 and Sep 8
for o, odt, lines in orders_sep3_sep8:
    status = o.get('status')
    totalCaptured = o.get('totalCaptured') or 0
    payments = o.get('payments') or []
    paid_payments = [p for p in payments if p.get('status') == 'paid' and (p.get('amount', 0) > 0 or p.get('amount') is not None)]
    is_paid = (status in ['paid', 'completed']) or (totalCaptured > 0) or bool(paid_payments)
    
    if is_paid:
        plate = (o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
        # Find subs for this plate
        v_subs = [s for s in subs if any(plate == (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '').replace(' ', '').upper() for vl in s.get('vehicleLinks', []))]
        created_after = [s for s in v_subs if parse_dt(s.get('createdAt')) and parse_dt(s.get('createdAt')) >= odt - datetime.resolution]
        renewed_after = [s for s in v_subs if parse_dt(s.get('renewalDate')) and parse_dt(s.get('renewalDate')) > odt]
        
        if not created_after and not renewed_after:
            print(f"PAID WITHOUT SUB/RENEW: {o.get('readableCode')} | Plate: {plate} | Date: {odt} | Total: {totalCaptured} | Payments: {len(paid_payments)}")
            print(f"  Lines: {lines}")
            print(f"  V_subs: {[{'code': s.get('readableCode'), 'status': s.get('status'), 'created': s.get('createdAt'), 'renewal': s.get('renewalDate')} for s in v_subs]}")
