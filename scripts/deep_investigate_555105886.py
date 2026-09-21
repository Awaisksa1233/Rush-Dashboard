import os
import sys
import json
from datetime import datetime
from collections import defaultdict

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKUP_DIR = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_json(name):
    fpath = os.path.join(BACKUP_DIR, f"{name}.json")
    if not os.path.exists(fpath):
        return []
    with open(fpath, 'r', encoding='utf-8') as f:
        return json.load(f)

def clean_phone(p):
    if not p:
        return ""
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"
    s = str(p)
    for i, d in enumerate(arabic_digits):
        s = s.replace(d, str(i))
    digits = ''.join(c for c in s if c.isdigit())
    if digits.startswith('966'):
        return digits[3:]
    if digits.startswith('0'):
        return digits[1:]
    return digits

def run():
    target = "555105886"
    print("=" * 80)
    print("      DEEP INVESTIGATION: CUSTOMER 0555105886 / +966555105886      ")
    print("=" * 80)

    customers = load_json('rushwash_customers')
    orders = load_json('rushwash_sale_orders')
    subs = load_json('rushwash_subscriptions')
    vehicles = load_json('rushwash_vehicles')
    refunds = load_json('rushwash_refund_requests')
    washes = load_json('rushwash_wash_histories')

    matched_cust = [c for c in customers if clean_phone(c.get('phone') or c.get('mobile')) == target]
    c_ids = set(str(c.get('_id', {}).get('$oid', c.get('_id'))) for c in matched_cust)

    print("\n1. CUSTOMER INFO:")
    for c in matched_cust:
        print(f"Name: {c.get('name')}")
        print(f"Phone: {c.get('phone')}")
        print(f"Email: {c.get('email')}")
        print(f"Code: {c.get('readableCode')} (ID: {c.get('_id')})")
        print(f"Status: {c.get('status')}")
        print(f"Created: {c.get('createdAt')}")
        print(f"Instruments: {json.dumps(c.get('moyasarPaymentInstruments'), indent=2, default=str)}")

    c_vehicles = [v for v in vehicles if str(v.get('customerId', {}).get('$oid', v.get('customerId'))) in c_ids or clean_phone((v.get('customerSnapshot') or {}).get('phone')) == target]
    v_plates = set(v.get('normalizedPlate') or v.get('displayPlate') for v in c_vehicles if (v.get('normalizedPlate') or v.get('displayPlate')))

    print(f"\n2. VEHICLES ({len(c_vehicles)}):")
    for v in c_vehicles:
        print(f"Plate: {v.get('displayPlate')} ({v.get('normalizedPlate')}) | Code: {v.get('readableCode')} | {v.get('make')} {v.get('model')} {v.get('year')}")

    # Subscriptions
    c_subs = [s for s in subs if str(s.get('customerId', {}).get('$oid', s.get('customerId'))) in c_ids or clean_phone((s.get('customerSnapshot') or {}).get('phone')) == target]
    c_subs.sort(key=lambda x: str(x.get('createdAt', '')))

    print(f"\n3. SUBSCRIPTIONS ({len(c_subs)}):")
    for s in c_subs:
        v_plates_sub = [vl.get('snapshot', {}).get('displayPlate') for vl in s.get('vehicleLinks', [])]
        print(f"Sub: {s.get('readableCode')} (Legacy: {s.get('legacyId')}) | Status: {s.get('status')} | Package: {s.get('packageNameEn')} | Price: {s.get('price')} SAR | Plate: {v_plates_sub}")
        print(f"  Created: {s.get('createdAt')} | Renewal: {s.get('renewalDate')}")

    # Orders
    matched_orders = []
    for o in orders:
        cid = str(o.get('customerId', {}).get('$oid', o.get('customerId')))
        phone = clean_phone((o.get('customerSnapshot') or {}).get('phone'))
        plate = o.get('normalizedPlate') or (o.get('vehicleSnapshot') or {}).get('normalizedPlate')
        if cid in c_ids or phone == target or (plate and plate in v_plates):
            matched_orders.append(o)

    matched_orders.sort(key=lambda x: str(x.get('createdAt', '')))

    print(f"\n4. ALL ORDERS & DETAILED PAYMENTS ({len(matched_orders)}):")
    for idx, o in enumerate(matched_orders, 1):
        print(f"\n--- Order #{idx}: {o.get('readableCode')} (Legacy: {o.get('legacyId')}) ---")
        print(f"Date: {o.get('createdAt')}")
        print(f"Plate: {o.get('normalizedPlate')}")
        print(f"Status: {o.get('status')}")
        print(f"isRenewal: {o.get('isRenewal')}")
        print(f"postDiscountTotal: {o.get('postDiscountTotal')} SAR")
        print(f"totalCaptured: {o.get('totalCaptured')} SAR")
        print(f"Lines:")
        for l in (o.get('lines') or o.get('lineSnapshots') or []):
            print(f"  - {l.get('displayNameEn', l.get('catalogCode'))} : {l.get('price')} SAR")
        print(f"Payments Array ({len(o.get('payments', []))} items):")
        for p_idx, p in enumerate(o.get('payments', []), 1):
            print(f"  Payment {p_idx}:")
            print(f"    Amount: {p.get('amount')} SAR")
            print(f"    Status: {p.get('status')}")
            print(f"    Provider: {p.get('provider')}")
            print(f"    Method: {p.get('paymentMethodNameEn')}")
            print(f"    Token: {p.get('paymentToken')}")
            print(f"    Transaction ID: {p.get('transactionId')}")
            print(f"    Provider Payment ID: {p.get('providerPaymentId')}")
            print(f"    Occurred At: {p.get('occurredAt')}")
            print(f"    Gateway Ref: {p.get('gatewayReference')}")

if __name__ == '__main__':
    run()
