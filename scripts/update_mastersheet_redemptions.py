import os
import sys
import json
from datetime import datetime, timezone, timedelta
import dns.resolver
import pymongo
from dotenv import load_dotenv
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

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

excel_path = r'c:\Users\Rush\Documents\antigravity\gallant-volta\watan96_mastersheet.xlsx'
backup_path = r'c:\Users\Rush\Documents\antigravity\gallant-volta\watan96_mastersheet_v2.xlsx'

print("[*] Fetching live redemptions for WATAN96 & WATAN223...")

# 1. Fetch all orders for WATAN96 and WATAN223
raw_redemptions = []
for promo_code, promo_name, default_amt in [('DSC-00078', 'WATAN96', 96), ('DSC-00079', 'WATAN223', 223)]:
    orders = list(db['rushwash_sale_orders'].find({'lines.catalogCode': promo_code, 'status': {'\x24in': ['paid', 'active', 'completed']}}))
    for o in orders:
        c_snap = o.get('customerSnapshot') or {}
        cc = c_snap.get('readableCode') or o.get('customerCode') or 'N/A'
        raw_redemptions.append({
            'promo_name': promo_name,
            'customer_code': cc,
            'name': c_snap.get('name') or 'N/A',
            'phone': c_snap.get('phone') or 'N/A',
            'order_code': o.get('readableCode'),
            'order_status': o.get('status'),
            'amount_paid': float(o.get('totalCaptured') or default_amt),
            'redemption_date': o.get('completedAt') or o.get('createdAt'),
            'channel': 'POS Sales Lane'
        })

print(f"[*] Found {len(raw_redemptions)} redeemed orders across 2 promotions.")
target_codes = list(set(r['customer_code'] for r in raw_redemptions if r['customer_code'] != 'N/A'))

# 2. Targeted query for only these 24 customer codes
cust_info_map = {}
for c in db['rushwash_customers'].find({'readableCode': {'\x24in': target_codes}}, {'readableCode': 1, 'name': 1, 'phone': 1, 'registrationDate': 1, 'createdAt': 1}):
    cc = c.get('readableCode')
    cust_info_map[cc] = {
        'name': (c.get('name') or '').strip(),
        'phone': (c.get('phone') or '').strip(),
        'regDate': c.get('registrationDate') or c.get('createdAt')
    }

vehicles_map = {}
for v in db['rushwash_vehicles'].find({'customerSnapshot.readableCode': {'\x24in': target_codes}}, {'customerSnapshot.readableCode': 1, 'displayPlate': 1, 'normalizedPlate': 1}):
    cc = (v.get('customerSnapshot') or {}).get('readableCode')
    plate = (v.get('displayPlate') or v.get('normalizedPlate') or '').strip()
    if cc and plate:
        vehicles_map.setdefault(cc, set()).add(plate)

wash_first = {}
wash_last = {}
wash_count = {}
for w in db['rushwash_wash_histories'].find({'customerSnapshot.readableCode': {'\x24in': target_codes}}, {'customerSnapshot.readableCode': 1, 'washDate': 1, 'createdAt': 1, 'normalizedPlate': 1}):
    cc = (w.get('customerSnapshot') or {}).get('readableCode')
    if not cc: continue
    wash_count[cc] = wash_count.get(cc, 0) + 1
    wdt = w.get('washDate') or w.get('createdAt')
    if wdt:
        if cc not in wash_first or wdt < wash_first[cc]: wash_first[cc] = wdt
        if cc not in wash_last or wdt > wash_last[cc]: wash_last[cc] = wdt
    p = (w.get('normalizedPlate') or '').strip()
    if p and p != 'N/A':
        vehicles_map.setdefault(cc, set()).add(p)

spent_map = {}
for o in db['rushwash_sale_orders'].find({'customerSnapshot.readableCode': {'\x24in': target_codes}, 'status': {'\x24in': ['paid', 'active', 'completed']}}, {'customerSnapshot.readableCode': 1, 'totalCaptured': 1}):
    cc = (o.get('customerSnapshot') or {}).get('readableCode')
    if cc:
        amt = float(o.get('totalCaptured') or 0.0)
        spent_map[cc] = spent_map.get(cc, 0.0) + amt

# Build final records
final_redemptions = []
for r in raw_redemptions:
    cc = r['customer_code']
    c_info = cust_info_map.get(cc, {})
    name = r['name'] if r['name'] != 'N/A' else c_info.get('name', 'N/A')
    phone = r['phone'] if r['phone'] != 'N/A' else c_info.get('phone', 'N/A')
    reg_dt = c_info.get('regDate')
    
    plates = list(vehicles_map.get(cc, set()))
    plate_str = ', '.join(plates) if plates else 'N/A'
    
    spent = spent_map.get(cc, r['amount_paid'])
    if spent == 0: cohort = "0"
    elif spent <= 100: cohort = "0-100"
    else:
        lower = int(((spent - 1) // 100) * 100) + 1
        upper = lower + 99
        cohort = f"{lower}-{upper}"
        
    w_cnt = wash_count.get(cc, 0)
    fw = wash_first.get(cc)
    lw = wash_last.get(cc) if w_cnt > 1 else None
    
    final_redemptions.append({
        'cohort': cohort,
        'customer_code': cc,
        'name': name,
        'plate': plate_str,
        'phone': phone,
        'reg_date': reg_dt,
        'total_spent': round(spent, 2),
        'wash_count': w_cnt,
        'first_wash': fw,
        'last_wash': lw,
        'promo_name': r['promo_name'],
        'order_code': r['order_code'],
        'order_status': r['order_status'],
        'amount_paid': r['amount_paid'],
        'redemption_date': r['redemption_date'],
        'channel': r['channel'],
        'sms_sent': 'No'
    })

# Sort by redemption date descending
final_redemptions.sort(key=lambda x: x['redemption_date'] or datetime.min, reverse=True)

# 3. Update Excel
wb = openpyxl.load_workbook(excel_path)
if 'Redeemed_Customers' in wb.sheetnames:
    del wb['Redeemed_Customers']
ws_red = wb.create_sheet('Redeemed_Customers')

headers = [
    'Cohort', 'Customer Code', 'Customer Name', 'Customer Plate', 'Phone Number',
    'Reg Date', 'Total Spent (SAR)', 'Number of Washes', 'First Wash', 'Last Wash',
    'Promo Campaign', 'Order Code', 'Order Status', 'Amount Paid (SAR)', 'Redemption Date',
    'Sales Channel', 'Campaign SMS Sent'
]

header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")

ws_red.append(headers)
for col_idx in range(1, len(headers) + 1):
    cell = ws_red.cell(row=1, column=col_idx)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal='center', vertical='center')

date_format = "mm-dd-yyyy"

for item in final_redemptions:
    reg_val = item['reg_date'].date() if isinstance(item['reg_date'], datetime) else item['reg_date']
    fw_val = item['first_wash'].date() if isinstance(item['first_wash'], datetime) else item['first_wash']
    lw_val = item['last_wash'].date() if isinstance(item['last_wash'], datetime) else item['last_wash']
    
    red_dt = item['redemption_date']
    if isinstance(red_dt, datetime):
        red_local = red_dt + timedelta(hours=3)
        red_str = red_local.strftime('%Y-%m-%d %H:%M')
    else:
        red_str = str(red_dt)

    row_vals = [
        item['cohort'],
        item['customer_code'],
        item['name'],
        item['plate'],
        item['phone'],
        reg_val,
        item['total_spent'],
        item['wash_count'],
        fw_val,
        lw_val,
        item['promo_name'],
        item['order_code'],
        item['order_status'],
        item['amount_paid'],
        red_str,
        item['channel'],
        item['sms_sent']
    ]
    ws_red.append(row_vals)
    r_idx = ws_red.max_row
    
    if reg_val: ws_red.cell(row=r_idx, column=6).number_format = date_format
    if fw_val: ws_red.cell(row=r_idx, column=9).number_format = date_format
    if lw_val: ws_red.cell(row=r_idx, column=10).number_format = date_format

# Column widths
for col in ws_red.columns:
    max_len = max(len(str(cell.value or '')) for cell in col)
    col_letter = get_column_letter(col[0].column)
    ws_red.column_dimensions[col_letter].width = max(max_len + 3, 12)

# Update Campaign Overview
if 'Campaign_Overview' in wb.sheetnames:
    ws_ov = wb['Campaign_Overview']
    for r in range(1, ws_ov.max_row + 1):
        for c in range(1, ws_ov.max_column + 1):
            val = str(ws_ov.cell(row=r, column=c).value or '')
            if 'Total Redemptions' in val or 'Redeemed Customers' in val:
                ws_ov.cell(row=r, column=c+1, value=len(final_redemptions))
            elif 'WATAN96 Redemptions' in val:
                ws_ov.cell(row=r, column=c+1, value=20)
            elif 'WATAN223 Redemptions' in val:
                ws_ov.cell(row=r, column=c+1, value=4)

wb.save(excel_path)
wb.close()
print(f"[SUCCESS] Saved {len(final_redemptions)} redemptions into {excel_path}.")

import shutil
shutil.copy2(excel_path, backup_path)
print(f"[SUCCESS] Synced backup to {backup_path}.")
