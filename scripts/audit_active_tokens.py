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
customers = load_collection('rushwash_customers')
orders = load_collection('rushwash_sale_orders')

cust_by_id = {get_oid(c.get('_id')): c for c in customers}

def extract_tokens_from_cust(c):
    if not c:
        return []
    tokens = []
    # Check moyasarPaymentInstruments
    insts = c.get('moyasarPaymentInstruments') or []
    if isinstance(c.get('moyasarPaymentInstrument'), dict):
        insts.append(c.get('moyasarPaymentInstrument'))
    for inst in insts:
        if isinstance(inst, dict):
            tid = inst.get('tokenId') or inst.get('token') or inst.get('id')
            if tid:
                tokens.append({
                    'source': 'customer_instrument',
                    'tokenId': tid,
                    'brand': inst.get('brand'),
                    'last4': inst.get('lastFour') or inst.get('last4')
                })
    return tokens

def extract_token_from_sub(s):
    # Check s.paymentMethodUsed
    pmu = s.get('paymentMethodUsed')
    if isinstance(pmu, dict):
        tid = pmu.get('tokenId') or pmu.get('token')
        if tid:
            return {
                'source': 'sub_paymentMethodUsed',
                'tokenId': tid,
                'brand': pmu.get('brand'),
                'last4': pmu.get('lastFour') or pmu.get('last4')
            }
    # Check s.moyasarPaymentInstrument
    mpi = s.get('moyasarPaymentInstrument')
    if isinstance(mpi, dict):
        tid = mpi.get('tokenId') or mpi.get('token') or mpi.get('id')
        if tid:
            return {
                'source': 'sub_moyasarPaymentInstrument',
                'tokenId': tid,
                'brand': mpi.get('brand'),
                'last4': mpi.get('lastFour') or mpi.get('last4')
            }
    return None

# Check ALL active subs in DB
all_active_subs = [s for s in subs if s.get('status') == 'active']
print(f"Total active subscriptions in database: {len(all_active_subs)}")

# Check 101 overdue active subs (due between Aug 23 and Sep 07)
start_dt = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)
end_dt = datetime(2026, 9, 7, 23, 59, 59, tzinfo=timezone.utc)

# Successful renewal codes in window
renewal_orders_by_sub = defaultdict(list)
for o in orders:
    odt = parse_dt(o.get('createdAt'))
    if odt and start_dt <= odt <= end_dt:
        if o.get('isRenewal') or o.get('subscriptionTransitionKind') == 'renewal':
            sc = o.get('subscriptionReadableCode') or o.get('subCode')
            if sc:
                renewal_orders_by_sub[sc].append(o)

successful_subs = set()
for sc, o_list in renewal_orders_by_sub.items():
    for o in o_list:
        is_paid = (o.get('status') in ['paid', 'completed']) or any(p.get('status') == 'paid' for p in o.get('payments', []))
        if is_paid:
            successful_subs.add(sc)
            break

overdue_active_subs = []
for s in all_active_subs:
    rd = parse_dt(s.get('renewalDate'))
    if rd and start_dt <= rd <= end_dt:
        sc = s.get('readableCode')
        if sc not in successful_subs:
            overdue_active_subs.append(s)

print(f"Overdue active subscriptions (Aug 23 - Sep 07 unrenewed): {len(overdue_active_subs)}")

def analyze_token_coverage(sub_list, label):
    print(f"\n========================================================")
    print(f"TOKEN AUDIT: {label} (Total: {len(sub_list)})")
    print(f"========================================================")
    
    has_sub_token = 0
    has_cust_token = 0
    has_any_token = 0
    no_token_at_all = 0
    
    no_token_list = []
    
    for s in sub_list:
        sub_tok = extract_token_from_sub(s)
        cid = get_oid(s.get('customerId'))
        cust = cust_by_id.get(cid)
        cust_toks = extract_tokens_from_cust(cust)
        
        has_st = bool(sub_tok)
        has_ct = bool(cust_toks)
        
        if has_st:
            has_sub_token += 1
        if has_ct:
            has_cust_token += 1
        if has_st or has_ct:
            has_any_token += 1
        else:
            no_token_at_all += 1
            no_token_list.append((s, cust))
            
    print(f"  -> Has token attached to Subscription directly: {has_sub_token} ({has_sub_token/len(sub_list)*100:.1f}%)")
    print(f"  -> Has token on Customer profile:              {has_cust_token} ({has_cust_token/len(sub_list)*100:.1f}%)")
    print(f"  -> Has AT LEAST ONE valid token (Sub or Cust): {has_any_token} ({has_any_token/len(sub_list)*100:.1f}%)")
    print(f"  -> NO TOKEN AT ALL (Zero payment method):      {no_token_at_all} ({no_token_at_all/len(sub_list)*100:.1f}%)")
    
    return no_token_list

# Analyze overdue active subs
no_token_overdue = analyze_token_coverage(overdue_active_subs, "101 OVERDUE ACTIVE SUBS")

# Analyze ALL active subs
no_token_all_active = analyze_token_coverage(all_active_subs, "ALL 1,845 ACTIVE SUBS")

print("\nSample overdue active subs with NO TOKEN:")
for s, c in no_token_overdue[:5]:
    vlinks = s.get('vehicleLinks', [])
    p = vlinks[0].get('snapshot', {}).get('displayPlate') if vlinks else 'N/A'
    c_name = c.get('name') if c else s.get('customerSnapshot', {}).get('name', 'Unknown')
    phone = c.get('phone') if c else s.get('customerSnapshot', {}).get('phone', 'N/A')
    print(f"  Sub: {s.get('readableCode')} | Plate: {p} | Customer: {c_name} | Phone: {phone} | Plan: {s.get('packageNameEn')} | RenewalDate: {s.get('renewalDate')}")
