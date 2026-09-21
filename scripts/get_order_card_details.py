import os
import sys
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKUP_DIR = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_json(name):
    fpath = os.path.join(BACKUP_DIR, f"{name}.json")
    if not os.path.exists(fpath):
        return []
    with open(fpath, 'r', encoding='utf-8') as f:
        return json.load(f)

orders = load_json('rushwash_sale_orders')
audits = load_json('rushwash_audit_events')
custs = load_json('rushwash_customers')
payments = load_json('rushwash_payment_methods')

target_codes = ['ORD-25423', 'ORD-10807', 'ORD-26188', 'ORD-24011', 'ORD-21156', 'ORD-14635']

print("=" * 80)
print("CARD DETAILS & LEGACY IDs FOR TARGET ORDERS")
print("=" * 80)

for o in orders:
    if o.get('readableCode') in target_codes:
        print(f"\nOrder: {o.get('readableCode')}")
        print(f"  Legacy ID (legacyId): {o.get('legacyId')}")
        print(f"  Legacy Order Code: {o.get('legacyOrderCode', o.get('legacyId'))}")
        print(f"  Date: {o.get('createdAt')}")
        print(f"  Plate: {o.get('normalizedPlate')}")
        print(f"  Payments Array:")
        for idx, p in enumerate(o.get('payments', []), 1):
            print(f"    Payment #{idx}:")
            print(f"      Amount: {p.get('amount')} SAR")
            print(f"      Provider: {p.get('provider')}")
            print(f"      Payment Token: {p.get('paymentToken')}")
            print(f"      Legacy Payment Link ID: {p.get('legacyPaymentLinkId')}")
            print(f"      Card / Payment Method Used: {p.get('paymentMethodUsed')}")
            print(f"      Provider Payment ID: {p.get('providerPaymentId')}")
            print(f"      Raw Payment: {p}")

# Search audit events for any card mask, last4, or moyasar details
print("\n" + "=" * 80)
print("AUDIT LOGS SEARCH FOR LAST 4 / CARD DETAILS:")
print("=" * 80)
for a in audits:
    data_str = json.dumps(a, default=str)
    if 'ORD-25423' in data_str or 'ORD-10807' in data_str or '25671' in data_str or '10807' in data_str or '33fd7644' in data_str or 'token_tWB9FEARxaR9tRTVrFRupfneic' in data_str:
        print("Audit Event:", a.get('action'), a.get('entityType'), a.get('createdAt'))
        print("  Summary:", data_str[:300])
