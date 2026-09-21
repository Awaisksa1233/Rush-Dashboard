import os
import sys
from datetime import timedelta
import dns.resolver
import pymongo
from dotenv import load_dotenv
import openpyxl

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

load_dotenv()
resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '1.1.1.1']
dns.resolver.default_resolver = resolver

client = pymongo.MongoClient(os.getenv('MONGODB_URI'), serverSelectionTimeoutMS=10000)
db = client.get_database('rushwash')

wb = openpyxl.load_workbook(r'c:\Users\Rush\Documents\antigravity\gallant-volta\watan96_mastersheet.xlsx', data_only=True)
ws = wb['WATAN96_Eligible_Master']
headers = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)]
col_sent = headers.index('SMS Sent or No') + 1
col_code = headers.index('Customer Code') + 1
col_name = headers.index('Customer Name') + 1
col_phone = headers.index('Phone Number') + 1

sent_codes = set()
for r in range(2, ws.max_row + 1):
    val = str(ws.cell(row=r, column=col_sent).value or '').strip().lower()
    if val == 'yes':
        c = str(ws.cell(row=r, column=col_code).value or '').strip()
        if c: sent_codes.add(c)

wb.close()

paid_orders = list(db['rushwash_sale_orders'].find({
    'lines.catalogCode': {'$in': ['DSC-00078', 'DSC-00079']},
    'status': {'$in': ['paid', 'active', 'completed']}
}))

for o in paid_orders:
    c_snap = o.get('customerSnapshot') or {}
    cc = c_snap.get('readableCode') or o.get('customerCode')
    if cc in sent_codes:
        promo = 'WATAN96' if any(l.get('catalogCode') == 'DSC-00078' for l in o.get('lines', [])) else 'WATAN223'
        dt_local = o.get('createdAt') + timedelta(hours=3) if o.get('createdAt') else None
        print(f"Customer Code: {cc}")
        print(f"Customer Name: {c_snap.get('name')}")
        print(f"Phone: {c_snap.get('phone')}")
        print(f"Order: {o.get('readableCode')}")
        print(f"Status: {o.get('status')}")
        print(f"Promo: {promo}")
        print(f"Amount Paid: {o.get('totalCaptured')} SAR")
        print(f"Redeemed At: {dt_local} (Local AST)")
        print(f"Channel: {o.get('channel') or o.get('origin') or 'POS Sales Lane'}")
