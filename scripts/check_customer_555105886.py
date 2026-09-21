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
    # Map arabic numerals if any
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
    target = "555105886" # from ٥٥٥١٠٥٨٨٦
    print("=" * 80)
    print(f"      INVESTIGATION FOR CUSTOMER: 0555105886 / +966555105886      ")
    print("=" * 80)

    customers = load_json('rushwash_customers')
    orders = load_json('rushwash_sale_orders')
    subs = load_json('rushwash_subscriptions')
    vehicles = load_json('rushwash_vehicles')
    refunds = load_json('rushwash_refund_requests')
    washes = load_json('rushwash_wash_histories')

    matched_cust = [c for c in customers if clean_phone(c.get('phone') or c.get('mobile')) == target]
    c_ids = set(str(c.get('_id', {}).get('$oid', c.get('_id'))) for c in matched_cust)
    c_codes = set(c.get('readableCode') for c in matched_cust if c.get('readableCode'))

    print(f"\n1. Customer Profiles Found: {len(matched_cust)}")
    for c in matched_cust:
        print(f"  - Customer: {c.get('name')} | Code: {c.get('readableCode')} | ID: {c.get('_id')} | Phone: {c.get('phone')} | Status: {c.get('status')}")
        print(f"    Email: {c.get('email')} | Created: {c.get('createdAt')}")
        if c.get('moyasarPaymentInstruments'):
            print(f"    Saved Cards (Instruments): {json.dumps(c.get('moyasarPaymentInstruments'), default=str)}")

    # Linked vehicles
    c_vehicles = [v for v in vehicles if str(v.get('customerId', {}).get('$oid', v.get('customerId'))) in c_ids or clean_phone((v.get('customerSnapshot') or {}).get('phone')) == target]
    v_plates = set(v.get('normalizedPlate') or v.get('displayPlate') for v in c_vehicles if (v.get('normalizedPlate') or v.get('displayPlate')))

    print(f"\n2. Registered Vehicles: {len(c_vehicles)}")
    for v in c_vehicles:
        print(f"  - Plate: {v.get('displayPlate')} ({v.get('normalizedPlate')}) | Code: {v.get('readableCode')} | Model: {v.get('make')} {v.get('model')} {v.get('year')}")

    # Subscriptions
    c_subs = [s for s in subs if str(s.get('customerId', {}).get('$oid', s.get('customerId'))) in c_ids or clean_phone((s.get('customerSnapshot') or {}).get('phone')) == target]
    c_subs.sort(key=lambda x: str(x.get('createdAt', '')))

    print(f"\n3. Subscriptions ({len(c_subs)} total):")
    for s in c_subs:
        v_plates_sub = [vl.get('snapshot', {}).get('displayPlate') for vl in s.get('vehicleLinks', [])]
        print(f"  - Sub: {s.get('readableCode')} (Legacy: {s.get('legacyId')}) | Status: {s.get('status')} | Plan: {s.get('packageNameEn')} | Price: {s.get('price')} SAR")
        print(f"    Plate: {v_plates_sub} | Created: {s.get('createdAt')} | RenewalDate: {s.get('renewalDate')}")
        if s.get('paymentMethodUsed') or s.get('moyasarPaymentInstrument'):
            print(f"    Payment Method / Card: {s.get('paymentMethodUsed')} | {s.get('moyasarPaymentInstrument')}")

    # Orders
    matched_orders = []
    for o in orders:
        cid = str(o.get('customerId', {}).get('$oid', o.get('customerId')))
        phone = clean_phone((o.get('customerSnapshot') or {}).get('phone'))
        plate = o.get('normalizedPlate') or (o.get('vehicleSnapshot') or {}).get('normalizedPlate')
        
        if cid in c_ids or phone == target or (plate and plate in v_plates):
            matched_orders.append(o)

    matched_orders.sort(key=lambda x: str(x.get('createdAt', '')))

    print(f"\n4. Orders & Payments ({len(matched_orders)} total):")
    paid_statuses = {'paid', 'completed', 'success'}
    for idx, o in enumerate(matched_orders, 1):
        lines = ", ".join([f"{l.get('displayNameEn', l.get('catalogCode'))} ({l.get('price')} SAR)" for l in (o.get('lines') or o.get('lineSnapshots') or [])])
        created = o.get('createdAt', {}).get('$date') if isinstance(o.get('createdAt'), dict) else str(o.get('createdAt'))
        
        print(f"\n  [{idx}] Order: {o.get('readableCode')} (Legacy: {o.get('legacyId')}) | Date: {created} | Status: {o.get('status')}")
        print(f"      Plate: {o.get('normalizedPlate')} | Total: {o.get('postDiscountTotal')} SAR | Captured: {o.get('totalCaptured')} SAR | isRenewal: {o.get('isRenewal')}")
        print(f"      Items: {lines}")
        print(f"      Payments ({len(o.get('payments', []))}):")
        for p in o.get('payments', []):
            p_dt = p.get('occurredAt', {}).get('$date') if isinstance(p.get('occurredAt'), dict) else str(p.get('occurredAt'))
            print(f"        - {p.get('paymentMethodNameEn', p.get('provider'))} | Status: {p.get('status')} | Amount: {p.get('amount')} SAR | Token: {p.get('paymentToken')} | Date: {p_dt}")

    # Check for duplicate payments in orders
    print("\n" + "=" * 80)
    print("5. DOUBLE DEDUCTION / MULTI-PAYMENT AUDIT:")
    print("=" * 80)
    
    double_captured_orders = [o for o in matched_orders if (o.get('totalCaptured') or 0) > (o.get('postDiscountTotal') or 0)]
    multi_paid_payments = [o for o in matched_orders if sum(1 for p in o.get('payments', []) if p.get('status') in paid_statuses) > 1]
    
    print(f"Orders where totalCaptured > postDiscountTotal: {len(double_captured_orders)}")
    for o in double_captured_orders:
        print(f"  🚨 DOUBLE CAPTURE on Order {o.get('readableCode')} (Legacy: {o.get('legacyId')}): Expected {o.get('postDiscountTotal')} SAR, Captured {o.get('totalCaptured')} SAR")

    print(f"Orders with multiple successful payments in payments array: {len(multi_paid_payments)}")
    for o in multi_paid_payments:
        print(f"  🚨 MULTIPLE PAID ATTEMPTS on Order {o.get('readableCode')}: {len(o.get('payments'))} payments")

    # Check close-proximity paid orders (< 30 days)
    paid_orders = [o for o in matched_orders if o.get('status') in paid_statuses or any(p.get('status') in paid_statuses for p in o.get('payments', []))]
    print(f"\nTotal Paid Orders: {len(paid_orders)}")
    for i in range(len(paid_orders)):
        for j in range(i+1, len(paid_orders)):
            o1, o2 = paid_orders[i], paid_orders[j]
            d1 = str(o1.get('createdAt', {}).get('$date', o1.get('createdAt')))[:19]
            d2 = str(o2.get('createdAt', {}).get('$date', o2.get('createdAt')))[:19]
            try:
                dt1 = datetime.fromisoformat(d1.replace('Z', ''))
                dt2 = datetime.fromisoformat(d2.replace('Z', ''))
                delta = (dt2 - dt1).total_seconds() / 86400.0
                if 0 < delta <= 30.0:
                    print(f"  ⚠️ Close Proximity Orders on Plate {o1.get('normalizedPlate')}:")
                    print(f"     Order 1: {o1.get('readableCode')} @ {d1} ({o1.get('postDiscountTotal')} SAR)")
                    print(f"     Order 2: {o2.get('readableCode')} @ {d2} ({o2.get('postDiscountTotal')} SAR)")
                    print(f"     Gap: {delta:.2f} days")
            except:
                pass

    # Washes summary
    cust_washes = [w for w in washes if str(w.get('customerId', {}).get('$oid', w.get('customerId'))) in c_ids or (w.get('normalizedPlate') and w.get('normalizedPlate') in v_plates)]
    print(f"\n6. Total Washes Logged: {len(cust_washes)}")
    for w in sorted(cust_washes, key=lambda x: str(x.get('createdAt', '')))[-5:]:
        print(f"  - Wash Date: {w.get('washDate') or w.get('createdAt')} | Plate: {w.get('normalizedPlate')} | Lane: {w.get('laneReadableCode')}")

if __name__ == '__main__':
    run()
