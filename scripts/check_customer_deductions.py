import os
import sys
import json
from datetime import datetime

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
    digits = ''.join(c for c in str(p) if c.isdigit())
    if digits.startswith('966'):
        return digits[3:]
    if digits.startswith('0'):
        return digits[1:]
    return digits

def run():
    target_raw = "966502766618"
    target_clean = clean_phone(target_raw) # '502766618'

    print("=" * 80)
    print(f"      INVESTIGATION FOR CUSTOMER PHONE: {target_raw} ({target_clean})      ")
    print("=" * 80)

    customers = load_json('rushwash_customers')
    orders = load_json('rushwash_sale_orders')
    subs = load_json('rushwash_subscriptions')
    vehicles = load_json('rushwash_vehicles')
    refunds = load_json('rushwash_refund_requests')
    washes = load_json('rushwash_wash_histories')
    wallet_txs = load_json('rushwash_wallet_transactions')
    audits = load_json('rushwash_audit_events')

    # Find customer record(s)
    matched_customers = []
    matched_cust_ids = set()
    for c in customers:
        p = clean_phone(c.get('phone') or c.get('mobile'))
        if target_clean in p or p in target_clean:
            matched_customers.append(c)
            oid = c.get('_id', {}).get('$oid') if isinstance(c.get('_id'), dict) else str(c.get('_id'))
            matched_cust_ids.add(oid)

    print(f"Matched Customer Profiles: {len(matched_customers)}")
    for c in matched_customers:
        print(f"  - Customer ID: {c.get('_id')} | Code: {c.get('readableCode')} | Name: {c.get('name')} | Phone: {c.get('phone')} | Created: {c.get('createdAt')}")

    # Find all vehicles linked to customer
    cust_vehicles = []
    cust_plates = set()
    for v in vehicles:
        c_id = v.get('customerId', {}).get('$oid') if isinstance(v.get('customerId'), dict) else str(v.get('customerId'))
        if c_id in matched_cust_ids or clean_phone(v.get('customerSnapshot', {}).get('phone')) == target_clean:
            cust_vehicles.append(v)
            plate = v.get('normalizedPlate') or v.get('displayPlate')
            if plate:
                cust_plates.add(plate)

    print(f"\nLinked Vehicles: {len(cust_vehicles)}")
    for v in cust_vehicles:
        print(f"  - Vehicle: {v.get('readableCode')} | Plate: {v.get('displayPlate')} / {v.get('normalizedPlate')} | Make/Model: {v.get('make')} {v.get('model')} ({v.get('color')})")

    # Find all orders linked to customer or vehicles or matching phone
    matched_orders = []
    for o in orders:
        c_id = o.get('customerId', {}).get('$oid') if isinstance(o.get('customerId'), dict) else str(o.get('customerId'))
        o_phone = clean_phone((o.get('customerSnapshot') or {}).get('phone'))
        o_plate = o.get('normalizedPlate') or (o.get('vehicleSnapshot') or {}).get('normalizedPlate')
        
        if c_id in matched_cust_ids or o_phone == target_clean or (o_plate and o_plate in cust_plates):
            matched_orders.append(o)

    matched_orders.sort(key=lambda x: str(x.get('createdAt', '')))

    print(f"\n" + "=" * 80)
    print(f"TOTAL ORDERS FOUND FOR CUSTOMER: {len(matched_orders)}")
    print("=" * 80)

    for idx, o in enumerate(matched_orders, 1):
        lines_desc = ", ".join([f"{l.get('displayNameEn', l.get('catalogCode'))} ({l.get('price')} SAR)" for l in (o.get('lines') or o.get('lineSnapshots') or [])])
        created = o.get('createdAt', {}).get('$date') if isinstance(o.get('createdAt'), dict) else str(o.get('createdAt'))
        updated = o.get('updatedAt', {}).get('$date') if isinstance(o.get('updatedAt'), dict) else str(o.get('updatedAt'))
        
        print(f"\n[{idx}] ORDER: {o.get('readableCode')} | Status: {o.get('status')} | isRenewal: {o.get('isRenewal')}")
        print(f"    Date: {created} (Updated: {updated})")
        print(f"    Plate: {o.get('normalizedPlate')} | Customer: {(o.get('customerSnapshot') or {}).get('name')}")
        print(f"    Total: {o.get('postDiscountTotal')} SAR (Pre-discount: {o.get('preDiscountSubtotal')} SAR)")
        print(f"    Lines: {lines_desc}")
        print(f"    Payments ({len(o.get('payments', []))}):")
        for p in o.get('payments', []):
            p_dt = p.get('occurredAt', {}).get('$date') if isinstance(p.get('occurredAt'), dict) else str(p.get('occurredAt'))
            print(f"      - Method: {p.get('paymentMethodNameEn', p.get('provider'))} | Status: {p.get('status')} | Amount: {p.get('amount')} SAR | Transaction: {p.get('transactionId', p.get('paymentMethodIdentityKey'))} | Date: {p_dt}")

    # Find subscriptions
    matched_subs = []
    for s in subs:
        c_id = s.get('customerId', {}).get('$oid') if isinstance(s.get('customerId'), dict) else str(s.get('customerId'))
        s_phone = clean_phone((s.get('customerSnapshot') or {}).get('phone'))
        if c_id in matched_cust_ids or s_phone == target_clean:
            matched_subs.append(s)

    matched_subs.sort(key=lambda x: str(x.get('createdAt', '')))
    print(f"\n" + "=" * 80)
    print(f"TOTAL SUBSCRIPTIONS FOUND: {len(matched_subs)}")
    print("=" * 80)
    for s in matched_subs:
        c_dt = s.get('createdAt', {}).get('$date') if isinstance(s.get('createdAt'), dict) else str(s.get('createdAt'))
        r_dt = s.get('renewalDate', {}).get('$date') if isinstance(s.get('renewalDate'), dict) else str(s.get('renewalDate'))
        u_dt = s.get('updatedAt', {}).get('$date') if isinstance(s.get('updatedAt'), dict) else str(s.get('updatedAt'))
        v_plates = [vl.get('snapshot', {}).get('displayPlate') for vl in s.get('vehicleLinks', [])]
        print(f"  - Sub: {s.get('readableCode')} | Status: {s.get('status')} | Plan: {s.get('packageNameEn', s.get('packageReadableCode'))} | Price: {s.get('price')} SAR")
        print(f"    Plates: {v_plates} | Created: {c_dt} | RenewalDate: {r_dt} | Updated: {u_dt}")

    # Check refunds
    matched_refunds = []
    for r in refunds:
        for o in matched_orders:
            if r.get('saleOrderCode') == o.get('readableCode'):
                matched_refunds.append(r)
    print(f"\n" + "=" * 80)
    print(f"REFUNDS FOR THIS CUSTOMER: {len(matched_refunds)}")
    print("=" * 80)
    for r in matched_refunds:
        print(f"  - Refund: {r.get('readableCode')} | Order: {r.get('saleOrderCode')} | Amount: {r.get('amount')} SAR | Status: {r.get('status')} | Reason: {r.get('reason')}")

if __name__ == '__main__':
    run()
