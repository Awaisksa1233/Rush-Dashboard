import os
import sys
import json
import re
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

# 1. Load the 384 messaged recipients
report_path = r'c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan96_sms_report_20260918_181250.json'
with open(report_path, 'r', encoding='utf-8') as f:
    sms_report = json.load(f)

messaged_phones_set = set()
for b in sms_report['batches']:
    msgs = b.get('response', {}).get('response', {}).get('data', {}).get('Messages', [])
    for m in msgs:
        p = str(m.get('Recipient') or '').strip()
        if p:
            # normalize to clean 9 digits (5xxxxxxxx)
            clean = re.sub(r'[^0-9]', '', p)
            if clean.startswith('966'): clean = clean[3:]
            elif clean.startswith('0'): clean = clean[1:]
            messaged_phones_set.add(clean)

print(f"Total normalized messaged phones: {len(messaged_phones_set)}")

# Mastersheet customer codes & plates
wb = openpyxl.load_workbook(r'c:\Users\Rush\Documents\antigravity\gallant-volta\watan96_mastersheet.xlsx', data_only=True)
ws = wb['WATAN96_Eligible_Master']
headers = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)]
col_sent = headers.index('SMS Sent or No') + 1
col_code = headers.index('Customer Code') + 1
col_phone = headers.index('Phone Number') + 1
col_name = headers.index('Customer Name') + 1
col_plate = headers.index('Customer Plate') + 1

messaged_codes = set()
messaged_details = {}
for r in range(2, ws.max_row + 1):
    sent_val = str(ws.cell(row=r, column=col_sent).value or '').strip().lower()
    if sent_val == 'yes':
        code = str(ws.cell(row=r, column=col_code).value or '').strip()
        phone = str(ws.cell(row=r, column=col_phone).value or '').strip()
        name = str(ws.cell(row=r, column=col_name).value or '').strip()
        plate = str(ws.cell(row=r, column=col_plate).value or '').strip()
        messaged_codes.add(code)
        clean = re.sub(r'[^0-9]', '', phone)
        if clean.startswith('966'): clean = clean[3:]
        elif clean.startswith('0'): clean = clean[1:]
        messaged_details[clean] = {'code': code, 'name': name, 'phone': phone, 'plate': plate}

wb.close()

sms_time_utc = datetime(2026, 9, 18, 15, 12, 50, tzinfo=timezone.utc)

print("\n=======================================================")
print("=== 1. ALL REDEMPTIONS OF WATAN96 & WATAN223 (TOTAL) ===")
print("=======================================================")

def inspect_campaign(catalog_code, promo_name):
    orders = list(db['rushwash_sale_orders'].find({'lines.catalogCode': catalog_code}))
    print(f"\n--- {promo_name} (Catalog Code: {catalog_code}) ---")
    print(f"Total Orders Created: {len(orders)}")
    
    paid_count = 0
    abandoned_count = 0
    checked_in_count = 0
    revenue = 0.0
    
    order_list = []
    
    for o in orders:
        st = o.get('status')
        if st in ['paid', 'active', 'completed']:
            paid_count += 1
            revenue += float(o.get('totalCaptured') or 0.0)
        elif st == 'abandoned':
            abandoned_count += 1
        elif st == 'checked_in':
            checked_in_count += 1
            
        c_snap = o.get('customerSnapshot') or {}
        cc = c_snap.get('readableCode') or o.get('customerCode') or ''
        c_phone = c_snap.get('phone') or ''
        c_name = c_snap.get('name') or ''
        
        clean_p = re.sub(r'[^0-9]', '', c_phone)
        if clean_p.startswith('966'): clean_p = clean_p[3:]
        elif clean_p.startswith('0'): clean_p = clean_p[1:]
        
        created_at = o.get('createdAt')
        dt_local = created_at + timedelta(hours=3) if created_at else None
        
        # Check matching
        match_by_code = cc in messaged_codes
        match_by_phone = clean_p in messaged_phones_set
        
        order_list.append({
            'orderCode': o.get('readableCode'),
            'status': st,
            'customerCode': cc,
            'customerName': c_name,
            'phone': c_phone,
            'clean_phone': clean_p,
            'captured': float(o.get('totalCaptured') or 0.0),
            'channel': o.get('channel') or o.get('origin') or (o.get('metadata') or {}).get('channel') or 'N/A',
            'createdAt': dt_local.strftime('%Y-%m-%d %H:%M:%S') if dt_local else 'N/A',
            'matched_code': match_by_code,
            'matched_phone': match_by_phone,
            'package_title': [(l.get('titleEn') or l.get('titleAr')) for l in o.get('lines', []) if l.get('catalogCode') == catalog_code]
        })
        
    print(f"Status Breakdown: Paid/Active/Completed: {paid_count}, Abandoned: {abandoned_count}, Checked In (POS in-progress): {checked_in_count}")
    print(f"Total Revenue Captured: {revenue:,.2f} SAR")
    
    return order_list

orders_96 = inspect_campaign('DSC-00078', 'WATAN96 (96 SAR / 2 Months)')
orders_223 = inspect_campaign('DSC-00079', 'WATAN223 (223 SAR / 2 Months)')

print("\n=======================================================")
print("=== 2. MATCHING WITH YESTERDAY'S MESSAGED CUSTOMERS ===")
print("=======================================================")

matched_96 = [o for o in orders_96 if o['matched_code'] or o['matched_phone']]
matched_223 = [o for o in orders_223 if o['matched_code'] or o['matched_phone']]

print(f"WATAN96 matched to messaged customers: {len(matched_96)}")
for m in matched_96:
    print(f"  * {m['orderCode']} | Status: {m['status']} | Cust: {m['customerCode']} ({m['customerName']}) | Phone: {m['phone']} | Time: {m['createdAt']}")

print(f"WATAN223 matched to messaged customers: {len(matched_223)}")
for m in matched_223:
    print(f"  * {m['orderCode']} | Status: {m['status']} | Cust: {m['customerCode']} ({m['customerName']}) | Phone: {m['phone']} | Time: {m['createdAt']}")

print("\n=======================================================")
print("=== 3. ANY ORDERS AT ALL FROM MESSAGED CUSTOMERS?   ===")
print("=======================================================")
# Look for any order placed by the 384 customers since yesterday 15:00 UTC
recent_orders_by_messaged = list(db['rushwash_sale_orders'].find({
    'createdAt': {'\x24gte': datetime(2026, 9, 18, 15, 0, 0, tzinfo=timezone.utc)},
    '\x24or': [
        {'customerCode': {'\x24in': list(messaged_codes)}},
        {'customerSnapshot.readableCode': {'\x24in': list(messaged_codes)}},
        {'customerSnapshot.phone': {'\x24in': [f'+966{p}' for p in messaged_phones_set] + [f'966{p}' for p in messaged_phones_set] + [f'0{p}' for p in messaged_phones_set] + list(messaged_phones_set)}}
    ]
}))

print(f"Total sale orders of ANY KIND placed by messaged customers since SMS: {len(recent_orders_by_messaged)}")
for ro in recent_orders_by_messaged:
    c_snap = ro.get('customerSnapshot') or {}
    dt_local = ro.get('createdAt') + timedelta(hours=3) if ro.get('createdAt') else None
    print(f"  - Order: {ro.get('readableCode')}, Status: {ro.get('status')}, Customer: {c_snap.get('readableCode')} ({c_snap.get('name')}), Total: {ro.get('totalCaptured')}, Lines: {[l.get('titleEn') for l in ro.get('lines', [])]}, Time: {dt_local}")

print("\n=======================================================")
print("=== 4. ANY WASHES SINCE SMS BY MESSAGED CUSTOMERS?  ===")
print("=======================================================")
recent_washes_by_messaged = list(db['rushwash_wash_histories'].find({
    'createdAt': {'\x24gte': datetime(2026, 9, 18, 15, 0, 0, tzinfo=timezone.utc)},
    '\x24or': [
        {'customerCode': {'\x24in': list(messaged_codes)}},
        {'customerSnapshot.readableCode': {'\x24in': list(messaged_codes)}}
    ]
}))
print(f"Total washes performed by messaged customers since SMS: {len(recent_washes_by_messaged)}")
for rw in recent_washes_by_messaged:
    c_snap = rw.get('customerSnapshot') or {}
    dt_local = rw.get('createdAt') + timedelta(hours=3) if rw.get('createdAt') else None
    print(f"  - Wash: {rw.get('readableCode')}, Customer: {c_snap.get('readableCode')} ({c_snap.get('name')}), Plate: {rw.get('normalizedPlate')}, Time: {dt_local}")
