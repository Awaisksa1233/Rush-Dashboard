import os
import sys
import json
from datetime import datetime, timezone, timedelta
import dns.resolver
import pymongo
from dotenv import load_dotenv
import openpyxl

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

# Load messaged customers
wb = openpyxl.load_workbook(r'c:\Users\Rush\Documents\antigravity\gallant-volta\watan96_mastersheet.xlsx', data_only=True)
ws = wb['WATAN96_Eligible_Master']
headers = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)]
col_sent = headers.index('SMS Sent or No') + 1
col_code = headers.index('Customer Code') + 1
col_phone = headers.index('Phone Number') + 1
col_name = headers.index('Customer Name') + 1

messaged_customers = {}
for r in range(2, ws.max_row + 1):
    sent_val = str(ws.cell(row=r, column=col_sent).value or '').strip().lower()
    if sent_val == 'yes':
        code = str(ws.cell(row=r, column=col_code).value or '').strip()
        phone = str(ws.cell(row=r, column=col_phone).value or '').strip()
        name = str(ws.cell(row=r, column=col_name).value or '').strip()
        messaged_customers[code] = {'code': code, 'name': name, 'phone': phone}

wb.close()

# SMS Broadcast timestamp: 2026-09-18 18:12:50 Saudi time (15:12:50 UTC)
sms_dispatch_utc = datetime(2026, 9, 18, 15, 12, 50, tzinfo=timezone.utc)

def parse_orders(catalog_code, campaign_name):
    orders = list(db['rushwash_sale_orders'].find({'lines.catalogCode': catalog_code}))
    print(f"=== {campaign_name} ({catalog_code}) Orders Total: {len(orders)} ===")
    
    status_counts = {}
    total_revenue = 0.0
    all_orders = []
    
    for o in orders:
        st = o.get('status')
        status_counts[st] = status_counts.get(st, 0) + 1
        
        c_snap = o.get('customerSnapshot') or {}
        cc = c_snap.get('readableCode') or o.get('customerCode')
        c_name = c_snap.get('name') or ''
        c_phone = c_snap.get('phone') or ''
        
        captured = float(o.get('totalCaptured') or 0.0)
        dt = o.get('createdAt')
        
        is_messaged = cc in messaged_customers
        timing = "N/A"
        if dt:
            dt_utc = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
            timing = "AFTER SMS" if dt_utc >= sms_dispatch_utc else "BEFORE SMS"
            
        all_orders.append({
            'orderCode': o.get('readableCode'),
            'status': st,
            'customerCode': cc,
            'customerName': c_name,
            'customerPhone': c_phone,
            'totalCaptured': captured,
            'createdAt': dt,
            'is_messaged': is_messaged,
            'timing': timing
        })
        if st in ['paid', 'completed', 'active']:
            total_revenue += captured
            
    print("Status breakdown:", status_counts)
    print(f"Total Captured Revenue (paid/completed/active): {total_revenue:.2f} SAR")
    
    paid_completed = [o for o in all_orders if o['status'] in ['paid', 'completed', 'active']]
    print(f"Successful (Paid/Active/Completed) Redemptions: {len(paid_completed)}")
    
    messaged_redemptions = [po for po in all_orders if po['is_messaged']]
    print(f"Orders from messaged customers: {len(messaged_redemptions)}")
    for mr in messaged_redemptions:
        dt_local_str = (mr['createdAt'] + timedelta(hours=3)).strftime('%Y-%m-%d %H:%M:%S') if mr['createdAt'] else "N/A"
        print(f"  - Customer: {mr['customerCode']} ({mr['customerName']}) | Phone: {mr['customerPhone']} | Order: {mr['orderCode']} | Status: {mr['status']} | Captured: {mr['totalCaptured']} SAR | Time: {dt_local_str} AST | Timing: {mr['timing']}")
        
    return all_orders

print("--- AUDITING ALL REDEMPTIONS ---")
orders_96 = parse_orders('DSC-00078', 'WATAN96')
print("")
orders_223 = parse_orders('DSC-00079', 'WATAN223')
