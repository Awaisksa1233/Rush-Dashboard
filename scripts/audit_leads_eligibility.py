import os
import sys
import json
import re
from datetime import datetime, timezone, timedelta
import dns.resolver
import pymongo
from dotenv import load_dotenv

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

load_dotenv()
resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '1.1.1.1']
dns.resolver.default_resolver = resolver

client = pymongo.MongoClient(os.getenv('MONGODB_URI'), serverSelectionTimeoutMS=10000)
db = client.get_database('rushwash')

# Load the 7 unrecovered hot leads
with open(r'c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan_unrecovered_hot_leads.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

leads = data['unrecovered_hot_leads']
print(f"Auditing eligibility for {len(leads)} unrecovered leads...\n")

audit_results = []

for item in leads:
    cc = item['customer_code']
    c_name = item['customer_name']
    raw_phone = item['phone']
    order_code = item['order_code']
    plate = item['plate']
    
    # Clean phone formats
    clean_digits = re.sub(r'[^0-9]', '', raw_phone)
    if clean_digits.startswith('966'):
        clean_9 = clean_digits[3:]
    elif clean_digits.startswith('0'):
        clean_9 = clean_digits[1:]
    else:
        clean_9 = clean_digits
        
    local_phone = f"0{clean_9}" if len(clean_9) == 9 else raw_phone
    intl_phone = f"+966{clean_9}" if len(clean_9) == 9 else raw_phone
    
    # 1. Look up customer in rushwash_customers
    cust = db['rushwash_customers'].find_one({'readableCode': cc})
    cid = cust.get('_id') if cust else None
    
    # 2. Check if customer ever had a package subscription
    subs = list(db['rushwash_subscriptions'].find({
        '$or': [
            {'customerId': cid},
            {'customerSnapshot.readableCode': cc},
            {'customerCode': cc}
        ]
    }))
    
    # 3. Check if customer ever bought a package in sale orders
    pkg_orders = list(db['rushwash_sale_orders'].find({
        '$or': [
            {'customerId': cid},
            {'customerSnapshot.readableCode': cc},
            {'customerCode': cc}
        ],
        'lines.lineKind': 'package',
        'status': {'$in': ['paid', 'active', 'completed']}
    }))
    
    # 4. Check if coupon was ever redeemed
    redemptions = list(db['rushwash_coupon_redemptions'].find({
        '$or': [
            {'customerCode': cc},
            {'orderCode': order_code}
        ],
        'couponReadableCode': {'$in': ['DSC-00078', 'DSC-00079']}
    }))
    
    # 5. Check vehicle plate if vehicle already has an active package
    veh = db['rushwash_vehicles'].find_one({'normalizedPlate': plate}) if plate != 'N/A' else None
    veh_active_sub = None
    if veh:
        veh_id = veh.get('_id')
        veh_active_sub = db['rushwash_subscriptions'].find_one({
            'vehicleLinks.vehicleId': veh_id,
            'status': 'active'
        })
        
    # Evaluate eligibility:
    # Rule for WATAN96: "never_purchased_package"
    is_eligible = True
    ineligibility_reasons = []
    
    if subs:
        active_sub_codes = [s.get('readableCode') for s in subs if s.get('status') == 'active']
        all_sub_codes = [s.get('readableCode') for s in subs]
        if active_sub_codes:
            is_eligible = False
            ineligibility_reasons.append(f"Has active subscription ({', '.join(active_sub_codes)})")
        else:
            is_eligible = False
            ineligibility_reasons.append(f"Past subscription on file ({', '.join(all_sub_codes)})")
            
    if pkg_orders:
        paid_pkg_codes = [po.get('readableCode') for po in pkg_orders]
        is_eligible = False
        ineligibility_reasons.append(f"Previously purchased package in orders ({', '.join(paid_pkg_codes)})")
        
    if redemptions:
        is_eligible = False
        ineligibility_reasons.append("Already redeemed WATAN coupon")
        
    if veh_active_sub:
        is_eligible = False
        ineligibility_reasons.append(f"Vehicle {plate} already linked to active sub {veh_active_sub.get('readableCode')}")
        
    audit_results.append({
        'customer_code': cc,
        'customer_name': c_name,
        'local_phone': local_phone,
        'intl_phone': intl_phone,
        'clean_phone': clean_9,
        'plate': plate,
        'order_code': order_code,
        'order_time': item['datetime_ast'],
        'is_eligible': is_eligible,
        'reasons': ineligibility_reasons if not is_eligible else ["Never purchased a package before; 100% eligible for WATAN96"]
    })

print("=== ELIGIBILITY VERIFICATION RESULTS ===")
for r in audit_results:
    verdict = "[ELIGIBLE]" if r['is_eligible'] else "[INELIGIBLE]"
    print(f"{verdict} {r['customer_name']} ({r['customer_code']})")
    print(f"  Phone: {r['local_phone']} / {r['intl_phone']}")
    print(f"  Plate: {r['plate']} | Order: {r['order_code']} ({r['order_time']})")
    print(f"  Details: {'; '.join(r['reasons'])}\n")

with open(r'c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan_hot_leads_eligibility.json', 'w', encoding='utf-8') as f:
    json.dump(audit_results, f, indent=2, ensure_ascii=False)
