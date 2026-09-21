import os
import sys
import json
from collections import defaultdict
from datetime import datetime

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKUP_DIR = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_json(name):
    fpath = os.path.join(BACKUP_DIR, f"{name}.json")
    with open(fpath, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_dt(val):
    if not val:
        return ""
    if isinstance(val, dict):
        return str(val.get('$date', ''))
    return str(val)

def extract_id(val):
    if not val:
        return ""
    if isinstance(val, dict):
        return str(val.get('$oid', ''))
    return str(val)

def run():
    orders = load_json('rushwash_sale_orders')
    subs = load_json('rushwash_subscriptions')
    customers = load_json('rushwash_customers')
    cust_map = {extract_id(c.get('_id')): c for c in customers}

    start_date = '2026-08-21'
    end_date = '2026-09-05'

    # Filter all renewal orders in window
    renewals = []
    all_window_orders = []
    
    for o in orders:
        c_dt = extract_dt(o.get('createdAt'))
        date_str = c_dt[:10] if len(c_dt) >= 10 else ''
        if start_date <= date_str <= end_date:
            all_window_orders.append(o)
            if o.get('isRenewal'):
                renewals.append(o)

    print(f"Total window orders: {len(all_window_orders)}")
    print(f"Total renewal orders in window: {len(renewals)}")

    # Group renewals by (customerId, normalizedPlate, packageCode/packageType)
    # Also group renewals by customerId
    by_cust = defaultdict(list)
    by_plate = defaultdict(list)
    by_cust_plate = defaultdict(list)

    for o in renewals:
        cid = extract_id(o.get('customerId'))
        plate = o.get('normalizedPlate') or (o.get('vehicleSnapshot') or {}).get('normalizedPlate') or 'UNKNOWN_PLATE'
        by_cust[cid].append(o)
        by_plate[plate].append(o)
        by_cust_plate[(cid, plate)].append(o)

    # Breakdown of categories
    # Category A: Double Paid (2+ paid renewal orders in the window)
    double_paid = []
    # Category B: Retry Success (1 failed/cancelled attempt, then 1 paid)
    retry_success = []
    # Category C: Multiple Retries Failed (2+ failed/cancelled attempts)
    multi_failed = []
    # Category D: Multiple Draft / Abandoned / Active
    other_multi = []

    paid_statuses = {'paid', 'completed', 'success'}

    for (cid, plate), ord_list in by_cust_plate.items():
        if len(ord_list) < 2:
            continue
        
        ord_list.sort(key=lambda x: extract_dt(x.get('createdAt')))
        paid_orders = [o for o in ord_list if o.get('status') in paid_statuses or any(p.get('status') in paid_statuses for p in o.get('payments', []))]
        
        c_snap = ord_list[0].get('customerSnapshot', {})
        c_name = c_snap.get('name') or cust_map.get(cid, {}).get('name', 'N/A')
        c_phone = c_snap.get('phone') or cust_map.get(cid, {}).get('phone', 'N/A')

        info = {
            'cid': cid,
            'plate': plate,
            'name': c_name,
            'phone': c_phone,
            'total_orders': len(ord_list),
            'paid_count': len(paid_orders),
            'orders': ord_list,
            'paid_orders': paid_orders
        }

        if len(paid_orders) >= 2:
            double_paid.append(info)
        elif len(paid_orders) == 1:
            retry_success.append(info)
        else:
            multi_failed.append(info)

    # Let's also check non-renewal orders that might be duplicate package purchases on same plate
    package_orders_by_plate = defaultdict(list)
    for o in all_window_orders:
        plate = o.get('normalizedPlate') or (o.get('vehicleSnapshot') or {}).get('normalizedPlate')
        if plate and (o.get('status') in paid_statuses or any(p.get('status') in paid_statuses for p in o.get('payments', []))):
            package_orders_by_plate[plate].append(o)

    multi_paid_any = {k: v for k, v in package_orders_by_plate.items() if len(v) > 1}

    print("\n--- RESULTS SUMMARY ---")
    print(f"Total Customer/Plate groups with 2+ renewal attempts: {len(double_paid) + len(retry_success) + len(multi_failed)}")
    print(f"  1. Double Paid (Charged 2+ times successfully): {len(double_paid)}")
    print(f"  2. Retry Succeeded (1+ failed attempts, then succeeded): {len(retry_success)}")
    print(f"  3. Multiple Failed Attempts (All attempts failed): {len(multi_failed)}")
    print(f"  4. Any Paid Orders duplicated on same plate in window: {len(multi_paid_any)}")

    # Detailed dump of Double Paid
    print("\n=== DOUBLE PAID CASES ===")
    for dp in double_paid:
        print(f"Customer: {dp['name']} ({dp['phone']}) | Plate: {dp['plate']}")
        for o in dp['orders']:
            print(f"  - Order: {o.get('readableCode')} | Date: {extract_dt(o.get('createdAt'))} | Status: {o.get('status')} | Total: {o.get('postDiscountTotal')} SAR")
            for p in o.get('payments', []):
                print(f"      Payment: {p.get('paymentMethodNameEn')} {p.get('amount')} SAR [{p.get('status')}] occurredAt: {extract_dt(p.get('occurredAt'))}")

    # Check all other paid orders on same plate in window to see if any other double charge occurred
    print("\n=== ALL VEHICLES WITH MULTIPLE PAID ORDERS IN WINDOW ===")
    for plate, ords in multi_paid_any.items():
        if len(ords) > 1:
            # Check if same package or sub
            print(f"Plate: {plate} ({len(ords)} paid orders):")
            for o in ords:
                c_snap = o.get('customerSnapshot', {})
                lines_desc = ", ".join([l.get('displayNameEn', l.get('catalogCode', '')) for l in (o.get('lines') or o.get('lineSnapshots') or [])])
                print(f"  - {o.get('readableCode')} | {extract_dt(o.get('createdAt'))} | Total: {o.get('postDiscountTotal')} SAR | isRenewal: {o.get('isRenewal')} | Lines: {lines_desc}")

if __name__ == '__main__':
    run()
