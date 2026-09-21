import os
import sys
import json

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

sample_codes = ['ORD-27067', 'ORD-26455', 'ORD-26070']
for code in sample_codes:
    o = next((x for x in orders if x.get('readableCode') == code), None)
    print(f"=== {code} ===")
    print("status:", o.get('status'))
    print("lines:", o.get('lines'))
    print("payments:", o.get('payments'))

