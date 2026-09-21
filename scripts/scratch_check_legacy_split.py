import os
import sys
import json
from datetime import datetime, timezone
from collections import defaultdict

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

backup_dir = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_json(name):
    fpath = os.path.join(backup_dir, f"{name}.json")
    if os.path.exists(fpath):
        with open(fpath, 'r', encoding='utf-8') as f:
            return json.load(f)
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

orders = load_json('rushwash_sale_orders')
subs = load_json('rushwash_subscriptions')

cutoff = datetime(2026, 8, 22, 0, 0, 0, tzinfo=timezone.utc)

# Group orders by dataSource
ds_counts = defaultdict(int)
for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if odt and odt >= cutoff:
        ds_counts[o.get('dataSource')] += 1

print("Orders >= Aug 22 by dataSource:", dict(ds_counts))

# Now check non-legacy orders >= Aug 22 with SPK packages:
non_legacy_spk = []
for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if not odt or odt < cutoff:
        continue
    if o.get('dataSource') == 'legacy':
        continue
    lines = o.get('lines') or []
    spk_lines = [l for l in lines if str(l.get('catalogCode', '')).startswith('SPK-') or str(l.get('planReadableCode', '')).startswith('SPK-')]
    if spk_lines:
        non_legacy_spk.append((o, odt, spk_lines))

print(f"\nNon-legacy orders >= Aug 22 with SPK: {len(non_legacy_spk)}")
print("Status counts:", dict(defaultdict(int, {s: sum(1 for o, dt, l in non_legacy_spk if o.get('status') == s) for s in set(o.get('status') for o, dt, l in non_legacy_spk)})))
