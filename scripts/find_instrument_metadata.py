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

subs = load_json('rushwash_subscriptions')
customers = load_json('rushwash_customers')
orders = load_json('rushwash_sale_orders')

tokens = [
    'token_tWB9FEARxaR9tRTVrFRupfneic',
    '1205219c-8c53-4e54-aace-e4634320582c',
    'token_yxjy54i5cd2FivAUNjXwjs8zXc',
    '8f04d3ea-bf5a-4821-a79e-97019a22a335',
    '33fd7644-522a-49a0-9b82-ef0ab63f30eb',
    '70269f80-88c4-460a-922f-1f2e94870ffe'
]

print("Searching subscriptions for instrument details...")
for s in subs:
    s_str = json.dumps(s, default=str)
    for t in tokens:
        if t in s_str:
            print(f"Match in Sub {s.get('readableCode')} (legacyId: {s.get('legacyId')}):")
            for k, v in s.items():
                if any(tok in str(v) for tok in tokens) or 'card' in k.lower() or 'instrument' in k.lower() or 'pay' in k.lower():
                    print(f"  {k}: {v}")

print("\nSearching customers for instrument details...")
for c in customers:
    c_str = json.dumps(c, default=str)
    for t in tokens:
        if t in c_str:
            print(f"Match in Customer {c.get('readableCode')} ({c.get('name')}, {c.get('phone')}):")
            for k, v in c.items():
                if any(tok in str(v) for tok in tokens) or 'card' in k.lower() or 'instrument' in k.lower() or 'pay' in k.lower():
                    print(f"  {k}: {v}")
