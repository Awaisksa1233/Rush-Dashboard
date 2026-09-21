import json
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

with open('database/atlas_backup/latest/rushwash/rushwash_customers.json', 'r', encoding='utf-8') as f:
    custs = json.load(f)

target_cust = next((c for c in custs if c.get('readableCode') == 'CUS-00410'), None)
if target_cust:
    print("Customer CUS-00410:")
    print(f"  Name: {target_cust.get('name')}")
    print(f"  Phone: {target_cust.get('phone')}")
    print(f"  Email: {target_cust.get('email')}")
    print(f"  Instruments: {json.dumps(target_cust.get('moyasarPaymentInstruments'), ensure_ascii=False, indent=2)}")
else:
    print("CUS-00410 not found in backup")
