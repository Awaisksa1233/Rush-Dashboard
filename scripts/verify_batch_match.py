import json
import csv
from datetime import datetime, timezone
from collections import Counter

backup_dir = 'database/atlas_backup/latest/rushwash'
orders = json.load(open(backup_dir + '/rushwash_sale_orders.json', encoding='utf-8'))
subs = json.load(open(backup_dir + '/rushwash_subscriptions.json', encoding='utf-8'))
sub_by_code = {s.get('readableCode'): s for s in subs}

def parse_dt(v):
    if not v: return None
    if isinstance(v, dict): v = v.get('$date')
    if not v: return None
    try:
        return datetime.fromisoformat(str(v).replace('Z', '+00:00'))
    except: return None

# Filter orders created last night >= 2026-09-08T23:00:00Z
batch_start = datetime(2026, 9, 8, 23, 0, 0, tzinfo=timezone.utc)
batch_orders = [o for o in orders if parse_dt(o.get('createdAt')) and parse_dt(o.get('createdAt')) >= batch_start]

print(f"Total orders created in last night's batch (>= 23:00 UTC): {len(batch_orders)}")

order_by_sub = {}
for o in batch_orders:
    sc = o.get('subscriptionReadableCode') or o.get('subCode')
    if sc:
        order_by_sub[sc] = o

# Load user preview
with open('scratch_user_renewal_preview.csv', encoding='utf-8-sig') as f:
    user_rows = list(csv.DictReader(f))

print(f"Total rows in user preview: {len(user_rows)}")

matched_in_batch = 0
paid_in_batch = 0
failed_in_batch = 0
not_in_batch = 0

batch_details = []

for r in user_rows:
    sc = r['subscription_code']
    o = order_by_sub.get(sc)
    s = sub_by_code.get(sc)
    
    if o:
        matched_in_batch += 1
        st = o.get('status')
        payments = o.get('payments', [])
        p_status = payments[0].get('status') if payments else st
        p_reason = payments[0].get('failureReason') if payments else 'None'
        p_amt = o.get('postDiscountTotal') or (payments[0].get('amount') if payments else 0)
        
        is_paid = (st in ['paid', 'completed']) or (p_status == 'paid')
        if is_paid:
            paid_in_batch += 1
        else:
            failed_in_batch += 1
            
        batch_details.append({
            'sub_code': sc,
            'plate': r['vehicles'],
            'customer': r['customer_name'],
            'phone': r['phone'],
            'preview_outcome': r['outcome'],
            'preview_reason': r['reason'],
            'order_code': o.get('readableCode'),
            'order_status': st,
            'payment_status': p_status,
            'failure_reason': p_reason,
            'amount': p_amt,
            'db_sub_status': s.get('status') if s else 'N/A',
            'new_renewal_date': s.get('renewalDate', {}).get('$date') if isinstance(s.get('renewalDate'), dict) else str(s.get('renewalDate', ''))
        })
    else:
        not_in_batch += 1
        batch_details.append({
            'sub_code': sc,
            'plate': r['vehicles'],
            'customer': r['customer_name'],
            'phone': r['phone'],
            'preview_outcome': r['outcome'],
            'preview_reason': r['reason'],
            'order_code': 'NONE_CREATED',
            'order_status': 'NOT_EXECUTED',
            'payment_status': 'N/A',
            'failure_reason': 'Order not created',
            'amount': r['this_post_vat'],
            'db_sub_status': s.get('status') if s else 'N/A',
            'new_renewal_date': s.get('renewalDate', {}).get('$date') if isinstance(s.get('renewalDate'), dict) else str(s.get('renewalDate', ''))
        })

print(f"\nResults of matching user preview to last night's batch:")
print(f"  Matched to an order in batch:   {matched_in_batch}")
print(f"    - PAID (Successful):          {paid_in_batch}")
print(f"    - FAILED (Payment Declined):  {failed_in_batch}")
print(f"  NOT in batch (No order created): {not_in_batch}")

# Breakdown of failure reasons in batch
fail_reasons = Counter(b['failure_reason'] for b in batch_details if b['payment_status'] != 'paid' and b['order_code'] != 'NONE_CREATED')
print("\nFailure reasons in batch:")
for r, cnt in fail_reasons.most_common():
    print(f"  {r}: {cnt}")

# Breakdown of the not_in_batch
not_in_batch_reasons = Counter((b['preview_outcome'], b['preview_reason']) for b in batch_details if b['order_code'] == 'NONE_CREATED')
print("\nBreakdown of the not_in_batch items:")
for k, cnt in not_in_batch_reasons.items():
    print(f"  {k}: {cnt}")

# Save detailed batch comparison to CSV
with open('batch_execution_comparison.csv', 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=list(batch_details[0].keys()))
    writer.writeheader()
    writer.writerows(batch_details)

print("\nSaved detailed comparison to batch_execution_comparison.csv")
