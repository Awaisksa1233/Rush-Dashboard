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

def main():
    orders = load_json('rushwash_sale_orders')
    refunds = load_json('rushwash_refund_requests')
    customers = load_json('rushwash_customers')
    cust_map = {str(c.get('_id', {}).get('$oid', c.get('_id'))): c for c in customers}
    refund_map = {r.get('saleOrderCode'): r for r in refunds}

    paid_statuses = {'paid', 'completed', 'success'}
    
    # Analyze all orders
    all_paid = []
    for o in orders:
        is_paid = o.get('status') in paid_statuses or any(p.get('status') in paid_statuses for p in o.get('payments', []))
        if is_paid:
            dt = extract_dt_obj(o.get('createdAt'))
            if dt:
                o['parsed_dt'] = dt
                all_paid.append(o)

    all_paid.sort(key=lambda x: x['parsed_dt'])

    print(f"Total Paid Orders in Entire Database: {len(all_paid):,}")

    # Window of interest: 2026-08-21 to 2026-09-05
    win_start = datetime(2026, 8, 21)
    win_end = datetime(2026, 9, 5, 23, 59, 59)

    # 1. Pure Renewal-to-Renewal Double Charges within 30 days
    renewals_by_plate = defaultdict(list)
    for o in all_paid:
        if o.get('isRenewal'):
            plate = o.get('normalizedPlate') or (o.get('vehicleSnapshot') or {}).get('normalizedPlate')
            if plate:
                renewals_by_plate[plate].append(o)

    double_renewals = []
    for plate, ords in renewals_by_plate.items():
        if len(ords) > 1:
            for i in range(len(ords)):
                o1 = ords[i]
                for j in range(i+1, len(ords)):
                    o2 = ords[j]
                    if (win_start <= o1['parsed_dt'] <= win_end) or (win_start <= o2['parsed_dt'] <= win_end):
                        delta_days = (o2['parsed_dt'] - o1['parsed_dt']).total_seconds() / 86400.0
                        if 0 < delta_days <= 30.0:
                            double_renewals.append({
                                'plate': plate,
                                'o1': o1,
                                'o2': o2,
                                'delta_days': delta_days,
                                'ref1': refund_map.get(o1.get('readableCode')),
                                'ref2': refund_map.get(o2.get('readableCode'))
                            })

    print(f"\n==========================================================================")
    print(f"1. PURE DOUBLE PAID RENEWALS WITHIN 30 DAYS: {len(double_renewals)} cases")
    print(f"==========================================================================")
    for idx, d in enumerate(double_renewals, 1):
        o1, o2 = d['o1'], d['o2']
        c_snap = o1.get('customerSnapshot') or {}
        c_name = c_snap.get('name') or cust_map.get(str(o1.get('customerId', {}).get('$oid', '')), {}).get('name', 'N/A')
        c_phone = c_snap.get('phone') or cust_map.get(str(o1.get('customerId', {}).get('$oid', '')), {}).get('phone', 'N/A')
        
        r1_txt = f" [REFUNDED: {d['ref1']['amount']} SAR]" if d['ref1'] else " [NO REFUND]"
        r2_txt = f" [REFUNDED: {d['ref2']['amount']} SAR]" if d['ref2'] else " [NO REFUND]"

        print(f"Case #{idx}: Customer: {c_name} ({c_phone}) | Plate: {d['plate']}")
        print(f"  Time Difference: {d['delta_days']:.2f} days ({d['delta_days']*24:.1f} hours)")
        print(f"  - Order 1: {o1.get('readableCode')} | {o1['parsed_dt']} | Total: {o1.get('postDiscountTotal')} SAR{r1_txt}")
        print(f"  - Order 2: {o2.get('readableCode')} | {o2['parsed_dt']} | Total: {o2.get('postDiscountTotal')} SAR{r2_txt}")
        print("-" * 74)

    # 2. Mixed: Renewal + POS Package Purchase on Same Vehicle within 30 days
    # (e.g. System charged renewal, but customer also paid at POS for subscription/package)
    paid_by_plate = defaultdict(list)
    for o in all_paid:
        plate = o.get('normalizedPlate') or (o.get('vehicleSnapshot') or {}).get('normalizedPlate')
        if plate:
            paid_by_plate[plate].append(o)

    mixed_doubles = []
    for plate, ords in paid_by_plate.items():
        if len(ords) > 1:
            for i in range(len(ords)):
                o1 = ords[i]
                for j in range(i+1, len(ords)):
                    o2 = ords[j]
                    if (win_start <= o1['parsed_dt'] <= win_end) or (win_start <= o2['parsed_dt'] <= win_end):
                        # We want cases where either (isRenewal + POS sub) or (2 paid sub orders of price >= 59 SAR where customer actually paid money twice)
                        is_ren_1 = bool(o1.get('isRenewal'))
                        is_ren_2 = bool(o2.get('isRenewal'))
                        tot1 = o1.get('postDiscountTotal', 0)
                        tot2 = o2.get('postDiscountTotal', 0)

                        if is_ren_1 and is_ren_2:
                            continue # Already in section 1

                        # Only include if money was paid in BOTH orders (> 0 SAR)
                        if tot1 > 0 and tot2 > 0:
                            # At least one renewal, or both >= 59 SAR package subscriptions
                            if (is_ren_1 or is_ren_2) or (tot1 >= 59 and tot2 >= 59):
                                delta_days = (o2['parsed_dt'] - o1['parsed_dt']).total_seconds() / 86400.0
                                if 0.001 <= delta_days <= 30.0:
                                    mixed_doubles.append({
                                        'plate': plate,
                                        'o1': o1,
                                        'o2': o2,
                                        'delta_days': delta_days,
                                        'ref1': refund_map.get(o1.get('readableCode')),
                                        'ref2': refund_map.get(o2.get('readableCode'))
                                    })

    print(f"\n==========================================================================")
    print(f"2. OVERLAPPING PAID CHARGES (Renewal + POS Purchase > 0 SAR within 30 days): {len(mixed_doubles)} cases")
    print(f"==========================================================================")
    for idx, d in enumerate(mixed_doubles, 1):
        o1, o2 = d['o1'], d['o2']
        c_snap = o1.get('customerSnapshot') or {}
        c_name = c_snap.get('name') or cust_map.get(str(o1.get('customerId', {}).get('$oid', '')), {}).get('name', 'N/A')
        c_phone = c_snap.get('phone') or cust_map.get(str(o1.get('customerId', {}).get('$oid', '')), {}).get('phone', 'N/A')
        
        lines1 = ", ".join([l.get('displayNameEn', l.get('catalogCode', '')) for l in (o1.get('lines') or o1.get('lineSnapshots') or [])])
        lines2 = ", ".join([l.get('displayNameEn', l.get('catalogCode', '')) for l in (o2.get('lines') or o2.get('lineSnapshots') or [])])

        r1_txt = f" [REFUNDED: {d['ref1']['amount']} SAR]" if d['ref1'] else ""
        r2_txt = f" [REFUNDED: {d['ref2']['amount']} SAR]" if d['ref2'] else ""

        print(f"Case #{idx}: Customer: {c_name} ({c_phone}) | Plate: {d['plate']}")
        print(f"  Time Difference: {d['delta_days']:.2f} days")
        print(f"  - Order 1: {o1.get('readableCode')} | {o1['parsed_dt']} | Total: {o1.get('postDiscountTotal')} SAR | Renewal: {o1.get('isRenewal')} | Items: {lines1}{r1_txt}")
        print(f"  - Order 2: {o2.get('readableCode')} | {o2['parsed_dt']} | Total: {o2.get('postDiscountTotal')} SAR | Renewal: {o2.get('isRenewal')} | Items: {lines2}{r2_txt}")
        print("-" * 74)

if __name__ == '__main__':
    main()
