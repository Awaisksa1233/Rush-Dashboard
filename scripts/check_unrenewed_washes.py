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
washes = load_collection('rushwash_wash_histories')
orders = load_collection('rushwash_sale_orders')

start_dt = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)
end_dt = datetime(2026, 9, 7, 23, 59, 59, tzinfo=timezone.utc)

# 495 successfully renewed
successful_sub_codes = set()
for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if odt and start_dt <= odt <= end_dt:
        if o.get('isRenewal') or o.get('subscriptionTransitionKind') == 'renewal':
            is_paid = (o.get('status') in ['paid', 'completed']) or any(p.get('status') == 'paid' for p in o.get('payments', []))
            if is_paid:
                sc = o.get('subscriptionReadableCode') or o.get('subCode')
                if sc:
                    successful_sub_codes.add(sc)

# Find the 101 active unrenewed subs
active_unrenewed = []
for s in subs:
    rd = parse_dt(s.get('renewalDate'))
    if rd and start_dt <= rd <= end_dt:
        if s.get('readableCode') not in successful_sub_codes and s.get('status') == 'active':
            active_unrenewed.append((s, rd))

print(f"Active Unrenewed Subscriptions: {len(active_unrenewed)}")

# Build wash index by plate
washes_by_plate = defaultdict(list)
for w in washes:
    wdt = parse_dt(w.get('washDate') or w.get('createdAt'))
    v_snap = w.get('vehicleSnapshot', {})
    plate = (w.get('normalizedPlate') or w.get('plateNumber') or (v_snap.get('displayPlate') if isinstance(v_snap, dict) else '') or '').replace(' ', '').upper()
    if plate and wdt:
        washes_by_plate[plate].append((w, wdt))

# Check how many washed after their overdue renewalDate
washed_after_due = []
for s, rd in active_unrenewed:
    plates = []
    for vl in s.get('vehicleLinks', []):
        p = (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '').replace(' ', '').upper()
        if p:
            plates.append(p)
    
    sub_washes = []
    for p in plates:
        for w, wdt in washes_by_plate.get(p, []):
            if wdt > rd:
                sub_washes.append((w, wdt))
                
    if sub_washes:
        washed_after_due.append((s, rd, len(sub_washes), sub_washes[-1][1]))

print(f"Active unrenewed subscriptions that washed AFTER due date: {len(washed_after_due)}")
if washed_after_due:
    print("Sample vehicles washing while overdue:")
    for s, rd, cnt, last_w in washed_after_due[:5]:
        csnap = s.get('customerSnapshot') or {}
        vlinks = s.get('vehicleLinks') or []
        plate = vlinks[0].get('snapshot', {}).get('displayPlate') if vlinks else 'N/A'
        print(f"  Plate: {plate} | Customer: {csnap.get('name')} | Due: {rd.strftime('%Y-%m-%d')} | Washes since due: {cnt} | Last wash: {last_w.strftime('%Y-%m-%d %H:%M')}")
