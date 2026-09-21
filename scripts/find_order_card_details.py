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
subs = load_json('rushwash_subscriptions')
customers = load_json('rushwash_customers')
payment_methods = load_json('rushwash_payment_methods')

print("--- PAYMENT METHODS IN DB ---")
for p in payment_methods:
    print(p)

print("\n--- ORDERS DETAILS ---")
for o in orders:
    if o.get('readableCode') in ['ORD-25423', 'ORD-10807']:
        print(f"\nOrder: {o.get('readableCode')}")
        print(f"  Legacy Order ID (legacyId): {o.get('legacyId')}")
        print(f"  Legacy Status: {o.get('legacyStatus')}")
        print(f"  Date: {o.get('createdAt')}")
        print(f"  Payments: {json.dumps(o.get('payments'), indent=4, default=str)}")

print("\n--- SUBSCRIPTIONS DETAILS FOR CUSTOMER ---")
for s in subs:
    c_snap = s.get('customerSnapshot', {})
    if '502766618' in str(c_snap.get('phone', '')) or s.get('readableCode') in ['SUB-33928', 'SUB-32417', 'SUB-26157', 'SUB-30196']:
        print(f"Sub: {s.get('readableCode')} | Plan: {s.get('packageNameEn')} | LegacyId: {s.get('legacyId')}")
        print(f"  Card / Payment Snapshot:", s.get('paymentMethodSnapshot'), s.get('cardSnapshot'), s.get('moyasarCard'))
        # Check all keys in sub
        for k, v in s.items():
            if 'card' in k.lower() or 'pay' in k.lower() or 'token' in k.lower() or 'mask' in k.lower():
                print(f"    {k}: {v}")
