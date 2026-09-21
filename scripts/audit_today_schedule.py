import sys
import openpyxl
import re
from datetime import datetime, date

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

wb = openpyxl.load_workbook(r'c:\Users\Rush\Documents\antigravity\gallant-volta\watan96_mastersheet.xlsx', data_only=True)
ws = wb['WATAN96_Eligible_Master']
headers = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)]
col_sched = headers.index('Schedule sms') + 1
col_sent = headers.index('SMS Sent or No') + 1
col_code = headers.index('Customer Code') + 1
col_name = headers.index('Customer Name') + 1
col_phone = headers.index('Phone Number') + 1

today_records = []
invalid_numbers = []
already_sent = []

for r in range(2, ws.max_row + 1):
    val = ws.cell(row=r, column=col_sched).value
    is_today = False
    if isinstance(val, (datetime, date)):
        if val.year == 2026 and val.month == 9 and val.day == 19:
            is_today = True
    elif isinstance(val, (int, float)):
        if int(val) == 46284:
            is_today = True
    elif isinstance(val, str):
        s = val.strip()
        if '2026-09-19' in s or '19-09-2026' in s or '09-19-2026' in s or s == '46284':
            is_today = True
            
    if is_today:
        code = str(ws.cell(row=r, column=col_code).value or '').strip()
        name = str(ws.cell(row=r, column=col_name).value or '').strip()
        phone = str(ws.cell(row=r, column=col_phone).value or '').strip()
        sent = str(ws.cell(row=r, column=col_sent).value or '').strip().lower()
        
        clean = re.sub(r'[^0-9]', '', phone)
        if clean.startswith('0'):
            clean = clean[1:]
        if clean.startswith('966'):
            clean = clean[3:]
            
        is_valid = len(clean) == 9 and clean.startswith('5')
        
        if sent == 'yes':
            already_sent.append((r, code, name, phone))
            
        if is_valid:
            today_records.append({
                'row': r,
                'code': code,
                'name': name,
                'phone': '966' + clean,
                'sent': sent
            })
        else:
            invalid_numbers.append((r, code, name, phone, clean))

wb.close()

unique_phones = set(rec['phone'] for rec in today_records)

print(f"Total scheduled today (2026-09-19): {len(today_records) + len(invalid_numbers)}")
print(f"Valid Saudi mobile records: {len(today_records)}")
print(f"Unique valid Saudi phone numbers: {len(unique_phones)}")
print(f"Invalid numbers count: {len(invalid_numbers)}")
for inv in invalid_numbers:
    print(f"  Row {inv[0]} | Code: {inv[1]} | Name: {inv[2]} | Phone: {inv[3]} (Clean: {inv[4]})")

print(f"\nAlready marked as 'Yes' in SMS Sent or No: {len(already_sent)}")
for s in already_sent:
    print(f"  Row {s[0]} | Code: {s[1]} | Name: {s[2]} | Phone: {s[3]}")
