import os
import sys
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

backup_dir = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def search_json(filename):
    path = os.path.join(backup_dir, filename)
    print(f"\n========================================================")
    print(f"SEARCHING IN: {filename}")
    print(f"========================================================")
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        docs = json.load(f)
    
    matches = []
    for doc in docs:
        doc_str = json.dumps(doc, ensure_ascii=False)
        if '5265' in doc_str:
            # Find where 5265 is
            fields_found = {}
            def recurse(obj, prefix=""):
                if isinstance(obj, dict):
                    for k, v in obj.items():
                        recurse(v, f"{prefix}.{k}" if prefix else k)
                elif isinstance(obj, list):
                    for idx, v in enumerate(obj):
                        recurse(v, f"{prefix}[{idx}]")
                else:
                    if '5265' in str(obj):
                        fields_found[prefix] = obj
            recurse(doc)
            matches.append((doc, fields_found))
            
    print(f"Found {len(matches)} matching documents in {filename}:")
    for doc, fields in matches[:10]:
        rc = doc.get('readableCode') or doc.get('_id')
        name = doc.get('name') or doc.get('customerSnapshot', {}).get('name') or doc.get('plateNumber') or ''
        print(f"  Doc: {rc} ({name})")
        for f, val in fields.items():
            print(f"    -> {f}: {val}")

for f in ['rushwash_customers.json', 'rushwash_subscriptions.json', 'rushwash_sale_orders.json', 'rushwash_vehicles.json']:
    search_json(f)
