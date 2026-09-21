import os
import sys
import json
from collections import Counter
from datetime import datetime, timezone

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

subs = load_collection('rushwash_subscriptions')
print(f"Total subscriptions: {len(subs)}")

# Inspect keys across all subs
keys = Counter()
status_counts = Counter()
for s in subs:
    keys.update(s.keys())
    status_counts[s.get('status')] += 1

print("\nSubscription statuses:")
for st, cnt in status_counts.most_common():
    print(f"  {st}: {cnt}")

print("\nTop keys in subscriptions:")
for k, cnt in keys.most_common(30):
    print(f"  {k}: {cnt}")

# Print 3 sample subscriptions (different statuses)
for sample_status in ['active', 'past_due', 'expired', 'cancelled']:
    for s in subs:
        if s.get('status') == sample_status:
            print(f"\nSample sub with status '{sample_status}':")
            # print pretty JSON of important fields
            summary = {k: v for k, v in s.items() if k not in ['vehicleLinks', 'history', 'logs'] or isinstance(v, (str, int, float, bool, type(None)))}
            if 'vehicleLinks' in s:
                summary['vehicleLinks_count'] = len(s['vehicleLinks'])
                if s['vehicleLinks']:
                    summary['vehicleLink_sample'] = s['vehicleLinks'][0]
            print(json.dumps(summary, indent=2, default=str)[:1000])
            break
