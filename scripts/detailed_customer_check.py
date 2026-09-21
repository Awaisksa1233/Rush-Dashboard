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

def clean_phone(p):
    if not p:
        return ""
    digits = ''.join(c for c in str(p) if c.isdigit())
    if digits.startswith('966'):
        return digits[3:]
    if digits.startswith('0'):
        return digits[1:]
    return digits

def parse_dt(d):
    if not d: return None
    s = d.get('$date') if isinstance(d, dict) else str(d)
    if not s: return None
    try:
        return datetime.fromisoformat(s.replace('Z', ''))
    except:
        return None

def main():
    target = '502766618'
    customers = load_json('rushwash_customers')
    orders = load_json('rushwash_sale_orders')
    subs = load_json('rushwash_subscriptions')
    vehicles = load_json('rushwash_vehicles')

    matched_cust = [c for c in customers if clean_phone(c.get('phone')) == target]
    c_ids = set(str(c.get('_id', {}).get('$oid', c.get('_id'))) for c in matched_cust)
    c_names = set(c.get('name') for c in matched_cust)

    print(f"Customer Name(s): {', '.join(c_names)}")
    print(f"Customer IDs: {c_ids}")

    # Linked vehicles
    c_vehicles = [v for v in vehicles if str(v.get('customerId', {}).get('$oid', v.get('customerId'))) in c_ids]
    v_plates = set(v.get('normalizedPlate') or v.get('displayPlate') for v in c_vehicles if (v.get('normalizedPlate') or v.get('displayPlate')))

    print(f"\nTotal Registered Vehicles: {len(c_vehicles)}")
    for v in c_vehicles:
        print(f"  - Plate: {v.get('displayPlate')} ({v.get('normalizedPlate')}) | Make/Model: {v.get('make')} {v.get('model')} {v.get('year')} | Code: {v.get('readableCode')}")

    # Group all orders by Vehicle Plate
    matched_orders = []
    for o in orders:
        cid = str(o.get('customerId', {}).get('$oid', o.get('customerId')))
        phone = clean_phone((o.get('customerSnapshot') or {}).get('phone'))
        plate = o.get('normalizedPlate') or (o.get('vehicleSnapshot') or {}).get('normalizedPlate')
        
        if cid in c_ids or phone == target or (plate and plate in v_plates):
            dt = parse_dt(o.get('createdAt'))
            o['dt'] = dt
            matched_orders.append(o)

    matched_orders.sort(key=lambda x: x['dt'] or datetime.min)

    print(f"\nTotal Orders for this Customer across all time: {len(matched_orders)}")

    # Check recent orders (last 60 days)
    cutoff = datetime(2026, 7, 1)
    recent_orders = [o for o in matched_orders if o['dt'] and o['dt'] >= cutoff]
    print(f"Orders since July 1, 2026: {len(recent_orders)}")

    paid_statuses = {'paid', 'completed', 'success'}

    # Group by Plate and check for any double deductions
    by_plate = defaultdict(list)
    for o in recent_orders:
        plate = o.get('normalizedPlate') or (o.get('vehicleSnapshot') or {}).get('normalizedPlate') or 'UNKNOWN'
        by_plate[plate].append(o)

    print("\n" + "=" * 80)
    print("ANALYSIS OF RECENT ORDERS PER VEHICLE (SINCE JULY 2026):")
    print("=" * 80)

    for plate, ords in by_plate.items():
        print(f"\n▶ VEHICLE PLATE: {plate} ({len(ords)} orders since July 2026)")
        paid_ords = [o for o in ords if o.get('status') in paid_statuses or any(p.get('status') in paid_statuses for p in o.get('payments', []))]
        
        print(f"  Paid Orders: {len(paid_ords)}")
        for o in ords:
            lines = ", ".join([f"{l.get('displayNameEn', l.get('catalogCode'))} ({l.get('price')} SAR)" for l in (o.get('lines') or o.get('lineSnapshots') or [])])
            p_info = ", ".join([f"{p.get('paymentMethodNameEn', p.get('provider'))}: {p.get('status')} ({p.get('amount')} SAR)" for p in o.get('payments', [])]) or "No payment"
            print(f"    - {o.get('readableCode')} | {o['dt']} | Status: {o.get('status')} | Total: {o.get('postDiscountTotal')} SAR | Renewal: {o.get('isRenewal')}")
            print(f"        Items: {lines}")
            print(f"        Payments: {p_info}")

        # Check for duplicate paid charges within 30 days on this plate
        if len(paid_ords) > 1:
            for i in range(len(paid_ords)):
                for j in range(i+1, len(paid_ords)):
                    o1, o2 = paid_ords[i], paid_ords[j]
                    delta = (o2['dt'] - o1['dt']).total_seconds() / 86400.0
                    tot1 = o1.get('postDiscountTotal', 0)
                    tot2 = o2.get('postDiscountTotal', 0)
                    if 0 < delta <= 30 and tot1 > 0 and tot2 > 0:
                        print(f"    ⚠️ POTENTIAL DOUBLE DEDUCTION on Plate {plate}:")
                        print(f"       Order 1: {o1.get('readableCode')} on {o1['dt']} ({tot1} SAR)")
                        print(f"       Order 2: {o2.get('readableCode')} on {o2['dt']} ({tot2} SAR)")
                        print(f"       Gap: {delta:.2f} days ({delta*24:.1f} hours)")

    # Also check Subscriptions for this customer
    c_subs = [s for s in subs if str(s.get('customerId', {}).get('$oid', s.get('customerId'))) in c_ids or clean_phone((s.get('customerSnapshot') or {}).get('phone')) == target]
    active_subs = [s for s in c_subs if s.get('status') in ['active', 'valid']]

    print("\n" + "=" * 80)
    print(f"ACTIVE SUBSCRIPTIONS: {len(active_subs)} active (out of {len(c_subs)} total)")
    print("=" * 80)
    for s in active_subs:
        v_plates = [vl.get('snapshot', {}).get('displayPlate') for vl in s.get('vehicleLinks', [])]
        c_dt = parse_dt(s.get('createdAt'))
        r_dt = parse_dt(s.get('renewalDate'))
        print(f"  - Sub: {s.get('readableCode')} | Plan: {s.get('packageNameEn', s.get('packageReadableCode'))} | Price: {s.get('price')} SAR | Plate: {v_plates} | RenewalDate: {r_dt}")

if __name__ == '__main__':
    main()
