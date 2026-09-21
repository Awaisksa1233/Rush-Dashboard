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
    with open(fpath, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_dt_obj(val):
    if not val:
        return None
    s = val.get('$date') if isinstance(val, dict) else str(val)
    if not s:
        return None
    s_clean = s.replace('Z', '')
    try:
        return datetime.fromisoformat(s_clean)
    except Exception:
        try:
            return datetime.strptime(s[:10], '%Y-%m-%d')
        except Exception:
            return None

def is_membership_order(order):
    # If isRenewal is True, it's definitely a membership renewal
    if order.get('isRenewal'):
        return True
    
    # Check line items
    lines = order.get('lines') or order.get('lineSnapshots') or []
    for l in lines:
        l_type = l.get('type') or ''
        l_kind = l.get('lineKind') or ''
        c_code = l.get('catalogCode') or l.get('planReadableCode') or ''
        display = (l.get('displayNameEn') or '').lower()
        
        if l_type == 'monthly_subscription' or l_kind == 'package':
            return True
        if c_code.startswith('SPK-'):
            return True
        if 'subscription' in display or 'monthly' in display:
            return True
        # If total is monthly membership price (100, 149, 169, 199, 248, 298, 348, 398)
        if l.get('coveredBySubscription'):
            return True
            
    return False

def get_membership_plans(order):
    lines = order.get('lines') or order.get('lineSnapshots') or []
    plans = []
    for l in lines:
        name = l.get('displayNameEn') or l.get('displayNameAr') or l.get('catalogCode') or 'Membership'
        price = l.get('price', 0)
        code = l.get('catalogCode') or l.get('planReadableCode') or ''
        kind = l.get('lineKind') or l.get('type') or ''
        plans.append({'name': name, 'price': price, 'code': code, 'kind': kind})
    return plans

def main():
    print("=" * 80)
    print("       AUDIT OF DUPLICATE MEMBERSHIP CHARGES WITHIN 30-DAY WINDOW      ")
    print("                   (21 Aug 2026 – 05 Sep 2026 Focus)                  ")
    print("=" * 80)

    orders = load_json('rushwash_sale_orders')
    refunds = load_json('rushwash_refund_requests')
    customers = load_json('rushwash_customers')
    
    cust_map = {str(c.get('_id', {}).get('$oid', c.get('_id'))): c for c in customers}
    refund_map = {r.get('saleOrderCode'): r for r in refunds}

    paid_statuses = {'paid', 'completed', 'success'}
    
    # Filter only paid membership orders
    membership_paid_orders = []
    for o in orders:
        is_paid = o.get('status') in paid_statuses or any(p.get('status') in paid_statuses for p in o.get('payments', []))
        if is_paid and is_membership_order(o):
            dt = extract_dt_obj(o.get('createdAt'))
            if dt:
                o['parsed_dt'] = dt
                o['plans_list'] = get_membership_plans(o)
                membership_paid_orders.append(o)

    membership_paid_orders.sort(key=lambda x: x['parsed_dt'])
    print(f"Total Paid Membership Orders in Database: {len(membership_paid_orders):,}")

    win_start = datetime(2026, 8, 21)
    win_end = datetime(2026, 9, 5, 23, 59, 59)

    # Group by Plate
    by_plate = defaultdict(list)
    for o in membership_paid_orders:
        plate = o.get('normalizedPlate') or (o.get('vehicleSnapshot') or {}).get('normalizedPlate')
        if plate:
            by_plate[plate].append(o)

    # Find pairs with 0 < delta <= 30 days involving the window
    same_plan_doubles = []
    upgrade_or_diff_plan = []
    companion_dual_service = [] # e.g. Exterior + Interior Clean bought together

    for plate, ords in by_plate.items():
        if len(ords) > 1:
            for i in range(len(ords)):
                o1 = ords[i]
                for j in range(i+1, len(ords)):
                    o2 = ords[j]
                    if (win_start <= o1['parsed_dt'] <= win_end) or (win_start <= o2['parsed_dt'] <= win_end):
                        delta_days = (o2['parsed_dt'] - o1['parsed_dt']).total_seconds() / 86400.0
                        if 0 < delta_days <= 30.0:
                            # Check amounts paid
                            tot1 = o1.get('postDiscountTotal') or 0
                            tot2 = o2.get('postDiscountTotal') or 0
                            
                            # Extract plan codes/names
                            p1_names = set(p['name'].lower() for p in o1['plans_list'])
                            p2_names = set(p['name'].lower() for p in o2['plans_list'])
                            
                            # Check if same plan
                            is_same_plan = bool(p1_names.intersection(p2_names))
                            
                            info = {
                                'plate': plate,
                                'o1': o1,
                                'o2': o2,
                                'delta_days': delta_days,
                                'tot1': tot1,
                                'tot2': tot2,
                                'ref1': refund_map.get(o1.get('readableCode')),
                                'ref2': refund_map.get(o2.get('readableCode')),
                                'p1': ", ".join([p['name'] for p in o1['plans_list']]),
                                'p2': ", ".join([p['name'] for p in o2['plans_list']])
                            }

                            if delta_days <= 0.05 and (('interior' in info['p1'].lower() and 'interior' not in info['p2'].lower()) or ('interior' in info['p2'].lower() and 'interior' not in info['p1'].lower())):
                                companion_dual_service.append(info)
                            elif is_same_plan and tot1 > 0 and tot2 > 0:
                                same_plan_doubles.append(info)
                            elif tot1 > 0 and tot2 > 0:
                                upgrade_or_diff_plan.append(info)

    print(f"\n" + "=" * 80)
    print(f"1. TRUE DUPLICATE MEMBERSHIP CHARGES (Same Plan Billed Twice in <= 30 Days): {len(same_plan_doubles)}")
    print("=" * 80)
    for idx, d in enumerate(same_plan_doubles, 1):
        o1, o2 = d['o1'], d['o2']
        c_snap = o1.get('customerSnapshot') or {}
        c_name = c_snap.get('name') or cust_map.get(str(o1.get('customerId', {}).get('$oid', '')), {}).get('name', 'N/A')
        c_phone = c_snap.get('phone') or cust_map.get(str(o1.get('customerId', {}).get('$oid', '')), {}).get('phone', 'N/A')
        
        r1_txt = f" [REFUNDED: {d['ref1']['amount']} SAR]" if d['ref1'] else " [NO REFUND]"
        r2_txt = f" [REFUNDED: {d['ref2']['amount']} SAR]" if d['ref2'] else " [NO REFUND]"

        print(f"Case #{idx}: Customer: {c_name} ({c_phone}) | Plate: {d['plate']}")
        print(f"  Gap: {d['delta_days']:.2f} days ({d['delta_days']*24:.1f} hours)")
        print(f"  - Order 1: {o1.get('readableCode')} | {o1['parsed_dt']} | Total: {d['tot1']} SAR | Plan: {d['p1']}{r1_txt} (Renewal: {o1.get('isRenewal')})")
        print(f"  - Order 2: {o2.get('readableCode')} | {o2['parsed_dt']} | Total: {d['tot2']} SAR | Plan: {d['p2']}{r2_txt} (Renewal: {o2.get('isRenewal')})")
        print("-" * 80)

    print(f"\n" + "=" * 80)
    print(f"2. MID-CYCLE PLAN UPGRADES / PRORATED ADJUSTMENTS (<= 30 Days): {len(upgrade_or_diff_plan)}")
    print("=" * 80)
    for idx, d in enumerate(upgrade_or_diff_plan, 1):
        o1, o2 = d['o1'], d['o2']
        c_snap = o1.get('customerSnapshot') or {}
        c_name = c_snap.get('name') or cust_map.get(str(o1.get('customerId', {}).get('$oid', '')), {}).get('name', 'N/A')
        c_phone = c_snap.get('phone') or cust_map.get(str(o1.get('customerId', {}).get('$oid', '')), {}).get('phone', 'N/A')

        r1_txt = f" [REFUNDED: {d['ref1']['amount']} SAR]" if d['ref1'] else ""
        r2_txt = f" [REFUNDED: {d['ref2']['amount']} SAR]" if d['ref2'] else ""

        print(f"Case #{idx}: Customer: {c_name} ({c_phone}) | Plate: {d['plate']}")
        print(f"  Gap: {d['delta_days']:.2f} days")
        print(f"  - Order 1: {o1.get('readableCode')} | {o1['parsed_dt']} | Total: {d['tot1']} SAR | Plan: {d['p1']}{r1_txt}")
        print(f"  - Order 2: {o2.get('readableCode')} | {o2['parsed_dt']} | Total: {d['tot2']} SAR | Plan: {d['p2']}{r2_txt}")
        print("-" * 80)

if __name__ == '__main__':
    main()
