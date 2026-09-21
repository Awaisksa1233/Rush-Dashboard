import os
import sys
import json
from datetime import datetime, timezone
from collections import Counter, defaultdict

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

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

start_dt = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)
end_dt = datetime(2026, 9, 7, 23, 59, 59, tzinfo=timezone.utc)

sub_by_code = {s.get('readableCode'): s for s in subs}
cust_by_id = {get_oid(c.get('_id')): c for c in customers}

# Check successful renewal orders between Aug 23 and Sep 7
renewal_orders = []
for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if odt and start_dt <= odt <= end_dt:
        if o.get('isRenewal') or o.get('subscriptionTransitionKind') == 'renewal':
            renewal_orders.append((o, odt))

successful_renewals = []
failed_renewals = []

for o, odt in renewal_orders:
    sub_code = o.get('subscriptionReadableCode') or o.get('subCode')
    is_paid = (o.get('status') in ['paid', 'completed']) or any(p.get('status') == 'paid' for p in o.get('payments', []))
    if is_paid:
        successful_renewals.append((o, odt, sub_code))
    else:
        failed_renewals.append((o, odt, sub_code))

print(f"Total renewal order attempts: {len(renewal_orders)}")
print(f"  Successful (Paid): {len(successful_renewals)}")
print(f"  Failed / Cancelled: {len(failed_renewals)}")

# Unique subscriptions
successful_subs = {sub_code for _, _, sub_code in successful_renewals if sub_code}
failed_only_subs = {sub_code for _, _, sub_code in failed_renewals if sub_code} - successful_subs

print(f"\nUnique subscriptions successfully renewed via orders: {len(successful_subs)}")
print(f"Unique subscriptions with failed renewal attempts (and no success): {len(failed_only_subs)}")

# Check renewalDate for successful subs
sample_successful = list(successful_subs)[:5]
print("\nSample successful subs and their current renewalDate:")
for sc in sample_successful:
    s = sub_by_code.get(sc)
    if s:
        print(f"  {sc}: status={s.get('status')}, renewalDate={s.get('renewalDate')}")

# Now, let's look at all subscriptions whose scheduled renewal fell into Aug 23 - Sep 7
# A sub was scheduled to renew in Aug 23 - Sep 7 if:
# 1. It successfully renewed via an order in Aug 23 - Sep 7 (it was due then, and renewed)
# 2. OR its current renewalDate is in [Aug 23, Sep 7] (it was due, but didn't renew or advance)
scheduled_and_renewed = successful_subs
scheduled_and_not_renewed = []

for s in subs:
    rd = parse_dt(s.get('renewalDate'))
    if rd and start_dt <= rd <= end_dt:
        sc = s.get('readableCode')
        if sc not in successful_subs:
            scheduled_and_not_renewed.append(s)

total_scheduled = len(scheduled_and_renewed) + len(scheduled_and_not_renewed)
print(f"\n========================================================")
print(f"COHORT ANALYSIS: Subscriptions Scheduled to Renew Aug 23 - Sep 07")
print(f"========================================================")
print(f"Total Subscriptions Scheduled to Renew: {total_scheduled}")
print(f"  - Successfully Renewed:               {len(scheduled_and_renewed)} ({len(scheduled_and_renewed)/total_scheduled*100:.1f}%)")
print(f"  - NOT Renewed:                        {len(scheduled_and_not_renewed)} ({len(scheduled_and_not_renewed)/total_scheduled*100:.1f}%)")

# Detailed breakdown of scheduled_and_not_renewed
print(f"\nBreakdown of the {len(scheduled_and_not_renewed)} that did NOT renew:")
status_counts = Counter(s.get('status') for s in scheduled_and_not_renewed)
for st, cnt in status_counts.most_common():
    print(f"  Status '{st}': {cnt}")

failure_counts = Counter(s.get('lastRenewalFailureReason') for s in scheduled_and_not_renewed)
print("\nRecorded failure reasons:")
for r, cnt in failure_counts.most_common():
    print(f"  {r}: {cnt}")

# Also calculate lost revenue (sum of prices)
lost_revenue = sum(s.get('price', 0) for s in scheduled_and_not_renewed)
renewed_revenue = sum(sub_by_code[sc].get('price', 0) for sc in scheduled_and_renewed if sc in sub_by_code)
print(f"\nFinancial Impact:")
print(f"  Successfully Renewed Revenue: SAR {renewed_revenue:,.2f}")
print(f"  Uncollected / Lost Revenue:   SAR {lost_revenue:,.2f}")
