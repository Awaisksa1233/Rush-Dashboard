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

subs = load_collection('rushwash_subscriptions')
orders = load_collection('rushwash_sale_orders')

start_dt = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)
end_dt = datetime(2026, 9, 7, 23, 59, 59, tzinfo=timezone.utc)

# Group renewal orders by subscription code
sub_orders = defaultdict(list)
for o in orders:
    if o.get('isRenewal') or o.get('subscriptionTransitionKind') == 'renewal':
        odt = parse_dt(o.get('createdAt'))
        sc = o.get('subscriptionReadableCode') or o.get('subCode')
        if sc and odt:
            sub_orders[sc].append((o, odt))

# Sort each subscription's orders chronologically
for sc in sub_orders:
    sub_orders[sc].sort(key=lambda x: x[1])

# Analyze in window:
# Which subscriptions had their first attempt in the window, and what happened on attempts 1, 2, 3, 4?
cohort_sub_results = {}
for sc, o_list in sub_orders.items():
    # Filter orders in or near window
    window_orders = [(o, odt) for o, odt in o_list if odt >= start_dt]
    if not window_orders:
        continue
    
    # Trace attempts
    attempt_records = []
    for idx, (o, odt) in enumerate(window_orders):
        is_paid = (o.get('status') in ['paid', 'completed']) or any(p.get('status') == 'paid' for p in o.get('payments', []))
        failure_reason = None
        for p in o.get('payments', []):
            if p.get('failureReason'):
                failure_reason = p.get('failureReason')
                break
        if not failure_reason:
            failure_reason = o.get('notes') or o.get('status')
            
        attempt_records.append({
            'attempt': idx + 1,
            'date': odt,
            'paid': is_paid,
            'reason': failure_reason if not is_paid else 'SUCCESS',
            'orderCode': o.get('readableCode')
        })
    cohort_sub_results[sc] = attempt_records

# Let's see:
# 1. Total subscriptions with at least 1 attempt in window
# 2. How many succeeded on attempt 1?
# 3. For those that failed attempt 1:
#    - How many were retried?
#    - How many succeeded on attempt 2?
#    - How many failed attempt 2?
# 4. For those that failed attempt 2:
#    - How many succeeded on attempt 3?
#    - How many failed attempt 3?

total_subs_attempted = len(cohort_sub_results)
succeeded_att_1 = 0
failed_att_1 = 0

retried_att_2 = 0
succeeded_att_2 = 0
failed_att_2 = 0

retried_att_3 = 0
succeeded_att_3 = 0
failed_att_3 = 0

retried_att_4_plus = 0
succeeded_att_4_plus = 0
failed_att_4_plus = 0

delays_between_1_and_2 = []
delays_between_2_and_3 = []

for sc, atts in cohort_sub_results.items():
    if atts[0]['paid']:
        succeeded_att_1 += 1
    else:
        failed_att_1 += 1
        if len(atts) > 1:
            retried_att_2 += 1
            delta = (atts[1]['date'] - atts[0]['date']).total_seconds() / 3600.0
            delays_between_1_and_2.append(delta)
            if atts[1]['paid']:
                succeeded_att_2 += 1
            else:
                failed_att_2 += 1
                if len(atts) > 2:
                    retried_att_3 += 1
                    delta2 = (atts[2]['date'] - atts[1]['date']).total_seconds() / 3600.0
                    delays_between_2_and_3.append(delta2)
                    if atts[2]['paid']:
                        succeeded_att_3 += 1
                    else:
                        failed_att_3 += 1
                        if len(atts) > 3:
                            retried_att_4_plus += 1
                            if any(a['paid'] for a in atts[3:]):
                                succeeded_att_4_plus += 1
                            else:
                                failed_att_4_plus += 1

print(f"Total subscriptions attempted in window: {total_subs_attempted}")
print(f"Attempt 1: Succeeded={succeeded_att_1} ({succeeded_att_1/total_subs_attempted*100:.1f}%), Failed={failed_att_1}")
print(f"Attempt 2: Retried={retried_att_2} (out of {failed_att_1} failed), Succeeded={succeeded_att_2} (Conversion: {succeeded_att_2/retried_att_2*100:.1f}%), Failed={failed_att_2}")
print(f"Attempt 3: Retried={retried_att_3} (out of {failed_att_2} failed), Succeeded={succeeded_att_3} (Conversion: {succeeded_att_3/retried_att_3*100:.1f}%), Failed={failed_att_3}")
print(f"Attempt 4+: Retried={retried_att_4_plus}, Succeeded={succeeded_att_4_plus}, Failed={failed_att_4_plus}")

if delays_between_1_and_2:
    avg_delay_1_2 = sum(delays_between_1_and_2) / len(delays_between_1_and_2)
    print(f"\nAverage delay between Attempt 1 and 2: {avg_delay_1_2:.1f} hours ({avg_delay_1_2/24:.1f} days)")
if delays_between_2_and_3:
    avg_delay_2_3 = sum(delays_between_2_and_3) / len(delays_between_2_and_3)
    print(f"Average delay between Attempt 2 and 3: {avg_delay_2_3:.1f} hours ({avg_delay_2_3/24:.1f} days)")

# Check success by initial failure reason on retry
print("\n--- Recovery on Retry by Initial Failure Reason ---")
initial_reason_recovery = defaultdict(lambda: {'retried': 0, 'recovered': 0})
for sc, atts in cohort_sub_results.items():
    if not atts[0]['paid']:
        reason = atts[0]['reason']
        # normalize reason
        if 'INSUFFICIENT' in reason: r_cat = 'INSUFFICIENT FUNDS'
        elif 'INVALID' in reason: r_cat = 'INVALID CARD'
        elif 'HONOUR' in reason: r_cat = 'DO NOT HONOUR'
        elif 'RESTRICTED' in reason: r_cat = 'RESTRICTED CARD'
        elif 'DECLINED' in reason: r_cat = 'DECLINED'
        elif 'EXPIRED' in reason: r_cat = 'EXPIRED CARD'
        elif 'MALFUNCTION' in reason: r_cat = 'SYSTEM MALFUNCTION'
        elif 'renewal_charge_unavailable' in reason: r_cat = 'renewal_charge_unavailable'
        else: r_cat = reason[:30]
        
        if len(atts) > 1:
            initial_reason_recovery[r_cat]['retried'] += 1
            if any(a['paid'] for a in atts[1:]):
                initial_reason_recovery[r_cat]['recovered'] += 1

for r_cat, data in sorted(initial_reason_recovery.items(), key=lambda x: x[1]['retried'], reverse=True):
    rec_pct = (data['recovered'] / data['retried'] * 100) if data['retried'] > 0 else 0
    print(f"  {r_cat}: Retried={data['retried']}, Recovered={data['recovered']} ({rec_pct:.1f}%)")
