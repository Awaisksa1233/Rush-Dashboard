import os
import sys
import json
import csv
from datetime import datetime, timezone
from collections import defaultdict

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

# 1. Map all renewal orders
renewal_orders_by_sub = defaultdict(list)
for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if odt and start_dt <= odt <= end_dt:
        if o.get('isRenewal') or o.get('subscriptionTransitionKind') == 'renewal':
            sc = o.get('subscriptionReadableCode') or o.get('subCode')
            if sc:
                renewal_orders_by_sub[sc].append((o, odt))

successful_subs = set()
for sc, o_list in renewal_orders_by_sub.items():
    for o, odt in o_list:
        is_paid = (o.get('status') in ['paid', 'completed']) or any(p.get('status') == 'paid' for p in o.get('payments', []))
        if is_paid:
            successful_subs.add(sc)
            break

# 2. Extract the 566 unrenewed subscriptions
unrenewed_rows = []

for s in subs:
    rd = parse_dt(s.get('renewalDate'))
    if rd and start_dt <= rd <= end_dt:
        sc = s.get('readableCode')
        if sc in successful_subs:
            continue
            
        # Extract plate
        v_links = s.get('vehicleLinks', [])
        plates = []
        for vl in v_links:
            snap = vl.get('snapshot', {})
            p = snap.get('displayPlate') or snap.get('normalizedPlate')
            if p:
                plates.append(p)
        plate_str = ", ".join(plates) if plates else "N/A"
        
        # Extract renewal failed date
        # Check failed orders
        failed_orders = renewal_orders_by_sub.get(sc, [])
        failed_dt = None
        failure_reason = s.get('lastRenewalFailureReason')
        
        if failed_orders:
            # find latest failed order
            failed_orders.sort(key=lambda x: x[1], reverse=True)
            failed_dt = failed_orders[0][1]
            if not failure_reason:
                payments = failed_orders[0][0].get('payments', [])
                for p in payments:
                    if p.get('failureReason'):
                        failure_reason = p.get('failureReason')
                        break
        
        if not failed_dt:
            # Check s.firstRenewalFailureAt or s.updatedAt if status is expired
            ff_at = parse_dt(s.get('firstRenewalFailureAt'))
            if ff_at:
                failed_dt = ff_at
            elif s.get('status') in ['expired', 'terminated']:
                failed_dt = parse_dt(s.get('updatedAt'))
            elif s.get('status') == 'cancelled_voluntary':
                failed_dt = parse_dt(s.get('cancelledAt') or s.get('updatedAt'))
        
        csnap = s.get('customerSnapshot', {})
        cust_name = csnap.get('name') or "Unknown"
        phone = csnap.get('phone') or "N/A"
        
        renew_date_str = rd.strftime('%Y-%m-%d')
        if not failed_dt and s.get('status') == 'active':
            failed_date_str = f"{renew_date_str} (Lapsed/Uncharged)"
        else:
            failed_date_str = failed_dt.strftime('%Y-%m-%d %H:%M') if failed_dt else "N/A"
        
        unrenewed_rows.append({
            'sub_code': sc,
            'plate': plate_str,
            'renew_date': renew_date_str,
            'status': s.get('status'),
            'failed_date': failed_date_str,
            'failure_reason': failure_reason or "N/A",
            'price': s.get('price', 0),
            'customer': cust_name,
            'phone': phone,
            'plan': s.get('packageNameEn', 'N/A')
        })

print(f"Total unrenewed rows: {len(unrenewed_rows)}")
# Sort by renewal date
unrenewed_rows.sort(key=lambda x: x['renew_date'])

# Save to CSV
csv_path = os.path.join(os.path.dirname(__file__), '..', 'unrenewed_subscriptions_aug23_sep07.csv')
with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.writer(f)
    writer.writerow(['Subscription Code', 'Plate', 'Renew Date', 'Status', 'Renewal Failed Date', 'Failure Reason', 'Price (SAR)', 'Customer Name', 'Phone', 'Plan'])
    for r in unrenewed_rows:
        writer.writerow([r['sub_code'], r['plate'], r['renew_date'], r['status'], r['failed_date'], r['failure_reason'], r['price'], r['customer'], r['phone'], r['plan']])

print(f"Saved to CSV: {csv_path}")

# Print sample 15
print("\nSample 15 rows:")
for r in unrenewed_rows[:15]:
    print(f"Plate: {r['plate']} | Renew: {r['renew_date']} | Status: {r['status']} | Failed: {r['failed_date']} | Reason: {r['failure_reason']}")
