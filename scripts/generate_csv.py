import os
import sys
import json
import csv
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
customer_by_id = {get_oid(c.get('_id')): c for c in customers if get_oid(c.get('_id'))}

cutoff = datetime(2026, 8, 22, 0, 0, 0, tzinfo=timezone.utc)

subs_by_plate = defaultdict(list)
for s in subs:
    for vl in s.get('vehicleLinks', []):
        plate = (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
        if plate:
            subs_by_plate[plate].append(s)

results = []

for o in orders:
    o_dt = parse_dt(o.get('createdAt') or o.get('completedAt'))
    if not o_dt or o_dt < cutoff:
        continue
        
    lines = o.get('lines') or o.get('lineSnapshots') or []
    sub_lines = [l for l in lines if l.get('lineKind') == 'package' or l.get('type') == 'monthly_subscription']
    if not sub_lines:
        continue
        
    plate = (o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or 'Unknown').replace(' ', '').upper()
    payments = o.get('payments') or []
    
    paid_moyasar = [p for p in payments if (p.get('status') == 'paid') and (p.get('provider') == 'moyasar' or 'moyasar' in str(p).lower() or p.get('providerPaymentId') or p.get('paymentToken'))]
    if not paid_moyasar:
        continue
        
    p_subs = subs_by_plate.get(plate, [])
    
    new_sub_created = any(parse_dt(s.get('createdAt')) and parse_dt(s.get('createdAt')) >= o_dt - datetime.resolution for s in p_subs)
    existing_renewed = any(parse_dt(s.get('renewalDate')) and parse_dt(s.get('renewalDate')) > o_dt for s in p_subs)
    
    if not new_sub_created and not existing_renewed:
        p_obj = paid_moyasar[0]
        cid = get_oid(o.get('customerId'))
        cust = customer_by_id.get(cid) or o.get('customerSnapshot') or {}
        
        results.append({
            "order_id": o.get('readableCode'),
            "plate": plate,
            "time_utc": o_dt.strftime('%Y-%m-%d %H:%M:%S'),
            "amount_sar": f"{p_obj.get('amount'):.2f}" if p_obj.get('amount') is not None else "0.00",
            "moyasar_status": p_obj.get('status'),
            "moyasar_payment_id": p_obj.get('providerPaymentId') or '',
            "payment_method": p_obj.get('paymentMethodNameEn') or p_obj.get('paymentMethodCode') or 'Moyasar',
            "package_details": " + ".join([l.get('displayNameEn') or l.get('catalogCode') or 'Package' for l in sub_lines]),
            "customer_name": cust.get('name') or '',
            "customer_phone": cust.get('phone') or ''
        })

# Sort by time
results.sort(key=lambda x: x['time_utc'])

csv_path = os.path.join(os.path.dirname(__file__), '..', 'paid_orders_without_subscription_after_aug22.csv')
fieldnames = [
    "order_id", "plate", "time_utc", "amount_sar",
    "moyasar_status", "moyasar_payment_id", "payment_method",
    "package_details", "customer_name", "customer_phone"
]

with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(results)

print(f"CSV successfully generated at: {csv_path}")

# Print CSV content to stdout
with open(csv_path, 'r', encoding='utf-8-sig') as f:
    print("\n--- CSV OUTPUT ---\n")
    print(f.read())
