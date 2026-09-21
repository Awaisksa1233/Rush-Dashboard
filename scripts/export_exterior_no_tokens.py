import os
import sys
import json
import csv
from datetime import datetime, timezone
from collections import Counter

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

exterior_packages = {'Fresh', 'Shiny', 'Nano'}

def has_token(s, cust):
    pmu = s.get('paymentMethodUsed') or {}
    if pmu.get('tokenId') or pmu.get('token'):
        return True
    mpi = s.get('moyasarPaymentInstrument') or {}
    if mpi.get('tokenId') or mpi.get('token') or mpi.get('id'):
        return True
    if cust:
        c_insts = cust.get('moyasarPaymentInstruments') or []
        if isinstance(cust.get('moyasarPaymentInstrument'), dict):
            c_insts.append(cust.get('moyasarPaymentInstrument'))
        for inst in c_insts:
            if isinstance(inst, dict) and (inst.get('tokenId') or inst.get('token')):
                return True
    return False

rows = []
for s in subs:
    # Check status active
    if s.get('status') != 'active':
        continue
    
    # Check package
    pkg = s.get('packageNameEn')
    if pkg not in exterior_packages:
        continue
        
    rd = parse_dt(s.get('renewalDate'))
    if not rd or not (now <= rd <= in_30_days):
        continue
        
    cid = get_oid(s.get('customerId'))
    cust = cust_by_id.get(cid)
    
    if has_token(s, cust):
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
    
    csnap = s.get('customerSnapshot', {})
    cust_name = csnap.get('name') or (cust.get('name') if cust else 'Unknown')
    phone = csnap.get('phone') or (cust.get('phone') if cust else 'N/A')
    
    rows.append({
        'Subscription Code': s.get('readableCode'),
        'Plate': plate_str,
        'Renew Date': rd.strftime('%Y-%m-%d'),
        'Plan': pkg,
        'Price (SAR)': s.get('price', 0),
        'Customer Name': cust_name,
        'Phone': phone,
        'Status': s.get('status'),
        'AutoRenew': 'True' if s.get('autoRenew') else 'False'
    })

# Sort by renewal date
rows.sort(key=lambda x: x['Renew Date'])

print(f"Total active exterior subscriptions with no token (next 30 days): {len(rows)}")
total_rev = sum(r['Price (SAR)'] for r in rows)
print(f"Total Revenue: SAR {total_rev:,.2f}")

plan_counts = Counter(r['Plan'] for r in rows)
print("Plan breakdown:")
for p, cnt in plan_counts.items():
    print(f"  {p}: {cnt}")

csv_path = os.path.join(os.path.dirname(__file__), '..', 'exterior_renewals_next30_no_tokens.csv')
with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

print(f"Exported to {csv_path}")

print("\nFirst 10 rows:")
for r in rows[:10]:
    print(f"{r['Plate']:<10} | {r['Renew Date']} | {r['Plan']:<6} | SAR {r['Price (SAR)']:<3} | {r['Customer Name']:<15} | {r['Phone']}")
