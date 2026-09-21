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
customers = load_collection('rushwash_customers')
cust_by_id = {get_oid(c.get('_id')): c for c in customers}

now = datetime(2026, 9, 8, 0, 0, 0, tzinfo=timezone.utc)
in_30_days = datetime(2026, 10, 8, 23, 59, 59, tzinfo=timezone.utc)

# Inspect all subs with renewalDate between now and in_30_days
subs_in_window = []
for s in subs:
    rd = parse_dt(s.get('renewalDate'))
    if rd and now <= rd <= in_30_days:
        subs_in_window.append((s, rd))

print(f"Total subscriptions with renewalDate in next 30 days (Sep 08 - Oct 08): {len(subs_in_window)}")

status_counts = Counter(s.get('status') for s, _ in subs_in_window)
print("\nStatus distribution in next 30 days:")
for st, cnt in status_counts.most_common():
    print(f"  {st}: {cnt}")

pkg_counts = Counter(s.get('packageNameEn') for s, _ in subs_in_window)
print("\nPackage distribution in next 30 days:")
for pkg, cnt in pkg_counts.most_common():
    print(f"  {pkg}: {cnt}")

# Function to check token
def has_payment_token(s, cust):
    pmu = s.get('paymentMethodUsed') or {}
    sub_tid = pmu.get('tokenId') or pmu.get('token')
    
    mpi = s.get('moyasarPaymentInstrument') or {}
    mpi_tid = mpi.get('tokenId') or mpi.get('token') or mpi.get('id')
    
    cust_tid = None
    if cust:
        c_insts = cust.get('moyasarPaymentInstruments') or []
        if isinstance(cust.get('moyasarPaymentInstrument'), dict):
            c_insts.append(cust.get('moyasarPaymentInstrument'))
        for inst in c_insts:
            if isinstance(inst, dict):
                tid = inst.get('tokenId') or inst.get('token')
                if tid:
                    cust_tid = tid
                    break
                    
    return bool(sub_tid or mpi_tid or cust_tid)

# Check active subscriptions
active_in_window = [(s, rd) for s, rd in subs_in_window if s.get('status') == 'active']
print(f"\nActive subscriptions in next 30 days: {len(active_in_window)}")

active_pkg = Counter(s.get('packageNameEn') for s, _ in active_in_window)
print("Packages among ACTIVE subs in next 30 days:")
for pkg, cnt in active_pkg.most_common():
    print(f"  {pkg}: {cnt}")

# Filter: Only exterior (exclude interior)
# Packages: 'Fresh', 'Shiny', 'Nano'
exterior_packages = {'Fresh', 'Shiny', 'Nano'}

active_exterior = [(s, rd) for s, rd in active_in_window if s.get('packageNameEn') in exterior_packages]
print(f"\nActive EXTERIOR subscriptions in next 30 days: {len(active_exterior)}")

# Now filter: NO TOKENS
active_exterior_no_token = []
active_exterior_has_token = []

for s, rd in active_exterior:
    cid = get_oid(s.get('customerId'))
    cust = cust_by_id.get(cid)
    if has_payment_token(s, cust):
        active_exterior_has_token.append((s, rd))
    else:
        active_exterior_no_token.append((s, rd))

print(f"  Has Token: {len(active_exterior_has_token)}")
print(f"  NO TOKEN:  {len(active_exterior_no_token)}")

# What about all statuses (if any other status is expected to renew)?
all_exterior_no_token = []
for s, rd in subs_in_window:
    if s.get('packageNameEn') in exterior_packages:
        cid = get_oid(s.get('customerId'))
        cust = cust_by_id.get(cid)
        if not has_payment_token(s, cust):
            all_exterior_no_token.append((s, rd, s.get('status')))

print(f"\nAll statuses EXTERIOR with NO TOKEN in next 30 days: {len(all_exterior_no_token)}")
print("Status breakdown of all exterior no token:", Counter(st for _, _, st in all_exterior_no_token))
