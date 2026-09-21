import os
import sys
import json
from datetime import datetime

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

orders = load_collection('rushwash_sale_orders')
subs = load_collection('rushwash_subscriptions')
customers = load_collection('rushwash_customers')
vehicles = load_collection('rushwash_vehicles')

# Check Abdullah (CUS-04183)
cust = next((c for c in customers if c.get('readableCode') == 'CUS-04183'), None)
print("Customer:", cust.get('name'), cust.get('phone'), cust.get('readableCode'))

# Check all orders for CUS-04183
cust_id = cust.get('_id', {}).get('$oid') if isinstance(cust.get('_id'), dict) else str(cust.get('_id'))
c_orders = [o for o in orders if (o.get('customerId', {}).get('$oid') if isinstance(o.get('customerId'), dict) else str(o.get('customerId'))) == cust_id]

print(f"\nAll Orders for Customer ({len(c_orders)}):")
for o in sorted(c_orders, key=lambda x: str(x.get('createdAt'))):
    print(f"Order: {o.get('readableCode')} | Date: {o.get('createdAt')} | Status: {o.get('status')} | Plate: {o.get('normalizedPlate')}")
    print(f"  Captured: {o.get('totalCaptured')} | Lines: {[{'pkg': l.get('catalogCode'), 'name': l.get('displayNameEn'), 'price': l.get('price')} for l in (o.get('lines') or [])]}")
    print(f"  Payments: {[{'amt': p.get('amount'), 'status': p.get('status'), 'method': p.get('paymentMethodNameEn')} for p in (o.get('payments') or [])]}")

# Check all subs for CUS-04183
c_subs = [s for s in subs if (s.get('customerId', {}).get('$oid') if isinstance(s.get('customerId'), dict) else str(s.get('customerId'))) == cust_id]
print(f"\nAll Subs for Customer ({len(c_subs)}):")
for s in sorted(c_subs, key=lambda x: str(x.get('createdAt'))):
    print(f"Sub: {s.get('readableCode')} | Status: {s.get('status')} | Pkg: {s.get('packageNameEn')} | Price: {s.get('price')}")
    print(f"  Created: {s.get('createdAt')} | RenewalDate: {s.get('renewalDate')} | Parent: {s.get('parentSubCode')}")
    print(f"  Terminated: {s.get('terminatedAt')} ({s.get('terminatedReason')}) | Cancelled: {s.get('cancelledAt')}")

