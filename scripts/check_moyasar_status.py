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

# Map all subscriptions by plate
subs_by_plate = {}
for s in subs:
    for vl in s.get('vehicleLinks', []):
        plate = (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
        if plate:
            if plate not in subs_by_plate:
                subs_by_plate[plate] = []
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
    
    # Sub created after order
    new_sub_created = any(parse_dt(s.get('createdAt')) and parse_dt(s.get('createdAt')) >= o_dt - datetime.resolution for s in p_subs)
    # Existing sub extended
    existing_renewed = any(parse_dt(s.get('renewalDate')) and parse_dt(s.get('renewalDate')) > o_dt for s in p_subs)
    
    if not new_sub_created and not existing_renewed:
        p_obj = paid_moyasar[0]
        results.append({
            "orderId": o.get('readableCode'),
            "plate": plate,
            "time": o_dt.strftime('%Y-%m-%d %H:%M:%S'),
            "amount": f"SAR {p_obj.get('amount'):.2f}" if p_obj.get('amount') is not None else "SAR 0.00",
            "moyasarStatus": p_obj.get('status'),
            "moyasarId": p_obj.get('providerPaymentId') or 'N/A',
            "paymentMethod": p_obj.get('paymentMethodNameEn') or p_obj.get('paymentMethodCode') or 'Moyasar',
            "dt": o_dt
        })

print(f"Total verified orders: {len(results)}")
print("\n| Order ID | Plate | Time (UTC) | Amount | Moyasar Status | Moyasar Payment ID | Payment Method |")
print("|---|---|---|---|---|---|---|")
for it in sorted(results, key=lambda x: x['dt']):
    print(f"| `{it['orderId']}` | `{it['plate']}` | {it['time']} | {it['amount']} | `{it['moyasarStatus']}` | `{it['moyasarId']}` | {it['paymentMethod']} |")

