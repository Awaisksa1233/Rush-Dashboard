import os
import sys
import json

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKUP_DIR = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_json(name):
    fpath = os.path.join(BACKUP_DIR, f"{name}.json")
    with open(fpath, 'r', encoding='utf-8') as f:
        return json.load(f)

orders = load_json('rushwash_sale_orders')
customers = load_json('rushwash_customers')
refunds = load_json('rushwash_refund_requests')

cust = [c for c in customers if '502766618' in str(c.get('phone', ''))]
print("Customer:", cust)

for o in orders:
    phone = (o.get('customerSnapshot') or {}).get('phone') or ''
    cid = str(o.get('customerId', {}).get('$oid', o.get('customerId')))
    plate = o.get('normalizedPlate') or (o.get('vehicleSnapshot') or {}).get('normalizedPlate') or ''
    
    if '502766618' in phone or cid == '6a9b07e0a65e9e17090f57c9' or plate in ['502ZHV', '5355XHD', '502']:
        c_at = o.get('createdAt', {}).get('$date') if isinstance(o.get('createdAt'), dict) else str(o.get('createdAt'))
        print("\n" + "=" * 60)
        print(f"Order: {o.get('readableCode')} | Plate: {plate} | Date: {c_at}")
        print(f"Status: {o.get('status')} | Total: {o.get('postDiscountTotal')} SAR | Total Captured: {o.get('totalCaptured')} SAR")
        print("Payments:")
        for p in o.get('payments', []):
            print(" ", p)
