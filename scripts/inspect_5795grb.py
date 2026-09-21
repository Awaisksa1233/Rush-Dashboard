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

p_subs = [s for s in subs if any('5795GRB' in (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '') for vl in s.get('vehicleLinks', []))]
o = next((x for x in orders if x.get('readableCode') == 'ORD-26892'), None)
print("ORD-26892:", o.get('readableCode'), o.get('createdAt'), o.get('status'), o.get('totalCaptured'))
print("Payments:", o.get('payments'))
print("Lines:", o.get('lines'))
print("Subs in DB:", [{'code': s.get('readableCode'), 'pkg': s.get('packageNameEn'), 'status': s.get('status'), 'created': s.get('createdAt'), 'renewal': s.get('renewalDate')} for s in p_subs])

