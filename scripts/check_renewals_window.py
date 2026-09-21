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

subs = load_collection('rushwash_subscriptions')
orders = load_collection('rushwash_sale_orders')

print(f"Loaded {len(subs)} subscriptions, {len(orders)} orders.")

# Let's inspect what date fields exist on subs
date_keys = set()
for s in subs[:500]:
    for k, v in s.items():
        if 'date' in k.lower() or 'at' in k.lower() or 'time' in k.lower() or 'period' in k.lower() or 'expire' in k.lower():
            date_keys.add(k)
print(f"Date-like keys on subscriptions: {sorted(list(date_keys))}")

# Check renewalDate distribution around Aug-Sep 2026
start_dt = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)
end_dt = datetime(2026, 9, 7, 23, 59, 59, tzinfo=timezone.utc)

matching_renewalDate = []
for s in subs:
    rd = parse_dt(s.get('renewalDate'))
    if rd and start_dt <= rd <= end_dt:
        matching_renewalDate.append((s, rd))

print(f"\nSubscriptions with renewalDate between 2026-08-23 and 2026-09-07: {len(matching_renewalDate)}")

status_breakdown = Counter(s.get('status') for s, _ in matching_renewalDate)
print("Statuses of these subscriptions:")
for st, cnt in status_breakdown.most_common():
    print(f"  {st}: {cnt}")

# Also check if autoRenew is True/False
auto_renew_breakdown = Counter(s.get('autoRenew') for s, _ in matching_renewalDate)
print("autoRenew flags:")
for ar, cnt in auto_renew_breakdown.items():
    print(f"  {ar}: {cnt}")
