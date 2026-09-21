import os
import sys
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKUP_DIR = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_json(name):
    fpath = os.path.join(BACKUP_DIR, f"{name}.json")
    with open(fpath, 'r', encoding='utf-8') as f:
        return json.load(f)

orders = load_json('rushwash_sale_orders')
for o in orders:
    if o.get('readableCode') in ['ORD-25423', 'ORD-10807']:
        print(f"=== ORDER: {o.get('readableCode')} ===")
        print(f"Legacy ID: {o.get('legacyId')}")
        print(f"Payments:")
        for p in o.get('payments', []):
            print(p)
