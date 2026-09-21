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

cust_by_id = {get_oid(c.get('_id')): c for c in customers}

now = datetime(2026, 9, 8, 23, 59, 59, tzinfo=timezone.utc)

# Group renewal orders by subscription
renewal_orders = defaultdict(list)
for o in orders:
    if o.get('isRenewal') or o.get('subscriptionTransitionKind') == 'renewal':
        sc = o.get('subscriptionReadableCode') or o.get('subCode')
        odt = parse_dt(o.get('createdAt'))
        if sc and odt:
            renewal_orders[sc].append(odt)

# Active subs with renewalDate <= now
overdue_active = []
for s in subs:
    if s.get('status') == 'active':
        rd = parse_dt(s.get('renewalDate'))
        if rd and rd <= now:
            overdue_active.append((s, rd))

print(f"Total active subscriptions with renewalDate <= today (Sep 8): {len(overdue_active)}")

no_attempt = []
had_attempt = []
for s, rd in overdue_active:
    sc = s.get('readableCode')
    attempts = renewal_orders.get(sc, [])
    # Any renewal order on or after renewalDate
    attempts_on_or_after = [odt for odt in attempts if odt >= rd]
    if not attempts:
        no_attempt.append((s, rd, "Zero orders in history"))
    elif not attempts_on_or_after:
        no_attempt.append((s, rd, f"Prior cycle order only (latest: {max(attempts).strftime('%Y-%m-%d')})"))
    else:
        had_attempt.append((s, rd, max(attempts_on_or_after)))

print(f"Active subs overdue with NO renewal attempt for current cycle: {len(no_attempt)}")
print(f"Active subs overdue with renewal attempt already made: {len(had_attempt)}")

# Date distribution
date_counts = Counter(rd.strftime('%Y-%m-%d') for s, rd, _ in no_attempt)
print("\nRenewal Date distribution for unattempted active subs:")
for d, cnt in sorted(date_counts.items()):
    print(f"  {d}: {cnt} subscriptions")

# Check token coverage for unattempted active subs
has_token = 0
no_token = 0
for s, rd, _ in no_attempt:
    pmu = s.get('paymentMethodUsed') or {}
    cid = get_oid(s.get('customerId'))
    cust = cust_by_id.get(cid) or {}
    c_insts = cust.get('moyasarPaymentInstruments') or []
    tid = pmu.get('tokenId') or (c_insts[0].get('tokenId') if c_insts else None)
    if tid:
        has_token += 1
    else:
        no_token += 1

print(f"\nToken availability for unattempted active subs:")
print(f"  Has Token on file: {has_token} (Can be billed immediately)")
print(f"  NO Token on file:  {no_token} (Missing payment method)")

total_uncollected_mrr = sum(s.get('price', 0) for s, _, _ in no_attempt)
print(f"Total Uncollected MRR in unattempted batch: SAR {total_uncollected_mrr:,.2f}")
