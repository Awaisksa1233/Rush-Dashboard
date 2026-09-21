import os
import sys
import json

backup_dir = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_json(name):
    fpath = os.path.join(backup_dir, f"{name}.json")
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

orders = load_json('rushwash_sale_orders')
subs = load_json('rushwash_subscriptions')

for code in ['ORD-25461', 'ORD-25464', 'ORD-27068', 'ORD-27190', 'ORD-27201']:
    o = next((x for x in orders if x.get('readableCode') == code), None)
    if not o:
        continue
    plate = (o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
    v_subs = [s for s in subs if any(plate == (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '').replace(' ', '').upper() for vl in s.get('vehicleLinks', []))]
    print(f"=== {code} ({plate}) ===")
    print("  Order date:", o.get('createdAt'), "Status:", o.get('status'), "isRenewal:", o.get('isRenewal'))
    print("  Lines:", [{'pkg': l.get('catalogCode'), 'name': l.get('displayNameEn')} for l in (o.get('lines') or [])])
    print("  Subscriptions found for this plate:", len(v_subs))
    for s in v_subs:
        print("    Sub:", s.get('readableCode'), "status:", s.get('status'), "created:", s.get('createdAt'), "renewal:", s.get('renewalDate'), "parent:", s.get('parentSubCode'))
