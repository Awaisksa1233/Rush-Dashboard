import os
import sys
import json
from datetime import datetime, timezone
from collections import Counter, defaultdict

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

packages = load_collection('rushwash_service_packages')
services = load_collection('rushwash_services')
subs = load_collection('rushwash_subscriptions')

print("=== PACKAGES ===")
for p in packages:
    print(p.get('readableCode'), '|', p.get('nameEn'), '|', p.get('nameAr'), '| Price:', p.get('price'))

print("\n=== SERVICES ===")
for s in services:
    print(s.get('readableCode'), '|', s.get('nameEn'), '|', s.get('equipmentKind'), '|', s.get('category'))

# Check all package names across subscriptions
sub_packages = Counter(s.get('packageNameEn') for s in subs)
print("\n=== SUBSCRIPTION PACKAGE NAMES (ALL) ===")
for name, cnt in sub_packages.most_common():
    print(f"  {name}: {cnt}")
