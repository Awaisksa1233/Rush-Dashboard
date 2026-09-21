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
customers = load_collection('rushwash_customers')
vehicles = load_collection('rushwash_vehicles')

start_dt = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)
end_dt = datetime(2026, 9, 7, 23, 59, 59, tzinfo=timezone.utc)

print(f"Loaded: {len(subs)} subs, {len(orders)} orders, {len(customers)} customers, {len(vehicles)} vehicles")

# Build maps
cust_map = {get_oid(c.get('_id')): c for c in customers}
sub_by_code = {s.get('readableCode'): s for s in subs}
sub_by_id = {get_oid(s.get('_id')): s for s in subs}

# Analyze all renewal orders in this window
orders_in_window = []
renewal_orders_in_window = []
for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if odt and start_dt <= odt <= end_dt:
        orders_in_window.append((o, odt))
        if o.get('isRenewal') or o.get('subscriptionTransitionKind') == 'renewal':
            renewal_orders_in_window.append((o, odt))

print(f"\nTotal orders in window (Aug 23 - Sep 7): {len(orders_in_window)}")
print(f"Renewal orders in window: {len(renewal_orders_in_window)}")

# Check renewal order status and payments
renewal_sub_codes_paid = set()
renewal_sub_codes_failed = set()
order_status_counts = Counter()
payment_status_counts = Counter()

for o, odt in renewal_orders_in_window:
    sub_code = o.get('subscriptionReadableCode') or o.get('subCode')
    st = o.get('status')
    order_status_counts[st] += 1
    
    payments = o.get('payments') or []
    has_paid_payment = any(p.get('status') == 'paid' for p in payments)
    for p in payments:
        payment_status_counts[p.get('status')] += 1
        
    if has_paid_payment or st in ['paid', 'completed']:
        if sub_code:
            renewal_sub_codes_paid.add(sub_code)
    else:
        if sub_code:
            renewal_sub_codes_failed.add(sub_code)

print("\nRenewal order status counts:", dict(order_status_counts))
print("Renewal order payment status counts:", dict(payment_status_counts))
print(f"Unique sub codes with PAID renewal order: {len(renewal_sub_codes_paid)}")
print(f"Unique sub codes with FAILED renewal order (and no paid): {len(renewal_sub_codes_failed - renewal_sub_codes_paid)}")

# Now let's analyze subscriptions
# A subscription was supposed to renew between Aug 23 and Sep 7 if:
# CASE A: its current renewalDate is in [Aug 23, Sep 7]
# CASE B: it had a renewal order attempted in [Aug 23, Sep 7]
# CASE C: its current renewalDate is in [Sep 23, Oct 7] AND it was renewed during [Aug 23, Sep 7]
# Let's inspect all subs with renewalDate in [Aug 23, Sep 7]
subs_due_in_window = []
for s in subs:
    rd = parse_dt(s.get('renewalDate'))
    if rd and start_dt <= rd <= end_dt:
        subs_due_in_window.append(s)

print(f"\nSubscriptions currently showing renewalDate between Aug 23 and Sep 7: {len(subs_due_in_window)}")

# For these subs, check how many renewed vs not renewed
not_renewed_list = []
renewed_list = []

for s in subs_due_in_window:
    code = s.get('readableCode')
    if code in renewal_sub_codes_paid:
        renewed_list.append(s)
    else:
        not_renewed_list.append(s)

print(f"  Of those with renewalDate in [Aug 23, Sep 7]:")
print(f"    Renewed (has paid renewal order): {len(renewed_list)}")
print(f"    NOT Renewed (no paid renewal order): {len(not_renewed_list)}")

# Breakdown of NOT renewed:
not_renewed_status = Counter(s.get('status') for s in not_renewed_list)
print("\nStatus breakdown of NOT renewed (renewalDate in window):")
for st, cnt in not_renewed_status.most_common():
    print(f"  {st}: {cnt}")

not_renewed_reasons = Counter(s.get('lastRenewalFailureReason') for s in not_renewed_list)
print("\nFailure reasons of NOT renewed:")
for r, cnt in not_renewed_reasons.most_common(10):
    print(f"  {r}: {cnt}")
