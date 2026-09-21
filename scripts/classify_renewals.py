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

# 1. Map all renewal orders in window
renewal_orders = []
for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if odt and start_dt <= odt <= end_dt:
        if o.get('isRenewal') or o.get('subscriptionTransitionKind') == 'renewal':
            renewal_orders.append((o, odt))

sub_code_to_orders = defaultdict(list)
for o, odt in renewal_orders:
    sub_code = o.get('subscriptionReadableCode') or o.get('subCode')
    if sub_code:
        sub_code_to_orders[sub_code].append(o)

# 2. Check all subs
# Cohort 1: Current renewalDate is between Aug 23 and Sep 7
cohort_1_codes = set()
for s in subs:
    rd = parse_dt(s.get('renewalDate'))
    if rd and start_dt <= rd <= end_dt:
        cohort_1_codes.add(s.get('readableCode'))

# Cohort 2: Subscriptions that had renewal orders attempted between Aug 23 and Sep 7
cohort_2_codes = set(sub_code_to_orders.keys())

# Let's inspect subs in cohort_2 that are not in cohort_1
renewed_and_shifted = cohort_2_codes - cohort_1_codes
print(f"Total subs with current renewalDate in [Aug 23, Sep 7]: {len(cohort_1_codes)}")
print(f"Total subs with renewal orders in [Aug 23, Sep 7]: {len(cohort_2_codes)}")
print(f"Subs with renewal orders in window whose renewalDate is NO LONGER in [Aug 23, Sep 7]: {len(renewed_and_shifted)}")

# Check their new renewalDates
new_rds = []
sub_by_code = {s.get('readableCode'): s for s in subs}
for c in renewed_and_shifted:
    s = sub_by_code.get(c)
    if s:
        rd = parse_dt(s.get('renewalDate'))
        new_rds.append(rd)

print(f"Sample new renewal dates for shifted subs: {[d.strftime('%Y-%m-%d') for d in new_rds[:5] if d]}")

# Combine all subscriptions that were expected/due to renew in this window
all_due_sub_codes = cohort_1_codes.union(cohort_2_codes)
print(f"\nTOTAL unique subscriptions expected/scheduled to renew between Aug 23 and Sep 7: {len(all_due_sub_codes)}")

# Now classify each one:
# DID RENEW vs DID NOT RENEW
renewed = []
not_renewed = []

for code in all_due_sub_codes:
    s = sub_by_code.get(code)
    if not s:
        continue
    
    # Check if this sub has a paid renewal order in this window
    sub_orders = sub_code_to_orders.get(code, [])
    has_paid_renewal_order = False
    for o in sub_orders:
        if o.get('status') in ['paid', 'completed'] or any(p.get('status') == 'paid' for p in o.get('payments', [])):
            has_paid_renewal_order = True
            break
            
    # Also check if renewalDate was advanced to > Sep 7 and status is active
    rd = parse_dt(s.get('renewalDate'))
    date_advanced = (rd and rd > end_dt)
    
    if has_paid_renewal_order or (date_advanced and s.get('status') == 'active' and s.get('readableCode') in cohort_2_codes):
        renewed.append({
            'sub': s,
            'orders': sub_orders,
            'reason': 'Renewed successfully'
        })
    else:
        not_renewed.append({
            'sub': s,
            'orders': sub_orders,
            'renewalDate': rd,
            'status': s.get('status'),
            'failureReason': s.get('lastRenewalFailureReason'),
            'autoRenew': s.get('autoRenew')
        })

print(f"\n========================================================")
print(f"RESULTS FOR WINDOW: Aug 23, 2026 - Sep 07, 2026")
print(f"========================================================")
print(f"Total subscriptions due for renewal: {len(all_due_sub_codes)}")
print(f"-> Successfully renewed:             {len(renewed)}")
print(f"-> NOT renewed:                      {len(not_renewed)}")

not_renewed_status_breakdown = Counter(item['status'] for item in not_renewed)
print("\nStatus breakdown of NOT renewed subscriptions:")
for st, cnt in not_renewed_status_breakdown.most_common():
    print(f"  {st}: {cnt}")

not_renewed_order_attempts = Counter(len(item['orders']) > 0 for item in not_renewed)
print(f"\nDid they have an automated renewal order attempted?")
print(f"  Attempted but failed: {not_renewed_order_attempts[True]}")
print(f"  No renewal order attempted (e.g. autoRenew=False / cancelled / blocked): {not_renewed_order_attempts[False]}")
