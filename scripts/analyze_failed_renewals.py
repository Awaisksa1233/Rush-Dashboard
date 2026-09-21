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

start_dt = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)
end_dt = datetime(2026, 9, 7, 23, 59, 59, tzinfo=timezone.utc)

# 1. Analyze all renewal orders in target window AND historical
window_renewal_orders = []
all_renewal_orders = []

for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if o.get('isRenewal') or o.get('subscriptionTransitionKind') == 'renewal':
        all_renewal_orders.append((o, odt))
        if odt and start_dt <= odt <= end_dt:
            window_renewal_orders.append((o, odt))

print(f"Total historical renewal orders: {len(all_renewal_orders)}")
print(f"Renewal orders in window (Aug 23 - Sep 07): {len(window_renewal_orders)}")

# Analyze attempts in window
# In orders: payments array has attemptNumber, status, failureReason
attempts_by_number_window = defaultdict(lambda: {'total': 0, 'paid': 0, 'failed': 0, 'reasons': Counter()})
attempts_by_number_all = defaultdict(lambda: {'total': 0, 'paid': 0, 'failed': 0, 'reasons': Counter()})

for o, odt in window_renewal_orders:
    payments = o.get('payments', [])
    if not payments:
        # If no payments array, order itself might have status
        st = o.get('status')
        att_num = 1
        attempts_by_number_window[att_num]['total'] += 1
        if st in ['paid', 'completed']:
            attempts_by_number_window[att_num]['paid'] += 1
        else:
            attempts_by_number_window[att_num]['failed'] += 1
            attempts_by_number_window[att_num]['reasons']['NO_PAYMENTS_ARRAY'] += 1
    else:
        for p in payments:
            att_num = p.get('attemptNumber') or 1
            st = p.get('status')
            reason = p.get('failureReason') or p.get('description') or 'Unknown Failure'
            attempts_by_number_window[att_num]['total'] += 1
            if st == 'paid':
                attempts_by_number_window[att_num]['paid'] += 1
            else:
                attempts_by_number_window[att_num]['failed'] += 1
                attempts_by_number_window[att_num]['reasons'][reason] += 1

print("\n=== ATTEMPT DISTRIBUTION (Aug 23 - Sep 07) ===")
for att, data in sorted(attempts_by_number_window.items()):
    success_rate = (data['paid'] / data['total'] * 100) if data['total'] > 0 else 0
    print(f"Attempt #{att}: Total={data['total']}, Paid={data['paid']}, Failed={data['failed']} (Success Rate: {success_rate:.1f}%)")
    print("  Reasons for failure:")
    for r, cnt in data['reasons'].most_common(10):
        print(f"    - {r}: {cnt}")

# Also check how many times a SUBSCRIPTION was retried across multiple orders!
sub_to_orders_window = defaultdict(list)
for o, odt in window_renewal_orders:
    sc = o.get('subscriptionReadableCode') or o.get('subCode')
    if sc:
        sub_to_orders_window[sc].append((o, odt))

sub_retry_order_count = Counter(len(v) for v in sub_to_orders_window.values())
print("\nNumber of separate renewal orders generated per subscription in this window:")
for cnt, num_subs in sorted(sub_retry_order_count.items()):
    print(f"  {cnt} order(s): {num_subs} subscriptions")

# Let's inspect subscriptions with retryCount field
sub_retry_counts = Counter(s.get('retryCount') for s in subs)
print("\nSubscription `retryCount` field distribution in subs collection:")
for rc, count in sorted(sub_retry_counts.items(), key=lambda x: str(x[0])):
    print(f"  retryCount={rc}: {count} subscriptions")

# Let's check retryCount on expired vs active vs terminated
print("\nRetry count by status in target window unrenewed:")
unrenewed_in_window = [s for s in subs if parse_dt(s.get('renewalDate')) and start_dt <= parse_dt(s.get('renewalDate')) <= end_dt and s.get('status') != 'active']
rc_by_status = defaultdict(Counter)
for s in unrenewed_in_window:
    rc_by_status[s.get('status')][s.get('retryCount', 0)] += 1

for st, counts in rc_by_status.items():
    print(f"  Status: {st} -> {dict(counts)}")
