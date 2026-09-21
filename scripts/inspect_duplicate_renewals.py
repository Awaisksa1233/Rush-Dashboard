import os
import sys
import json
from collections import defaultdict
from datetime import datetime

# UTF-8 for Arabic text
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKUP_DIR = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_json(name):
    fpath = os.path.join(BACKUP_DIR, f"{name}.json")
    if not os.path.exists(fpath):
        print(f"File not found: {fpath}")
        return []
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read().strip()
        try:
            return json.loads(content)
        except Exception:
            docs = []
            for line in content.split('\n'):
                line = line.strip()
                if line:
                    try:
                        docs.append(json.loads(line))
                    except Exception:
                        pass
            return docs

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

def analyze():
    print("=" * 70)
    print("      ANALYZING DUPLICATE RENEWALS: 21 AUG 2026 TILL TODAY       ")
    print("=" * 70)

    orders = load_json('rushwash_sale_orders')
    subs = load_json('rushwash_subscriptions')
    customers = load_json('rushwash_customers')
    vehicles = load_json('rushwash_vehicles')
    audits = load_json('rushwash_audit_events')
    wallet_txs = load_json('rushwash_wallet_transactions')

    # Index maps
    cust_map = {extract_id(c.get('_id')): c for c in customers}
    veh_map = {extract_id(v.get('_id')): v for v in vehicles}
    sub_map = {extract_id(s.get('_id')): s for s in subs}
    sub_code_map = {s.get('readableCode'): s for s in subs if s.get('readableCode')}

    start_date = '2026-08-21'
    end_date = '2026-09-05'

    print(f"Total Orders Loaded: {len(orders):,}")
    print(f"Total Subscriptions Loaded: {len(subs):,}")
    print(f"Total Audit Events Loaded: {len(audits):,}")
    print(f"Date Filter Range: {start_date} to {end_date} (inclusive)\n")

    # Filter orders in window
    window_orders = []
    for o in orders:
        c_dt = extract_dt(o.get('createdAt'))
        u_dt = extract_dt(o.get('updatedAt'))
        
        # Check payments occurredAt
        pay_dts = []
        for p in o.get('payments', []):
            p_dt = extract_dt(p.get('occurredAt'))
            if p_dt:
                pay_dts.append(p_dt)
                
        # Primary date
        order_dt = c_dt or (pay_dts[0] if pay_dts else u_dt)
        date_str = order_dt[:10] if len(order_dt) >= 10 else ''
        
        if start_date <= date_str <= end_date:
            window_orders.append({
                'order': o,
                'date_str': date_str,
                'full_dt': order_dt,
                'isRenewal': bool(o.get('isRenewal')),
                'status': o.get('status'),
                'total': o.get('postDiscountTotal') or o.get('lineSubtotal') or 0,
                'readableCode': o.get('readableCode'),
                'customerId': extract_id(o.get('customerId')),
                'vehicleId': extract_id(o.get('vehicleId')),
                'normalizedPlate': o.get('normalizedPlate') or (o.get('vehicleSnapshot') or {}).get('normalizedPlate') or '',
                'customerName': (o.get('customerSnapshot') or {}).get('name') or (cust_map.get(extract_id(o.get('customerId')), {}).get('name', 'N/A')),
                'customerPhone': (o.get('customerSnapshot') or {}).get('phone') or (cust_map.get(extract_id(o.get('customerId')), {}).get('phone', 'N/A')),
                'lines': o.get('lines') or o.get('lineSnapshots') or [],
                'payments': o.get('payments', [])
            })

    print(f"Orders placed between {start_date} and {end_date}: {len(window_orders):,}")
    
    renewals_in_window = [w for w in window_orders if w['isRenewal']]
    print(f"Renewal Orders in this window: {len(renewals_in_window):,}")
    
    # 1. Group by Customer + Plate/Vehicle to find duplicate renewal orders
    by_cust_plate = defaultdict(list)
    by_cust = defaultdict(list)
    by_plate = defaultdict(list)

    for w in renewals_in_window:
        key_cust_plate = (w['customerId'], w['normalizedPlate'])
        by_cust_plate[key_cust_plate].append(w)
        by_cust[w['customerId']].append(w)
        if w['normalizedPlate']:
            by_plate[w['normalizedPlate']].append(w)

    print("\n" + "=" * 70)
    print("1. DUPLICATE RENEWAL ORDERS BY CUSTOMER & PLATE (Same Customer + Same Car)")
    print("=" * 70)

    dup_groups = {k: v for k, v in by_cust_plate.items() if len(v) > 1}
    print(f"Found {len(dup_groups)} groups with multiple renewal orders:\n")

    for (c_id, plate), group in sorted(dup_groups.items(), key=lambda x: len(x[1]), reverse=True):
        cust_name = group[0]['customerName']
        cust_phone = group[0]['customerPhone']
        print(f"▶ Customer: {cust_name} (Phone: {cust_phone} | ID: {c_id}) — Plate: {plate}")
        print(f"  Total Renewal Orders in Window: {len(group)}")
        
        # Sort by datetime
        group_sorted = sorted(group, key=lambda x: x['full_dt'])
        for idx, item in enumerate(group_sorted, 1):
            o = item['order']
            lines_summary = ", ".join([f"{l.get('displayNameEn', l.get('catalogCode', 'Item'))} ({l.get('price', 0)} SAR)" for l in item['lines']])
            pay_status = ", ".join([f"{p.get('paymentMethodNameEn', p.get('provider', 'Pay'))}: {p.get('status')} ({p.get('amount')} SAR)" for p in item['payments']]) or "No payment records"
            print(f"    [{idx}] Code: {item['readableCode']} | Date: {item['full_dt']} | Status: {item['status']} | Total: {item['total']} SAR")
            print(f"        Package(s): {lines_summary}")
            print(f"        Payments:   {pay_status}")
        print("-" * 70)

    # 2. Check for DUPLICATE PAID/SUCCESSFUL renewals (actual double-charging)
    print("\n" + "=" * 70)
    print("2. DUPLICATE SUCCESSFUL / PAID RENEWALS (Double-Billed in Aug 21 - Sep 5)")
    print("=" * 70)
    
    paid_statuses = {'paid', 'completed', 'success', 'succeeded'}
    double_paid_groups = {}
    for (c_id, plate), group in by_cust_plate.items():
        paid_orders = [
            w for w in group 
            if w['status'] in paid_statuses or any(p.get('status') in paid_statuses for p in w['payments'])
        ]
        if len(paid_orders) > 1:
            double_paid_groups[(c_id, plate)] = paid_orders

    print(f"Found {len(double_paid_groups)} cases of multiple PAID renewals for the same vehicle/customer:\n")
    for (c_id, plate), group in double_paid_groups.items():
        cust_name = group[0]['customerName']
        cust_phone = group[0]['customerPhone']
        print(f"⚠️ DOUBLE PAID: {cust_name} ({cust_phone}) — Plate: {plate}")
        for idx, item in enumerate(group, 1):
            print(f"    [{idx}] Code: {item['readableCode']} | Date: {item['full_dt']} | Status: {item['status']} | Total: {item['total']} SAR")
        print("-" * 70)

    # 3. Check Subscriptions collection for duplicate renewal timestamps or multiple active subscriptions for same car
    print("\n" + "=" * 70)
    print("3. SUBSCRIPTIONS WITH DUPLICATE ACTIVE STATUS FOR SAME VEHICLE")
    print("=" * 70)
    
    active_subs_by_veh = defaultdict(list)
    for s in subs:
        status = s.get('status')
        if status in {'active', 'valid'}:
            v_links = s.get('vehicleLinks', [])
            for vl in v_links:
                v_snap = vl.get('snapshot', {})
                plate = v_snap.get('normalizedPlate') or v_snap.get('displayPlate')
                if plate:
                    active_subs_by_veh[plate].append(s)

    multi_active = {k: v for k, v in active_subs_by_veh.items() if len(v) > 1}
    print(f"Found {len(multi_active)} vehicles with multiple active subscriptions:\n")
    for plate, sub_list in list(multi_active.items())[:15]:
        print(f"▶ Plate: {plate} has {len(sub_list)} active subscriptions:")
        for s in sub_list:
            c_snap = s.get('customerSnapshot', {})
            print(f"    - Sub Code: {s.get('readableCode')} | Plan: {s.get('packageNameEn', s.get('packageReadableCode'))} | Renewal: {extract_dt(s.get('renewalDate'))[:10]} | Price: {s.get('price')} SAR | Cust: {c_snap.get('name')}")
        print("-" * 70)

    # 4. Check all orders (including non-renewal flagged) for potential duplicate renewal sales (e.g. onetime package purchase for existing active sub)
    print("\n" + "=" * 70)
    print("4. SUMMARY BY RENEWAL STATUS (Aug 21 – Sep 5)")
    print("=" * 70)
    status_counts = defaultdict(int)
    for w in renewals_in_window:
        status_counts[w['status']] += 1
    for st, cnt in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  - Status '{st}': {cnt:,} renewal orders")

if __name__ == '__main__':
    analyze()
