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

cust_by_id = {get_oid(c.get('_id')): c for c in customers}

# Window: 27 August 2026 to 08 September 2026
start_dt = datetime(2026, 8, 27, 0, 0, 0, tzinfo=timezone.utc)
end_dt = datetime(2026, 9, 8, 23, 59, 59, tzinfo=timezone.utc)

# 1. Collect all subscriptions that had ANY renewal order attempted in rushwash_sale_orders
attempted_sub_codes = set()
for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if odt and odt >= start_dt:
        if o.get('isRenewal') or o.get('subscriptionTransitionKind') == 'renewal':
            sc = o.get('subscriptionReadableCode') or o.get('subCode')
            if sc:
                attempted_sub_codes.add(sc)

# 2. Filter subscriptions due between Aug 27 and Sep 08 with autoRenew == True (supposed to renew)
unattempted_list = []

for s in subs:
    rd = parse_dt(s.get('renewalDate'))
    if rd and start_dt <= rd <= end_dt:
        # Check autoRenew
        if s.get('autoRenew') is not True:
            continue
            
        sc = s.get('readableCode')
        if sc in attempted_sub_codes:
            continue
            
        # Extract vehicle plate
        v_links = s.get('vehicleLinks', [])
        plates = []
        for vl in v_links:
            snap = vl.get('snapshot', {})
            p = snap.get('displayPlate') or snap.get('normalizedPlate')
            if p:
                plates.append(p)
        plate_str = ", ".join(plates) if plates else "N/A"
        
        # Check token
        pmu = s.get('paymentMethodUsed') or {}
        sub_tid = pmu.get('tokenId') or pmu.get('token')
        sub_inst_id = pmu.get('instrumentId')
        sub_brand = pmu.get('brand') or ''
        sub_last4 = pmu.get('lastFour') or pmu.get('last4') or ''
        
        cid = get_oid(s.get('customerId'))
        cust = cust_by_id.get(cid) or {}
        c_insts = cust.get('moyasarPaymentInstruments') or []
        if isinstance(cust.get('moyasarPaymentInstrument'), dict):
            c_insts.append(cust.get('moyasarPaymentInstrument'))
            
        cust_tid = None
        cust_brand = ''
        cust_last4 = ''
        for inst in c_insts:
            if isinstance(inst, dict):
                inst_tid = inst.get('tokenId') or inst.get('token')
                inst_id = inst.get('instrumentId') or inst.get('id') or str(inst.get('_id', ''))
                b = inst.get('brand') or ''
                l4 = inst.get('lastFour') or inst.get('last4') or ''
                if (sub_tid and inst_tid == sub_tid) or (sub_inst_id and inst_id == sub_inst_id):
                    sub_brand = sub_brand or b
                    sub_last4 = sub_last4 or l4
                if not cust_tid and inst_tid:
                    cust_tid = inst_tid
                    cust_brand = b
                    cust_last4 = l4
            
        final_tid = sub_tid or cust_tid
        final_brand = sub_brand or cust_brand or 'N/A'
        final_last4 = sub_last4 or cust_last4 or 'N/A'
        has_token = bool(final_tid)
        
        csnap = s.get('customerSnapshot', {})
        cust_name = csnap.get('name') or cust.get('name') or "Unknown"
        phone = csnap.get('phone') or cust.get('phone') or "N/A"
        
        # Action Bucket
        curr_status = s.get('status')
        if curr_status == 'active' and has_token:
            action_bucket = 'BILL_IMMEDIATELY'
        elif curr_status == 'expired' and has_token:
            action_bucket = 'RETRY_PREMATURE_EXPIRY'
        elif not has_token:
            action_bucket = 'CAPTURE_CARD_SMS'
        else:
            action_bucket = 'MANUAL_REVIEW'
            
        unattempted_list.append({
            'Subscription Code': sc,
            'Plate': plate_str,
            'Customer Name': cust_name,
            'Phone': phone,
            'Plan': s.get('packageNameEn', 'N/A'),
            'Price (SAR)': s.get('price', 0),
            'Renewal Date': rd.strftime('%Y-%m-%d'),
            'Current Status': curr_status,
            'Has Token': 'YES' if has_token else 'NO',
            'Token ID': final_tid or 'N/A',
            'Card Brand': final_brand,
            'Last 4': final_last4,
            'Action Bucket': action_bucket
        })

print(f"Total unattempted subscriptions (Aug 27 - Sep 08): {len(unattempted_list)}")

# Sort by Renewal Date, then Status
unattempted_list.sort(key=lambda x: (x['Renewal Date'], x['Current Status']))

# Export to CSV
csv_path = os.path.join(os.path.dirname(__file__), '..', 'unattempted_renewals_aug27_sep08.csv')
with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=list(unattempted_list[0].keys()))
    writer.writeheader()
    writer.writerows(unattempted_list)

print(f"Saved CSV to: {csv_path}")

# Breakdown Stats
status_counts = Counter(r['Current Status'] for r in unattempted_list)
print("\nStatus Breakdown:")
for st, cnt in status_counts.most_common():
    print(f"  {st}: {cnt}")

token_counts = Counter(r['Has Token'] for r in unattempted_list)
print("\nToken Coverage:")
for tc, cnt in token_counts.items():
    print(f"  Has Token = {tc}: {cnt}")

action_counts = Counter(r['Action Bucket'] for r in unattempted_list)
print("\nAction Buckets:")
for ab, cnt in action_counts.most_common():
    print(f"  {ab}: {cnt}")

total_mrr = sum(r['Price (SAR)'] for r in unattempted_list)
token_ready_mrr = sum(r['Price (SAR)'] for r in unattempted_list if r['Has Token'] == 'YES')
print(f"\nFinancials:")
print(f"  Total Unattempted MRR:       SAR {total_mrr:,.2f}")
print(f"  Token-Ready Recoverable MRR: SAR {token_ready_mrr:,.2f}")
