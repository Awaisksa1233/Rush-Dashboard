import os
import sys
import json
from datetime import datetime, timezone
from collections import Counter, defaultdict

backup_dir = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_collection(name):
    for ext in ['.json', '.jsonl']:
        fpath = os.path.join(backup_dir, f"{name}{ext}")
        if os.path.exists(fpath):
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
    return []

def parse_dt(val):
    if not val:
        return None
    if isinstance(val, dict):
        val = val.get('$date')
    if not val:
        return None
    try:
        if isinstance(val, (int, float)):
            return datetime.fromtimestamp(val / 1000.0, tz=timezone.utc)
        s = str(val).replace('Z', '+00:00')
        return datetime.fromisoformat(s)
    except Exception:
        return None

def get_oid(val):
    if not val:
        return None
    if isinstance(val, dict):
        return val.get('$oid') or str(val)
    return str(val)

subs = load_collection('rushwash_subscriptions')
orders = load_collection('rushwash_sale_orders')

start_dt = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)
end_dt = datetime(2026, 9, 7, 23, 59, 59, tzinfo=timezone.utc)

# Check orders created in this window
orders_in_window = []
for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if odt and start_dt <= odt <= end_dt:
        orders_in_window.append((o, odt))

print(f"Orders between 2026-08-23 and 2026-09-07: {len(orders_in_window)}")
renewal_orders = [o for o, _ in orders_in_window if o.get('isRenewal')]
print(f"Orders with isRenewal=True in this window: {len(renewal_orders)}")

# Check what fields are in renewal orders
if renewal_orders:
    sample_ro = renewal_orders[0]
    print("\nSample renewal order keys:", list(sample_ro.keys()))
    print("Sample renewal order:")
    print(json.dumps({
        'readableCode': sample_ro.get('readableCode'),
        'customerId': sample_ro.get('customerId'),
        'subscriptionId': sample_ro.get('subscriptionId'),
        'subCode': sample_ro.get('subscriptionReadableCode') or sample_ro.get('subCode'),
        'status': sample_ro.get('status'),
        'totalCaptured': sample_ro.get('totalCaptured'),
        'postDiscountTotal': sample_ro.get('postDiscountTotal'),
        'payments': sample_ro.get('payments'),
        'createdAt': sample_ro.get('createdAt')
    }, indent=2, default=str))

# Check the 104 active subs with renewalDate in window
active_in_window = [s for s in subs if s.get('status') == 'active' and parse_dt(s.get('renewalDate')) and start_dt <= parse_dt(s.get('renewalDate')) <= end_dt]
print(f"\nActive subs with renewalDate in window: {len(active_in_window)}")
if active_in_window:
    s0 = active_in_window[0]
    print("Sample active sub in window:")
    print(json.dumps({
        'readableCode': s0.get('readableCode'),
        'status': s0.get('status'),
        'autoRenew': s0.get('autoRenew'),
        'renewalDate': s0.get('renewalDate'),
        'createdAt': s0.get('createdAt'),
        'updatedAt': s0.get('updatedAt'),
        'retryCount': s0.get('retryCount'),
        'lastRenewalFailureReason': s0.get('lastRenewalFailureReason'),
        'firstRenewalFailureAt': s0.get('firstRenewalFailureAt'),
        'paymentMethodUsed': s0.get('paymentMethodUsed')
    }, indent=2, default=str))

# Let's see if any of these 104 active subs have renewal orders in the window
sub_ids_active = {get_oid(s.get('_id')) for s in active_in_window}
sub_codes_active = {s.get('readableCode') for s in active_in_window}

orders_for_active = []
for o, odt in orders_in_window:
    o_sub_id = get_oid(o.get('subscriptionId'))
    o_sub_code = o.get('subscriptionReadableCode') or o.get('subCode')
    if o_sub_id in sub_ids_active or o_sub_code in sub_codes_active:
        orders_for_active.append((o, odt))

print(f"Orders in window matching the 104 active subs: {len(orders_for_active)}")

# What about subs whose renewalDate was shifted to Sep 23 - Oct 7?
# i.e., subs with renewalDate between 2026-09-23 and 2026-10-07!
next_month_start = datetime(2026, 9, 23, 0, 0, 0, tzinfo=timezone.utc)
next_month_end = datetime(2026, 10, 7, 23, 59, 59, tzinfo=timezone.utc)
renewed_next_month = [s for s in subs if parse_dt(s.get('renewalDate')) and next_month_start <= parse_dt(s.get('renewalDate')) <= next_month_end]
print(f"Subs with renewalDate between 2026-09-23 and 2026-10-07 (likely successfully renewed in our window): {len(renewed_next_month)}")
renewed_active = [s for s in renewed_next_month if s.get('status') == 'active']
print(f"  Of which active: {len(renewed_active)}")
