import os
import sys
import json
from collections import defaultdict
from datetime import datetime, timedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKUP_DIR = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_json(name):
    fpath = os.path.join(BACKUP_DIR, f"{name}.json")
    with open(fpath, 'r', encoding='utf-8') as f:
        return json.load(f)

def parse_date(val):
    if not val:
        return None
    s = ""
    if isinstance(val, dict):
        s = str(val.get('$date', ''))
    else:
        s = str(val)
    if not s:
        return None
    # Parse ISO string
    # Remove Z or offset
    s_clean = s.replace('Z', '+00:00')
    try:
        return datetime.fromisoformat(s_clean)
    except Exception:
        # Fallback to date slice
        try:
            return datetime.strptime(s[:10], '%Y-%m-%d')
        except Exception:
            return None

def extract_id(val):
    if not val:
        return ""
    if isinstance(val, dict):
        return str(val.get('$oid', ''))
    return str(val)

def run():
    print("=" * 80)
    print("      AUDIT FOR ANY DOUBLE RENEWALS / CHARGES WITHIN 30 DAYS      ")
    print("         (Focusing on Renewals from 21 Aug 2026 till Today)        ")
    print("=" * 80)

    orders = load_json('rushwash_sale_orders')
    subs = load_json('rushwash_subscriptions')
    customers = load_json('rushwash_customers')
    refunds = load_json('rushwash_refund_requests')
    
    cust_map = {extract_id(c.get('_id')): c for c in customers}
    refund_order_codes = {r.get('saleOrderCode'): r for r in refunds if r.get('saleOrderCode')}

    paid_statuses = {'paid', 'completed', 'success', 'succeeded'}

    # Process all orders and get their dates, vehicles, customers, line items
    processed_orders = []
    for o in orders:
        dt = parse_date(o.get('createdAt'))
        if not dt:
            continue
        
        # Check if paid
        is_paid = o.get('status') in paid_statuses or any(p.get('status') in paid_statuses for p in o.get('payments', []))
        
        cid = extract_id(o.get('customerId'))
        plate = o.get('normalizedPlate') or (o.get('vehicleSnapshot') or {}).get('normalizedPlate') or ''
        
        # Extract plans
        plans = []
        lines = o.get('lines') or o.get('lineSnapshots') or []
        for l in lines:
            p_code = l.get('catalogCode') or l.get('planReadableCode') or l.get('displayNameEn')
            p_kind = l.get('lineKind') or l.get('type')
            p_name = l.get('displayNameEn') or l.get('displayNameAr') or p_code
            plans.append({
                'code': p_code,
                'name': p_name,
                'kind': p_kind,
                'price': l.get('price', 0)
            })

        processed_orders.append({
            'raw': o,
            'code': o.get('readableCode'),
            'date': dt,
            'date_str': dt.strftime('%Y-%m-%d %H:%M:%S'),
            'is_paid': is_paid,
            'isRenewal': bool(o.get('isRenewal')),
            'status': o.get('status'),
            'total': o.get('postDiscountTotal') or o.get('lineSubtotal') or 0,
            'cid': cid,
            'customerName': (o.get('customerSnapshot') or {}).get('name') or cust_map.get(cid, {}).get('name', 'N/A'),
            'customerPhone': (o.get('customerSnapshot') or {}).get('phone') or cust_map.get(cid, {}).get('phone', 'N/A'),
            'plate': plate,
            'plans': plans,
            'payments': o.get('payments', [])
        })

    # Filter targets: Orders between 2026-08-21 and 2026-09-05
    start_dt = datetime(2026, 8, 21, 0, 0, 0)
    end_dt = datetime(2026, 9, 5, 23, 59, 59)

    print(f"Total historical orders analyzed: {len(processed_orders):,}")
    
    # 1. Check double renewals by Plate
    # For each renewal order in [start_dt, end_dt]:
    # Look for any OTHER paid renewal order for the SAME plate where 0 < abs(o1.date - o2.date) <= 30 days
    
    by_plate_paid = defaultdict(list)
    by_plate_renewals = defaultdict(list)
    for o in processed_orders:
        if o['plate']:
            if o['is_paid']:
                by_plate_paid[o['plate']].append(o)
            if o['isRenewal']:
                by_plate_renewals[o['plate']].append(o)

    # Sort all by date
    for plate in by_plate_paid:
        by_plate_paid[plate].sort(key=lambda x: x['date'])
    for plate in by_plate_renewals:
        by_plate_renewals[plate].sort(key=lambda x: x['date'])

    # Find duplicate paid renewals within 30 days
    # (where at least one of the renewals occurred between 21 Aug and 05 Sep)
    double_paid_30d = []
    seen_pairs = set()

    for plate, ord_list in by_plate_paid.items():
        # Filter to renewals only or subscription purchases
        renewal_orders = [o for o in ord_list if o['isRenewal']]
        
        for i in range(len(renewal_orders)):
            o1 = renewal_orders[i]
            # Check if o1 is in our target window
            in_window = start_dt <= o1['date'].replace(tzinfo=None) <= end_dt
            
            for j in range(i + 1, len(renewal_orders)):
                o2 = renewal_orders[j]
                in_window_2 = start_dt <= o2['date'].replace(tzinfo=None) <= end_dt
                
                if not (in_window or in_window_2):
                    continue
                
                delta_days = (o2['date'] - o1['date']).total_seconds() / 86400.0
                if 0 < delta_days <= 30:
                    pair_key = tuple(sorted([o1['code'], o2['code']]))
                    if pair_key not in seen_pairs:
                        seen_pairs.add(pair_key)
                        double_paid_30d.append({
                            'plate': plate,
                            'customerName': o1['customerName'],
                            'customerPhone': o1['customerPhone'],
                            'order1': o1,
                            'order2': o2,
                            'delta_days': round(delta_days, 2),
                            'refund1': refund_order_codes.get(o1['code']),
                            'refund2': refund_order_codes.get(o2['code'])
                        })

    print(f"\n================================================================================")
    print(f"1. CONFIRMED DOUBLE PAID RENEWALS WITHIN 30 DAYS (Both Orders Marked Paid)")
    print(f"================================================================================")
    print(f"Total Double-Paid Renewal Pairs Found: {len(double_paid_30d)}\n")

    for idx, dp in enumerate(double_paid_30d, 1):
        o1 = dp['order1']
        o2 = dp['order2']
        p1_desc = ", ".join([p['name'] for p in o1['plans']])
        p2_desc = ", ".join([p['name'] for p in o2['plans']])
        r1_str = f" [REFUNDED: {dp['refund1']['amount']} SAR]" if dp['refund1'] else " [NO REFUND]"
        r2_str = f" [REFUNDED: {dp['refund2']['amount']} SAR]" if dp['refund2'] else " [NO REFUND]"

        print(f"Case #{idx}: Customer: {dp['customerName']} ({dp['customerPhone']}) | Plate: {dp['plate']}")
        print(f"  Gap: {dp['delta_days']} days ({round(dp['delta_days']*24, 1)} hours)")
        print(f"  - Order 1: {o1['code']} | {o1['date_str']} | Total: {o1['total']} SAR | Plans: {p1_desc}{r1_str}")
        print(f"  - Order 2: {o2['code']} | {o2['date_str']} | Total: {o2['total']} SAR | Plans: {p2_desc}{r2_str}")
        print("-" * 80)

    # 2. Check for ANY paid subscription / package purchase within 30 days of a Renewal
    # (e.g. Customer renewed via cron, but also bought a package at the POS station within 30 days)
    double_sub_mixed = []
    seen_mixed_pairs = set()

    for plate, ord_list in by_plate_paid.items():
        for i in range(len(ord_list)):
            o1 = ord_list[i]
            in_w1 = start_dt <= o1['date'].replace(tzinfo=None) <= end_dt
            
            for j in range(i + 1, len(ord_list)):
                o2 = ord_list[j]
                in_w2 = start_dt <= o2['date'].replace(tzinfo=None) <= end_dt
                
                if not (in_w1 or in_w2):
                    continue
                
                # At least one is a renewal, or both are monthly packages >= 59 SAR
                is_sub_like_1 = o1['isRenewal'] or o1['total'] >= 59
                is_sub_like_2 = o2['isRenewal'] or o2['total'] >= 59
                
                if not (is_sub_like_1 and is_sub_like_2):
                    continue

                # Skip if already in double_paid_30d
                pair_key = tuple(sorted([o1['code'], o2['code']]))
                if pair_key in seen_pairs:
                    continue

                delta_days = (o2['date'] - o1['date']).total_seconds() / 86400.0
                if 0 < delta_days <= 30:
                    # Check if same plan or overlapping monthly plan
                    seen_mixed_pairs.add(pair_key)
                    double_sub_mixed.append({
                        'plate': plate,
                        'customerName': o1['customerName'],
                        'customerPhone': o1['customerPhone'],
                        'order1': o1,
                        'order2': o2,
                        'delta_days': round(delta_days, 2),
                        'refund1': refund_order_codes.get(o1['code']),
                        'refund2': refund_order_codes.get(o2['code'])
                    })

    print(f"\n================================================================================")
    print(f"2. MIXED DOUBLE PURCHASES WITHIN 30 DAYS (Renewal + POS / POS + POS Monthly Packages)")
    print(f"================================================================================")
    print(f"Total Mixed Pairs Found: {len(double_sub_mixed)}\n")

    for idx, dp in enumerate(double_sub_mixed, 1):
        o1 = dp['order1']
        o2 = dp['order2']
        p1_desc = ", ".join([p['name'] for p in o1['plans']]) or f"{o1['total']} SAR"
        p2_desc = ", ".join([p['name'] for p in o2['plans']]) or f"{o2['total']} SAR"
        r1_str = f" [REFUNDED: {dp['refund1']['amount']} SAR]" if dp['refund1'] else ""
        r2_str = f" [REFUNDED: {dp['refund2']['amount']} SAR]" if dp['refund2'] else ""

        print(f"Case #{idx}: Customer: {dp['customerName']} ({dp['customerPhone']}) | Plate: {dp['plate']}")
        print(f"  Gap: {dp['delta_days']} days")
        print(f"  - Order 1: {o1['code']} | {o1['date_str']} | Total: {o1['total']} SAR (Renewal: {o1['isRenewal']}) | Plans: {p1_desc}{r1_str}")
        print(f"  - Order 2: {o2['code']} | {o2['date_str']} | Total: {o2['total']} SAR (Renewal: {o2['isRenewal']}) | Plans: {p2_desc}{r2_str}")
        print("-" * 80)

if __name__ == '__main__':
    run()
