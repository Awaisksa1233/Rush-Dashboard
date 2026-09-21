import json
import os
import sys

target = 'M3QC4'

backup_dir = 'database/atlas_backup/latest/rushwash'
for fname in os.listdir(backup_dir):
    if fname.endswith('.json'):
        fpath = os.path.join(backup_dir, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()
                if target in content:
                    print(f"Found '{target}' in {fname}!")
                    # Find surrounding text
                    idx = content.find(target)
                    start = max(0, idx - 200)
                    end = min(len(content), idx + 200)
                    print(content[start:end])
        except Exception as e:
            pass

# Also print all instruments of CUS-00515
with open(os.path.join(backup_dir, 'rushwash_customers.json'), 'r', encoding='utf-8') as f:
    custs = json.load(f)
c515 = next((c for c in custs if c.get('readableCode') == 'CUS-00515'), None)
if c515:
    print("\n--- ALL INSTRUMENTS FOR CUS-00515 ---")
    print(json.dumps(c515.get('moyasarPaymentInstruments'), indent=2))
