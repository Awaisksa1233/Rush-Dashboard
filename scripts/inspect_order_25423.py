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
    if o.get('readableCode') == 'ORD-25423':
        print("=" * 80)
        print("SALE ORDER: ORD-25423")
        print("=" * 80)
        print(json.dumps(o, indent=2, default=str))

        print("\nPAYMENTS DETAIL:")
        for idx, p in enumerate(o.get('payments', []), 1):
            print(f"Payment #{idx}:")
            print(f"  Provider: {p.get('provider')}")
            print(f"  Method Name: {p.get('paymentMethodNameEn')}")
            print(f"  Amount: {p.get('amount')} SAR")
            print(f"  Status: {p.get('status')}")
            print(f"  Occurred At: {p.get('occurredAt')}")
            print(f"  Transaction ID: {p.get('transactionId')}")
            print(f"  Payment Identity Key: {p.get('paymentMethodIdentityKey')}")
            print(f"  Attempt: {p.get('attemptNumber')}")
            print(f"  Invoice ID: {p.get('invoiceId')}")
            print(f"  Moyasar ID / Ref: {p.get('gatewayReference', p.get('reference'))}")
            print(f"  Raw: {p}")
