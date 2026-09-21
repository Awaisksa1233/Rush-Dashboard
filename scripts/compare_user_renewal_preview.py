import os
import sys
import json
import csv
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

sub_by_code = {s.get('readableCode'): s for s in subs}
cust_by_id = {get_oid(c.get('_id')): c for c in customers}

# Map orders by subscription readableCode
orders_by_sub = defaultdict(list)
for o in orders:
    sc = o.get('subscriptionReadableCode') or o.get('subCode')
    if sc:
        orders_by_sub[sc].append(o)

# Read user CSV
user_csv_path = os.path.join(os.path.dirname(__file__), '..', 'scratch_user_renewal_preview.csv')
with open(user_csv_path, 'r', encoding='utf-8-sig') as f:
    user_rows = list(csv.DictReader(f))

print(f"Loaded {len(user_rows)} rows from user renewal preview.")

# Analysis buckets
outcome_counts = Counter(r['outcome'] for r in user_rows)
reason_counts = Counter(r['reason'] for r in user_rows)
status_csv_counts = Counter(r['status'] for r in user_rows)

print("\n--- USER CSV SUMMARY ---")
print("Outcome breakdown:", dict(outcome_counts))
print("Reason breakdown:", dict(reason_counts))
print("Status breakdown in CSV:", dict(status_csv_counts))

# Compare each row with DB
comparisons = []
for r in user_rows:
    sc = r['subscription_code']
    s = sub_by_code.get(sc)
    sub_orders = orders_by_sub.get(sc, [])
    
    db_status = s.get('status') if s else 'NOT_FOUND_IN_DB'
    db_rd = parse_dt(s.get('renewalDate')) if s else None
    db_rd_str = db_rd.strftime('%Y-%m-%d %H:%M') if db_rd else 'N/A'
    csv_rd = r['next_renewal_date'][:16].replace('T', ' ')
    
    # Check if any order was executed in the current renewal cycle (on or after 2026-08-15)
    cycle_orders = []
    has_cycle_paid = False
    has_cycle_failed = False
    latest_cycle_order = 'None'
    
    for o in sub_orders:
        odt = parse_dt(o.get('createdAt'))
        if odt and odt >= datetime(2026, 8, 15, tzinfo=timezone.utc):
            cycle_orders.append((o, odt))
            
    if cycle_orders:
        cycle_orders.sort(key=lambda x: x[1], reverse=True)
        latest_o, lo_dt = cycle_orders[0]
        lo_dt_str = lo_dt.strftime('%Y-%m-%d %H:%M')
        
        payments = latest_o.get('payments', [])
        p_status = payments[0].get('status') if payments else latest_o.get('status')
        p_reason = payments[0].get('failureReason') if payments else latest_o.get('notes')
        
        for o, _ in cycle_orders:
            if o.get('status') in ['paid', 'completed'] or any(p.get('status') == 'paid' for p in o.get('payments', [])):
                has_cycle_paid = True
                break
        if not has_cycle_paid:
            has_cycle_failed = True
            
        latest_cycle_order = f"{latest_o.get('readableCode')} ({lo_dt_str}) status={latest_o.get('status')} p_status={p_status} reason={p_reason}"
    
    # Token match check
    csv_token = r['payment_token'].strip()
    db_token = (s.get('paymentMethodUsed', {}).get('tokenId') or '') if s else ''
    if not db_token and s:
        cid = get_oid(s.get('customerId'))
        cust = cust_by_id.get(cid)
        if cust and cust.get('moyasarPaymentInstruments'):
            db_token = cust['moyasarPaymentInstruments'][0].get('tokenId', '')
            
    token_match = (csv_token == db_token) if csv_token else (not db_token)
    
    # Renewal date advanced check
    date_advanced = False
    if db_rd and r['next_renewal_date']:
        csv_dt = parse_dt(r['next_renewal_date'])
        if csv_dt and db_rd > csv_dt:
            date_advanced = True

    comparisons.append({
        'subscription_code': sc,
        'plate': r['vehicles'],
        'customer_name': r['customer_name'],
        'phone': r['phone'],
        'plan_csv': r['plan'],
        'plan_db': s.get('packageNameEn') if s else 'N/A',
        'csv_status': r['status'],
        'db_status': db_status,
        'csv_outcome': r['outcome'],
        'csv_reason': r['reason'],
        'csv_rd': csv_rd,
        'db_rd': db_rd_str,
        'date_advanced': date_advanced,
        'has_orders': len(sub_orders) > 0,
        'order_count': len(sub_orders),
        'has_cycle_orders': len(cycle_orders) > 0,
        'has_cycle_paid': has_cycle_paid,
        'has_cycle_failed': has_cycle_failed,
        'latest_cycle_order': latest_cycle_order,
        'csv_token': csv_token,
        'db_token': db_token,
        'token_match': token_match,
        'csv_price': r['this_post_vat'],
        'db_price': s.get('price') if s else 0
    })

print(f"\n--- DATABASE COMPARISON RESULTS ({len(comparisons)} subscriptions) ---")

# 1. DB Status vs CSV Status
status_match = sum(1 for c in comparisons if c['csv_status'] == c['db_status'])
status_mismatch = sum(1 for c in comparisons if c['csv_status'] != c['db_status'])
print(f"Status Match: {status_match}/{len(comparisons)}")
print(f"Status Mismatch: {status_mismatch}/{len(comparisons)}")
if status_mismatch > 0:
    print("Mismatches breakdown:")
    for c in comparisons:
        if c['csv_status'] != c['db_status']:
            print(f"  {c['subscription_code']}: CSV='{c['csv_status']}' vs DB='{c['db_status']}' (outcome: {c['csv_outcome']}, DB renewalDate: {c['db_rd']})")

# 2. Orders & Execution analysis
with_orders = [c for c in comparisons if c['has_orders']]
without_orders = [c for c in comparisons if not c['has_orders']]
print(f"\nOrders in DB for these subscriptions: {len(with_orders)} have orders, {len(without_orders)} have 0 orders")

# 3. For rows where outcome == 'would_charge'
would_charge = [c for c in comparisons if c['csv_outcome'] == 'would_charge']
print(f"\nOf the {len(would_charge)} subscriptions where CSV outcome is 'would_charge':")
wc_with_paid = [c for c in would_charge if c['has_cycle_paid']]
wc_with_orders_unpaid = [c for c in would_charge if c['has_cycle_failed']]
wc_no_orders = [c for c in would_charge if not c['has_cycle_orders']]
wc_date_advanced = [c for c in would_charge if c['date_advanced']]

print(f"  -> Successfully charged in this cycle:           {len(wc_with_paid)}")
print(f"  -> RenewalDate advanced in DB (renewed):          {len(wc_date_advanced)}")
print(f"  -> Attempted in DB but FAILED / CANCELLED:        {len(wc_with_orders_unpaid)}")
print(f"  -> ZERO orders in DB (Never executed / dry-run): {len(wc_no_orders)}")

# 4. For rows where outcome == 'skipped' and reason == 'not_due'
skipped_rows = [c for c in comparisons if c['csv_outcome'] == 'skipped']
print(f"\nOf the {len(skipped_rows)} subscriptions where CSV outcome is 'skipped' (reason='not_due'):")
print(f"  -> DB status breakdown: {dict(Counter(c['db_status'] for c in skipped_rows))}")
print(f"  -> Did any date advance? {sum(1 for c in skipped_rows if c['date_advanced'])}")
print(f"  -> Sample skipped rows in CSV vs DB:")
for c in skipped_rows[:5]:
    print(f"     {c['subscription_code']}: CSV_status={c['csv_status']}, DB_status={c['db_status']}, CSV_date={c['csv_rd']}, DB_date={c['db_rd']}")

# 5. Token comparison
token_matches = sum(1 for c in comparisons if c['token_match'])
print(f"\nToken Match between CSV and DB: {token_matches}/{len(comparisons)}")
token_mismatches = [c for c in comparisons if not c['token_match']]
if token_mismatches:
    print(f"Token Mismatches ({len(token_mismatches)}):")
    for c in token_mismatches[:5]:
        print(f"  {c['subscription_code']}: CSV='{c['csv_token']}' vs DB='{c['db_token']}'")

# Save full comparison report
comp_csv_path = os.path.join(os.path.dirname(__file__), '..', 'renewal_preview_comparison_report.csv')
with open(comp_csv_path, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=list(comparisons[0].keys()))
    writer.writeheader()
    writer.writerows(comparisons)

print(f"\nFull comparison saved to: {comp_csv_path}")
