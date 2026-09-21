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

def get_oid(val):
    if not val:
        return None
    if isinstance(val, dict):
        return val.get('$oid') or str(val)
    return str(val)

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
customers = load_collection('rushwash_customers')

cust_by_id = {get_oid(c.get('_id')): c for c in customers}

start_dt = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)
end_dt = datetime(2026, 9, 7, 23, 59, 59, tzinfo=timezone.utc)

# 101 overdue active
overdue_active = []
for s in subs:
    if s.get('status') == 'active':
        rd = parse_dt(s.get('renewalDate'))
        if rd and start_dt <= rd <= end_dt:
            overdue_active.append((s, rd))

print(f"101 Overdue Active Subscriptions:")
# Check renewalDate distribution
rd_dist = Counter(rd.strftime('%Y-%m-%d') for _, rd in overdue_active)
for d, cnt in sorted(rd_dist.items()):
    print(f"  {d}: {cnt} subs")

# Check tokens and check why they didn't renew
print("\nChecking token details on these 101:")
has_tok = []
no_tok = []
for s, rd in overdue_active:
    pmu = s.get('paymentMethodUsed') or {}
    cid = get_oid(s.get('customerId'))
    cust = cust_by_id.get(cid) or {}
    c_insts = cust.get('moyasarPaymentInstruments') or []
    
    tid = pmu.get('tokenId') or (c_insts[0].get('tokenId') if c_insts else None)
    if tid:
        has_tok.append((s, rd, tid, pmu.get('brand') or (c_insts[0].get('brand') if c_insts else 'N/A')))
    else:
        no_tok.append((s, rd))

print(f"  Has Token: {len(has_tok)}")
print(f"  No Token:  {len(no_tok)}")

# For the 90 that have token, check if there was any order in history for this sub!
orders_by_sub = defaultdict(list)
for o in orders:
    sc = o.get('subscriptionReadableCode') or o.get('subCode')
    if sc:
        orders_by_sub[sc].append(o)

print("\nFor the 90 with token, did they have any order in rushwash_sale_orders?")
had_order = 0
zero_orders = 0
order_statuses = Counter()
for s, rd, tid, brand in has_tok:
    sc = s.get('readableCode')
    sub_orders = orders_by_sub.get(sc, [])
    if sub_orders:
        had_order += 1
        for o in sub_orders:
            order_statuses[o.get('status')] += 1
    else:
        zero_orders += 1

print(f"  Had order in history: {had_order}")
print(f"  Zero orders in history: {zero_orders}")
print("  Order statuses if any:", dict(order_statuses))

# Let's inspect sample 5 of the zero_orders ones
print("\nSample of overdue active subs with token but 0 orders:")
count = 0
for s, rd, tid, brand in has_tok:
    sc = s.get('readableCode')
    if not orders_by_sub.get(sc):
        vlinks = s.get('vehicleLinks', [])
        p = vlinks[0].get('snapshot', {}).get('displayPlate') if vlinks else 'N/A'
        csnap = s.get('customerSnapshot') or {}
        print(f"  Sub: {sc} | Plate: {p} | Cust: {csnap.get('name')} | Plan: {s.get('packageNameEn')} | Price: SAR {s.get('price')} | Due: {rd.strftime('%Y-%m-%d %H:%M')} | Token: {tid[:15]}... ({brand})")
        count += 1
        if count >= 8:
            break
