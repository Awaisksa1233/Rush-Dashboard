import os
import sys
import json
from collections import defaultdict

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

customers = load_collection('rushwash_customers')
subs = load_collection('rushwash_subscriptions')
orders = load_collection('rushwash_sale_orders')
vehicles = load_collection('rushwash_vehicles')

TARGET = "5265"

print(f"=== SEARCH RESULTS FOR: '{TARGET}' ===\n")

# 1. Search Card Last 4 Digits
card_matches = []

# In customers
for c in customers:
    insts = c.get('moyasarPaymentInstruments') or []
    if isinstance(c.get('moyasarPaymentInstrument'), dict):
        insts.append(c.get('moyasarPaymentInstrument'))
    for inst in insts:
        if isinstance(inst, dict):
            l4 = str(inst.get('lastFour') or inst.get('last4') or '')
            if l4 == TARGET or TARGET in l4:
                card_matches.append({
                    'type': 'customer_payment_instrument',
                    'customer_name': c.get('name'),
                    'phone': c.get('phone'),
                    'customer_code': c.get('readableCode'),
                    'customer_id': get_oid(c.get('_id')),
                    'brand': inst.get('brand'),
                    'last4': l4,
                    'tokenId': inst.get('tokenId') or inst.get('id'),
                    'instrument': inst
                })

# In subscriptions
sub_card_matches = []
for s in subs:
    pmu = s.get('paymentMethodUsed') or {}
    l4 = str(pmu.get('lastFour') or pmu.get('last4') or '')
    if l4 == TARGET or TARGET in l4:
        sub_card_matches.append({
            'type': 'subscription_payment_method',
            'sub_code': s.get('readableCode'),
            'status': s.get('status'),
            'plan': s.get('packageNameEn'),
            'price': s.get('price'),
            'renewalDate': s.get('renewalDate'),
            'customer_name': s.get('customerSnapshot', {}).get('name'),
            'phone': s.get('customerSnapshot', {}).get('phone'),
            'brand': pmu.get('brand'),
            'last4': l4,
            'tokenId': pmu.get('tokenId')
        })

# In orders payments
order_card_matches = []
for o in orders:
    payments = o.get('payments') or []
    for p in payments:
        l4 = str(p.get('lastFour') or p.get('last4') or p.get('cardLastFour') or '')
        # also check paymentToken, notes, etc.
        source = p.get('source') or {}
        if isinstance(source, dict):
            l4 = l4 or str(source.get('last_four') or source.get('number', '')[-4:])
        if l4 == TARGET or TARGET in l4:
            order_card_matches.append({
                'order_code': o.get('readableCode'),
                'created': o.get('createdAt'),
                'status': o.get('status'),
                'amount': o.get('postDiscountTotal') or p.get('amount'),
                'customer': o.get('customerSnapshot', {}).get('name'),
                'phone': o.get('customerSnapshot', {}).get('phone'),
                'plate': o.get('normalizedPlate') or o.get('vehicleSnapshot', {}).get('displayPlate'),
                'p_status': p.get('status'),
                'last4': l4
            })

print(f"1. Customers with Card Last 4 = {TARGET}: {len(card_matches)}")
for m in card_matches:
    print(f"   Customer: {m['customer_name']} ({m['phone']}) | Code: {m['customer_code']} | Brand: {m['brand']} | Token: {m['tokenId']}")

print(f"\n2. Subscriptions with Card Last 4 = {TARGET}: {len(sub_card_matches)}")
for m in sub_card_matches:
    print(f"   Sub: {m['sub_code']} | Status: {m['status']} | Plan: {m['plan']} (SAR {m['price']}) | Cust: {m['customer_name']} ({m['phone']}) | Due: {m['renewalDate']}")

print(f"\n3. Orders with Card Last 4 = {TARGET}: {len(order_card_matches)}")
for m in order_card_matches[:10]:
    print(f"   Order: {m['order_code']} | Status: {m['status']} | Amount: SAR {m['amount']} | Cust: {m['customer']} ({m['phone']}) | Plate: {m['plate']} | Date: {m['created']}")

# 4. Search Phone ending in 5265
phone_matches = [c for c in customers if str(c.get('phone', '')).endswith(TARGET)]
print(f"\n4. Customers with Phone ending in {TARGET}: {len(phone_matches)}")
for c in phone_matches:
    print(f"   Customer: {c.get('name')} | Phone: {c.get('phone')} | Code: {c.get('readableCode')}")

# 5. Search Plate containing 5265
plate_matches = [v for v in vehicles if TARGET in str(v.get('plateNumber', '')) or TARGET in str(v.get('displayPlate', '')) or TARGET in str(v.get('normalizedPlate', ''))]
print(f"\n5. Vehicles with Plate containing {TARGET}: {len(plate_matches)}")
for v in plate_matches[:10]:
    print(f"   Plate: {v.get('displayPlate') or v.get('normalizedPlate')} | Code: {v.get('readableCode')}")
