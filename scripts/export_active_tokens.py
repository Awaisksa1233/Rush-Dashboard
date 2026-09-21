import os
import sys
import json
import csv
from datetime import datetime, timezone

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
customers = load_collection('rushwash_customers')

cust_by_id = {get_oid(c.get('_id')): c for c in customers}

all_active = [s for s in subs if s.get('status') == 'active']

rows = []
for s in all_active:
    cid = get_oid(s.get('customerId'))
    cust = cust_by_id.get(cid) or {}
    
    # Check sub token
    pmu = s.get('paymentMethodUsed') or {}
    sub_tid = pmu.get('tokenId') or pmu.get('token')
    sub_brand = pmu.get('brand') or ''
    sub_last4 = pmu.get('lastFour') or pmu.get('last4') or ''
    
    # Check cust token
    c_insts = cust.get('moyasarPaymentInstruments') or []
    if isinstance(cust.get('moyasarPaymentInstrument'), dict):
        c_insts.append(cust.get('moyasarPaymentInstrument'))
    
    cust_tid = None
    cust_brand = ''
    cust_last4 = ''
    if c_insts and isinstance(c_insts[0], dict):
        cust_tid = c_insts[0].get('tokenId') or c_insts[0].get('token')
        cust_brand = c_insts[0].get('brand') or ''
        cust_last4 = c_insts[0].get('lastFour') or c_insts[0].get('last4') or ''
        
    final_tid = sub_tid or cust_tid
    has_token = bool(final_tid)
    token_src = 'subscription' if sub_tid else ('customer_profile' if cust_tid else 'NONE')
    
    vlinks = s.get('vehicleLinks', [])
    plate = vlinks[0].get('snapshot', {}).get('displayPlate') if vlinks else 'N/A'
    rd = parse_dt(s.get('renewalDate'))
    rd_str = rd.strftime('%Y-%m-%d') if rd else 'N/A'
    
    csnap = s.get('customerSnapshot', {})
    
    rows.append({
        'Subscription Code': s.get('readableCode'),
        'Plate': plate,
        'Has Token': 'YES' if has_token else 'NO',
        'Token ID': final_tid or 'N/A',
        'Brand': sub_brand or cust_brand or 'N/A',
        'Last 4': sub_last4 or cust_last4 or 'N/A',
        'Token Source': token_src,
        'Renewal Date': rd_str,
        'Plan': s.get('packageNameEn', 'N/A'),
        'Price (SAR)': s.get('price', 0),
        'Customer Name': csnap.get('name') or cust.get('name') or 'Unknown',
        'Phone': csnap.get('phone') or cust.get('phone') or 'N/A'
    })

csv_path = os.path.join(os.path.dirname(__file__), '..', 'active_subscriptions_token_audit.csv')
with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)

print(f"Exported {len(rows)} active subscription token records to {csv_path}")
