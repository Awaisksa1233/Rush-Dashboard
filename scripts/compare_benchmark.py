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

def inspect_plate(p_name):
    p_subs = [s for s in subs if any(p_name in (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '') for vl in s.get('vehicleLinks', []))]
    p_orders = [o for o in orders if p_name in (o.get('normalizedPlate') or '') or p_name in (o.get('vehicleSnapshot', {}).get('displayPlate') or '')]
    recent_orders = [o for o in p_orders if o.get('createdAt', {}).get('$date', '') >= '2026-08-22']
    
    print(f"\n=======================================================")
    print(f"PLATE: {p_name}")
    print(f"Total Subs: {len(p_subs)} | Orders >= Aug 22: {len(recent_orders)}")
    for o in recent_orders:
        print("  Order:", o.get('readableCode'), "Date:", o.get('createdAt'), "Status:", o.get('status'), "Amount:", o.get('totalCaptured'), "isRenewal:", o.get('isRenewal'))
        print("    Payments:", o.get('payments'))
        print("    Lines:", o.get('lines'))
    for s in p_subs:
        print("  Sub:", s.get('readableCode'), "Pkg:", s.get('packageNameEn'), "Created:", s.get('createdAt'), "Status:", s.get('status'), "Renewal:", s.get('renewalDate'), "Parent:", s.get('parentSubCode'), "Terminated:", s.get('terminatedAt'), s.get('terminatedReason'))

inspect_plate('9840XKR') # The benchmark (user said "like 9840XKR")
inspect_plate('3240XGD') # The user said "3240XGD is created"
inspect_plate('2103XXJ') # The user said "2103XXJ is created"
inspect_plate('8843HJS') # The user said "8843HJS has active sub"

