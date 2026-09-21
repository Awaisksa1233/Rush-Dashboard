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

start_dt = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)
end_dt = datetime(2026, 9, 8, 23, 59, 59, tzinfo=timezone.utc)

# 1. Orders attempted in window
order_subs_window = set()
for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if odt and start_dt <= odt <= end_dt:
        sc = o.get('subscriptionReadableCode') or o.get('subCode')
        if sc:
            order_subs_window.add(sc)

# 2. Subscriptions whose scheduled renewal date falls in this window
due_subs = []
for s in subs:
    rd = parse_dt(s.get('renewalDate'))
    if rd and start_dt <= rd <= end_dt:
        due_subs.append((s, rd))

print(f"Total subscriptions with renewalDate in [Aug 23, Sep 08]: {len(due_subs)}")

unattempted = []
attempted = []

for s, rd in due_subs:
    sc = s.get('readableCode')
    if sc in order_subs_window:
        attempted.append((s, rd))
    else:
        unattempted.append((s, rd))

print(f"  Attempted via renewal orders: {len(attempted)}")
print(f"  NOT ATTEMPTED via renewal orders: {len(unattempted)}")

st_counts = Counter(s.get('status') for s, _ in unattempted)
print("\nStatus breakdown of unattempted subscriptions:")
for st, cnt in st_counts.most_common():
    print(f"  {st}: {cnt}")

ar_counts = Counter(s.get('autoRenew') for s, _ in unattempted)
print("\nautoRenew flag on unattempted:")
for ar, cnt in ar_counts.items():
    print(f"  autoRenew={ar}: {cnt}")

# Unattempted with autoRenew == True
unattempted_autorenew = [(s, rd) for s, rd in unattempted if s.get('autoRenew') is True]
print(f"\nUnattempted with autoRenew == True (SHOULD HAVE BEEN ATTEMPTED): {len(unattempted_autorenew)}")
print("Status of these autoRenew=True unattempted subs:")
for st, cnt in Counter(s.get('status') for s, _ in unattempted_autorenew).most_common():
    print(f"  {st}: {cnt}")

# Token availability for autoRenew=True unattempted subs
has_tok = 0
no_tok = 0
for s, rd in unattempted_autorenew:
    pmu = s.get('paymentMethodUsed') or {}
    cid = get_oid(s.get('customerId'))
    cust = cust_by_id.get(cid) or {}
    c_insts = cust.get('moyasarPaymentInstruments') or []
    tid = pmu.get('tokenId') or (c_insts[0].get('tokenId') if c_insts else None)
    if tid:
        has_tok += 1
    else:
        no_tok += 1

print(f"Token availability for autoRenew=True unattempted:")
print(f"  Has Token on file: {has_tok}")
print(f"  NO Token on file:  {no_tok}")

revenue_at_risk = sum(s.get('price', 0) for s, _ in unattempted_autorenew)
print(f"Total Revenue of autoRenew=True unattempted: SAR {revenue_at_risk:,.2f}")
