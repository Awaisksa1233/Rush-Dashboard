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

orders = load_collection('rushwash_sale_orders')
subs = load_collection('rushwash_subscriptions')

target_orders = [
    'ORD-25776', 'ORD-25900', 'ORD-25912', 'ORD-25933', 'ORD-26096',
    'ORD-26099', 'ORD-26113', 'ORD-26144', 'ORD-26260', 'ORD-26262',
    'ORD-26280', 'ORD-26297', 'ORD-26330', 'ORD-26642', 'ORD-26646'
]

for ocode in target_orders:
    o = next((x for x in orders if x.get('readableCode') == ocode), None)
    plate = o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate')
    p_subs = [s for s in subs if any(plate in (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '') for vl in s.get('vehicleLinks', []))]
    print(f"\nOrder: {ocode} | Plate: {plate} | Status: {o.get('status')} | Date: {o.get('createdAt')}")
    print(f"  Captured: {o.get('totalCaptured')} | Payments: {[{'amt': p.get('amount'), 'status': p.get('status')} for p in (o.get('payments') or [])]}")
    print(f"  Lines: {[{'pkg': l.get('catalogCode'), 'name': l.get('displayNameEn')} for l in (o.get('lines') or [])]}")
    print(f"  Customer: {o.get('customerSnapshot')}")
    print(f"  Existing Subs in DB ({len(p_subs)}): {[{'code': s.get('readableCode'), 'status': s.get('status'), 'created': s.get('createdAt'), 'renewal': s.get('renewalDate')} for s in p_subs]}")

