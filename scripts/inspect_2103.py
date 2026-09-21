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

orders = load_collection('rushwash_sale_orders')
subs = load_collection('rushwash_subscriptions')

# Check 2103XXJ
o_2103 = [o for o in orders if '2103XXJ' in (o.get('normalizedPlate') or '') or '2103XXJ' in (o.get('vehicleSnapshot', {}).get('displayPlate') or '')]
s_2103 = [s for s in subs if any('2103XXJ' in (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '') for vl in s.get('vehicleLinks', []))]

print("=== 2103XXJ Orders ===")
for o in sorted(o_2103, key=lambda x: str(x.get('createdAt'))):
    print("Order:", o.get('readableCode'), o.get('createdAt'), o.get('status'), o.get('totalCaptured'), o.get('isRenewal'))
    print("  Payments:", o.get('payments'))
    print("  Lines:", o.get('lines'))

print("\n=== 2103XXJ Subs ===")
for s in sorted(s_2103, key=lambda x: str(x.get('createdAt'))):
    print("Sub:", s.get('readableCode'), s.get('createdAt'), s.get('status'), s.get('packageNameEn'), "renewalDate:", s.get('renewalDate'), "parent:", s.get('parentSubCode'), "legacyId:", s.get('legacyId'))

