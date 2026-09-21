import os
import sys
import glob
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKUP_DIR = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest')

targets = [
    '1205219c-8c53-4e54-aace-e4634320582c',
    'token_tWB9FEARxaR9tRTVrFRupfneic',
    '33fd7644-522a-49a0-9b82-ef0ab63f30eb',
    '70269f80-88c4-460a-922f-1f2e94870ffe',
    '93b4af85-50af-4af2-b2f4-b80aebac5f86',
    '9193',
    '3698',
    '502ZHV',
    '5355XHD',
    '502766618'
]

print("Searching across all collections for card details and tokens...")

for fpath in glob.glob(os.path.join(BACKUP_DIR, '**', '*.json'), recursive=True):
    if fpath.endswith('.metadata.json') or 'manifest.json' in fpath:
        continue
    fname = os.path.basename(fpath)
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for t in targets:
        if t in content:
            print(f"Found target '{t}' in {fname}!")
            # If smaller file or specific match, inspect
            try:
                data = json.loads(content)
                if isinstance(data, list):
                    for item in data:
                        item_str = json.dumps(item, default=str)
                        if t in item_str and ('card' in item_str.lower() or 'mask' in item_str.lower() or 'last4' in item_str.lower() or 'source' in item_str.lower()):
                            print(f"  Match detail in {fname}:", item_str[:300])
            except Exception:
                pass
