import os
import sys
import json
import math
from datetime import datetime, date, timezone

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import dns.resolver
import pymongo
from dotenv import load_dotenv
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

load_dotenv()

# Configure DNS for MongoDB SRV lookups on Windows
resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '1.1.1.1']
dns.resolver.default_resolver = resolver

mongo_uri = os.getenv('MONGODB_URI')
client = pymongo.MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
db = client.get_database('rushwash')

workspace_dir = r"c:\Users\Rush\Documents\antigravity\gallant-volta"
output_xlsx = os.path.join(workspace_dir, "watan96_mastersheet.xlsx")

print("1. Fetching customers from live DB...")
customers = {}
cid_to_code = {}
for c in db['rushwash_customers'].find({}, {
    'readableCode': 1, 'name': 1, 'phone': 1, 'normalizedPhone': 1,
    'status': 1, 'createdAt': 1, 'registrationDate': 1
}):
    code = c.get('readableCode')
    cid = str(c.get('_id'))
    if cid and code:
        cid_to_code[cid] = code
    if code:
        reg_dt = c.get('registrationDate') or c.get('createdAt')
        customers[code] = {
            'id': cid,
            'code': code,
            'name': (c.get('name') or '').strip(),
            'phone': (c.get('phone') or c.get('normalizedPhone') or '').strip(),
            'status': c.get('status', 'active'),
            'regDate': reg_dt
        }

print(f"   Total customers: {len(customers)}")

print("2. Mapping customer plates (rushwash_vehicles)...")
plates_by_cust = {}
for v in db['rushwash_vehicles'].find({}, {'customerId': 1, 'customerSnapshot.readableCode': 1, 'displayPlate': 1, 'normalizedPlate': 1}):
    plate = (v.get('displayPlate') or v.get('normalizedPlate') or '').strip()
    if not plate:
        continue
    cc = (v.get('customerSnapshot') or {}).get('readableCode')
    cid = str(v.get('customerId')) if v.get('customerId') else None
    if cc:
        plates_by_cust.setdefault(cc, set()).add(plate)
    if cid and cid in cid_to_code:
        plates_by_cust.setdefault(cid_to_code[cid], set()).add(plate)

print(f"   Mapped plates for {len(plates_by_cust)} customers.")

print("3. Aggregating First Wash and Last Wash from wash histories...")
first_wash = {}
last_wash = {}
wash_count = {}

# Fast stream from latest local jsonl backup
wash_jsonl = os.path.join(workspace_dir, 'database/atlas_backup/latest/rushwash/rushwash_wash_histories.jsonl')
if os.path.exists(wash_jsonl):
    with open(wash_jsonl, 'r', encoding='utf-8') as f:
        for line in f:
            doc = json.loads(line)
            c_snap = doc.get('customerSnapshot')
            cc = c_snap.get('readableCode') if isinstance(c_snap, dict) else None
            if not cc:
                cid = doc.get('customerId')
                oid = cid.get('$oid') if isinstance(cid, dict) else str(cid) if cid else None
                cc = cid_to_code.get(oid)
            if not cc:
                continue
            
            wash_count[cc] = wash_count.get(cc, 0) + 1
            
            # Extract wash plate if customer has no registered vehicle plate
            w_plate = (doc.get('normalizedPlate') or (doc.get('vehicleSnapshot') or {}).get('displayPlate') or '').strip()
            if w_plate and w_plate != 'N/A':
                plates_by_cust.setdefault(cc, set()).add(w_plate)

            wdt_val = doc.get('washDate') or doc.get('createdAt')
            if isinstance(wdt_val, dict) and '$date' in wdt_val:
                dt_str = str(wdt_val['$date']).replace('Z', '+00:00')
                try:
                    wdt = datetime.fromisoformat(dt_str)
                    if cc not in first_wash or wdt < first_wash[cc]:
                        first_wash[cc] = wdt
                    if cc not in last_wash or wdt > last_wash[cc]:
                        last_wash[cc] = wdt
                except:
                    pass

print(f"   Wash history aggregated for {len(wash_count)} customers.")

print("4. Identifying customers who previously bought a package...")
package_cust_codes = set()
for s in db['rushwash_subscriptions'].find({}, {'customerId': 1, 'customerCode': 1, 'customerSnapshot.readableCode': 1}):
    cid = str(s.get('customerId')) if s.get('customerId') else None
    cc = s.get('customerCode') or (s.get('customerSnapshot') or {}).get('readableCode')
    if cc: package_cust_codes.add(cc)
    if cid and cid in cid_to_code: package_cust_codes.add(cid_to_code[cid])

for o in db['rushwash_sale_orders'].find({'lines.lineKind': 'package', 'status': {'\x24in': ['paid', 'active', 'completed']}}, {'customerId': 1, 'customerCode': 1, 'customerSnapshot.readableCode': 1}):
    cid = str(o.get('customerId')) if o.get('customerId') else None
    cc = o.get('customerCode') or (o.get('customerSnapshot') or {}).get('readableCode')
    if cc: package_cust_codes.add(cc)
    if cid and cid in cid_to_code: package_cust_codes.add(cid_to_code[cid])

print(f"   Past package buyers: {len(package_cust_codes)}")

print("5. Computing Total Spent per customer from sale orders...")
total_spent = {}
seen_order_ids = set()

# Fast read from latest local orders backup
orders_jsonl = os.path.join(workspace_dir, 'database/atlas_backup/latest/rushwash/rushwash_sale_orders.jsonl')
if os.path.exists(orders_jsonl):
    with open(orders_jsonl, 'r', encoding='utf-8') as f:
        for line in f:
            doc = json.loads(line)
            oid = doc.get('_id', {}).get('$oid') if isinstance(doc.get('_id'), dict) else str(doc.get('_id'))
            if oid:
                seen_order_ids.add(oid)
            
            if doc.get('status') in ['paid', 'active', 'completed']:
                c_snap = doc.get('customerSnapshot') or {}
                cc = c_snap.get('readableCode') or doc.get('customerCode')
                if not cc:
                    cid = doc.get('customerId')
                    cid_val = cid.get('$oid') if isinstance(cid, dict) else str(cid) if cid else None
                    cc = cid_to_code.get(cid_val)
                if not cc:
                    continue
                amt = float(doc.get('totalCaptured') or doc.get('postDiscountTotal') or 0.0)
                total_spent[cc] = total_spent.get(cc, 0.0) + amt

# Also merge recent orders from live DB for today to ensure up-to-the-minute spend
today_start = datetime(2026, 9, 18, 0, 0, 0, tzinfo=timezone.utc)
for doc in db['rushwash_sale_orders'].find({
    'createdAt': {'\x24gte': today_start},
    'status': {'\x24in': ['paid', 'active', 'completed']}
}, {'customerSnapshot.readableCode': 1, 'customerCode': 1, 'customerId': 1, 'totalCaptured': 1, 'postDiscountTotal': 1}):
    oid = str(doc.get('_id'))
    if oid in seen_order_ids:
        continue
    seen_order_ids.add(oid)
    c_snap = doc.get('customerSnapshot') or {}
    cc = c_snap.get('readableCode') or doc.get('customerCode')
    if not cc:
        cid_val = str(doc.get('customerId')) if doc.get('customerId') else None
        cc = cid_to_code.get(cid_val)
    if not cc:
        continue
    amt = float(doc.get('totalCaptured') or doc.get('postDiscountTotal') or 0.0)
    total_spent[cc] = total_spent.get(cc, 0.0) + amt

print(f"   Total spent computed for {len(total_spent)} customers.")

print("6. Checking SMS history across all campaigns & WATAN96...")
messaged_campaigns = {}
for c in db['rushwash_crm_campaigns'].find():
    cmp_code = c.get('readableCode')
    for cc in (c.get('qualifyMessagedCustomerCodes') or []):
        messaged_campaigns.setdefault(cc, []).append(cmp_code)

print("7. Loading WATAN96 redemptions...")
redeemed_customers = {}
for r in db['rushwash_coupon_redemptions'].find({'couponReadableCode': 'DSC-00078'}):
    cc = r.get('customerCode')
    if cc:
        redeemed_customers[cc] = {
            'orderCode': r.get('orderCode'),
            'redeemedAt': r.get('redeemedAt')
        }

for o in db['rushwash_sale_orders'].find({'lines.catalogCode': 'DSC-00078', 'status': {'\x24in': ['paid', 'active', 'completed']}}):
    cc = (o.get('customerSnapshot') or {}).get('readableCode') or o.get('customerCode')
    if cc:
        redeemed_customers[cc] = {
            'orderCode': o.get('readableCode'),
            'orderStatus': o.get('status'),
            'totalCaptured': o.get('totalCaptured', 96),
            'redeemedAt': o.get('completedAt') or o.get('createdAt')
        }

print(f"   WATAN96 redeemed customers: {len(redeemed_customers)}")

print("8. Loading POS suggestion events for CMP-00017...")
suggested_events = list(db['rushwash_audit_events'].find({'entityReadableCode': 'CMP-00017', 'eventType': 'crm.promotional.suggested'}))
suggested_custs = {}
for e in suggested_events:
    cc = (e.get('after') or {}).get('customerCode')
    dt = e.get('occurredAt')
    if cc and dt:
        suggested_custs.setdefault(cc, []).append(dt)

print(f"   POS suggestions: {len(suggested_events)} events across {len(suggested_custs)} unique customers.")

# -------------------------------------------------------------
# CREATE EXCEL WORKBOOK WITH OPENPYXL
# -------------------------------------------------------------
print("9. Building Excel workbook with styled sheets...")
wb = openpyxl.Workbook()
wb.remove(wb.active)  # Remove default blank sheet

# Styling presets
header_fill_navy = PatternFill(start_color="1B365D", end_color="1B365D", fill_type="solid")
header_fill_teal = PatternFill(start_color="005F73", end_color="005F73", fill_type="solid")
header_fill_green = PatternFill(start_color="2A9D8F", end_color="2A9D8F", fill_type="solid")

font_header = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
font_data = Font(name="Segoe UI", size=10)
font_bold = Font(name="Segoe UI", size=10, bold=True)
font_title = Font(name="Segoe UI", size=14, bold=True, color="1B365D")

thin_border = Border(
    left=Side(style='thin', color="E0E0E0"),
    right=Side(style='thin', color="E0E0E0"),
    top=Side(style='thin', color="E0E0E0"),
    bottom=Side(style='thin', color="E0E0E0")
)

def to_date_obj(dt):
    """
    Converts datetime, string, or date to a Python datetime.date object.
    When written to openpyxl, Excel recognizes it as an actual Date cell (data_type='d').
    Returns None if empty.
    """
    if not dt:
        return None
    if isinstance(dt, datetime):
        return dt.date()
    if isinstance(dt, date):
        return dt
    try:
        s = str(dt).replace('Z', '+00:00')
        return datetime.fromisoformat(s).date()
    except:
        return None

def to_naive_utc(dt):
    if not dt:
        return datetime.min
    if isinstance(dt, datetime):
        if dt.tzinfo is not None:
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    try:
        s = str(dt).replace('Z', '+00:00')
        d = datetime.fromisoformat(s)
        if d.tzinfo is not None:
            return d.astimezone(timezone.utc).replace(tzinfo=None)
        return d
    except:
        return datetime.min

def get_wash_dates(cc):
    """
    If there is 1 wash only, keep only first wash (Last Wash is None).
    If >1 wash, both First Wash and Last Wash are actual date objects.
    If 0 washes, both are None.
    """
    t_washes = wash_count.get(cc, 0)
    if t_washes == 1:
        fw = to_date_obj(first_wash.get(cc))
        lw = None
    elif t_washes > 1:
        fw = to_date_obj(first_wash.get(cc))
        lw = to_date_obj(last_wash.get(cc))
    else:
        fw = None
        lw = None
    return t_washes, fw, lw

def get_spend_cohort(spent):
    """
    Generates spend cohort label based on amount spent:
    0-100 (for spent <= 100)
    101-200 (for 100 < spent <= 200)
    201-300 (for 200 < spent <= 300)
    and so forth in increments of 100 SAR.
    """
    if spent is None or spent <= 0:
        return "0-100"
    if spent <= 100:
        return "0-100"
    lower = math.floor((spent - 0.0001) / 100) * 100 + 1
    upper = lower + 99
    return f"{lower}-{upper}"

# -------------------------------------------------------------
# SHEET 1: WATAN96 Mastersheet (All Eligible Customers)
# -------------------------------------------------------------
ws_master = wb.create_sheet(title="WATAN96_Eligible_Master")
ws_master.views.sheetView[0].showGridLines = True

headers_master = [
    "Cohort",
    "Customer Code",
    "Customer Name",
    "Customer Plate",
    "Phone Number",
    "Reg Date",
    "Total Spent (SAR)",
    "Number of Washes",
    "First Wash",
    "Last Wash",
    "SMS Sent or No",
    "SMS Sent in Other Campaign",
    "Evaluated at POS Today"
]

ws_master.append(headers_master)
for col_idx in range(1, len(headers_master) + 1):
    cell = ws_master.cell(row=1, column=col_idx)
    cell.fill = header_fill_navy
    cell.font = font_header
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
ws_master.row_dimensions[1].height = 28

all_eligible_codes = [cc for cc in customers.keys() if cc not in package_cust_codes and cc not in redeemed_customers]

# ONLY SORT BASED ON LAST WASH DATE (descending - most recent wash first)
all_eligible_codes.sort(
    key=lambda cc: (to_naive_utc(last_wash.get(cc)), to_naive_utc(customers[cc].get('regDate'))),
    reverse=True
)

for cc in all_eligible_codes:
    cust = customers.get(cc, {})
    spent = round(total_spent.get(cc, 0.0), 2)
    cohort_label = get_spend_cohort(spent)
    plates = ", ".join(sorted(plates_by_cust.get(cc, []))) or "No plate registered"
    reg_date_obj = to_date_obj(cust.get('regDate'))
    t_washes, fw_obj, lw_obj = get_wash_dates(cc)
    
    sms_watan = "No"
    other_sms = ", ".join(messaged_campaigns.get(cc, [])) if cc in messaged_campaigns else "No"
    pos_eval = "Yes" if cc in suggested_custs else "No"
    
    ws_master.append([
        cohort_label,
        cc,
        cust.get('name', ''),
        plates,
        cust.get('phone', ''),
        reg_date_obj,
        spent,
        t_washes,
        fw_obj,
        lw_obj,
        sms_watan,
        other_sms,
        pos_eval
    ])

# -------------------------------------------------------------
# SHEET 2: High-Intent POS-Suggested Unredeemed
# -------------------------------------------------------------
ws_pos = wb.create_sheet(title="High_Intent_POS_Suggested")
ws_pos.views.sheetView[0].showGridLines = True

headers_pos = [
    "Cohort",
    "Customer Code",
    "Customer Name",
    "Customer Plate",
    "Phone Number",
    "Reg Date",
    "Total Spent (SAR)",
    "Number of Washes",
    "First Wash",
    "Last Wash",
    "SMS Sent or No",
    "POS Suggestion Count",
    "First POS Suggestion",
    "Latest POS Suggestion"
]

ws_pos.append(headers_pos)
for col_idx in range(1, len(headers_pos) + 1):
    cell = ws_pos.cell(row=1, column=col_idx)
    cell.fill = header_fill_teal
    cell.font = font_header
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
ws_pos.row_dimensions[1].height = 28

unredeemed_suggested_codes = [cc for cc in sorted(suggested_custs.keys()) if cc not in redeemed_customers]

# ONLY SORT BASED ON LAST WASH DATE (descending)
unredeemed_suggested_codes.sort(
    key=lambda cc: (to_naive_utc(last_wash.get(cc)), max([to_naive_utc(t) for t in suggested_custs[cc]]) if suggested_custs.get(cc) else datetime.min),
    reverse=True
)

for cc in unredeemed_suggested_codes:
    cust = customers.get(cc, {})
    spent = round(total_spent.get(cc, 0.0), 2)
    cohort_label = get_spend_cohort(spent)
    plates = ", ".join(sorted(plates_by_cust.get(cc, []))) or "No plate registered"
    reg_date_obj = to_date_obj(cust.get('regDate'))
    t_washes, fw_obj, lw_obj = get_wash_dates(cc)
    
    s_times = sorted(suggested_custs[cc])
    first_s = to_date_obj(s_times[0]) if s_times else None
    latest_s = to_date_obj(s_times[-1]) if s_times else None
    s_count = len(s_times)
    
    ws_pos.append([
        cohort_label,
        cc,
        cust.get('name', ''),
        plates,
        cust.get('phone', ''),
        reg_date_obj,
        spent,
        t_washes,
        fw_obj,
        lw_obj,
        "No",
        s_count,
        first_s,
        latest_s
    ])

# -------------------------------------------------------------
# SHEET 3: Redeemed Customers
# -------------------------------------------------------------
ws_red = wb.create_sheet(title="Redeemed_Customers")
ws_red.views.sheetView[0].showGridLines = True

headers_red = [
    "Cohort",
    "Customer Code",
    "Customer Name",
    "Customer Plate",
    "Phone Number",
    "Reg Date",
    "Total Spent (SAR)",
    "Number of Washes",
    "First Wash",
    "Last Wash",
    "Order Code",
    "Order Status",
    "Amount Paid (SAR)",
    "Redemption Date",
    "SMS Sent or No"
]

ws_red.append(headers_red)
for col_idx in range(1, len(headers_red) + 1):
    cell = ws_red.cell(row=1, column=col_idx)
    cell.fill = header_fill_green
    cell.font = font_header
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
ws_red.row_dimensions[1].height = 28

redeemed_codes = list(redeemed_customers.keys())
redeemed_codes.sort(key=lambda cc: to_naive_utc(last_wash.get(cc)), reverse=True)

for cc in redeemed_codes:
    rinfo = redeemed_customers[cc]
    cust = customers.get(cc, {})
    spent = round(total_spent.get(cc, 0.0), 2)
    cohort_label = get_spend_cohort(spent)
    plates = ", ".join(sorted(plates_by_cust.get(cc, []))) or "No plate registered"
    reg_date_obj = to_date_obj(cust.get('regDate'))
    t_washes, fw_obj, lw_obj = get_wash_dates(cc)
    red_dt = rinfo.get('redeemedAt')
    red_date_obj = to_date_obj(red_dt)
    
    ws_red.append([
        cohort_label,
        cc,
        cust.get('name', ''),
        plates,
        cust.get('phone', ''),
        reg_date_obj,
        spent,
        t_washes,
        fw_obj,
        lw_obj,
        rinfo.get('orderCode', ''),
        rinfo.get('orderStatus', 'paid'),
        rinfo.get('totalCaptured', 96),
        red_date_obj,
        "No"
    ])

# -------------------------------------------------------------
# SHEET 4: Executive Summary / KPI Dashboard
# -------------------------------------------------------------
ws_summary = wb.create_sheet(title="Campaign_Overview", index=0)
ws_summary.views.sheetView[0].showGridLines = True

summary_rows = [
    ["RUSH WASH — WATAN96 CAMPAIGN MASTER SUMMARY", ""],
    ["Generated At:", datetime.now(timezone.utc).strftime('%m-%d-%Y %H:%M:%S')],
    ["Campaign Code:", "CMP-00017"],
    ["Promotion Title:", "Watan 96 (National Day Promotion)"],
    ["Discount / Coupon Code:", "WATAN96 (DSC-00078)"],
    ["Offer Terms:", "96 SAR for 2 Months on Nano, Shiny, Fresh Packages"],
    ["Target Audience Preset:", "never_purchased_package (Never subscribed to a package)"],
    ["Campaign Status:", "LIVE (Valid: 09-17-2026 to 10-04-2026)"],
    ["Sorting Rule Applied:", "Sorted strictly based on Last Wash Date descending"],
    ["Wash Display Rule Applied:", "If only 1 wash exists, kept only in First Wash (Last Wash blank)"],
    ["Date Formatting Rule Applied:", "Real Excel Date objects formatted with format MM-DD-YYYY"],
    ["Cohort Column Added:", "Cohorts bucketed by total amount spent in 100 SAR increments (0-100, 101-200, 201-300...)"],
    ["Spend Field Added:", "Total Spent (SAR) per customer across all paid orders"],
    ["", ""],
    ["AUDIENCE METRICS", "COUNT"],
    ["Total Registered Customers in DB:", len(customers)],
    ["Past Package Buyers (Ineligible):", len(package_cust_codes)],
    ["Total Database Eligible Audience:", len(all_eligible_codes) + len(redeemed_customers)],
    ["Customers Who Redeemed WATAN96:", len(redeemed_customers)],
    ["Total Database Eligible Unredeemed:", len(all_eligible_codes)],
    ["", ""],
    ["POS IN-SHOP EVALUATION TODAY", "COUNT"],
    ["Unique Customers Evaluated at POS:", len(suggested_custs)],
    ["POS Suggestion Audit Events:", len(suggested_events)],
    ["Evaluated & Successfully Converted:", len(redeemed_customers)],
    ["High-Intent Evaluated Unredeemed (Primary Retargeting Target):", len(unredeemed_suggested_codes)],
    ["", ""],
    ["SMS BROADCAST STATUS", "STATUS"],
    ["WATAN96 SMS Sent:", "NO (Broadcast pending)"],
    ["Eligible Customers Previously Messaged (Other Campaigns):", len([cc for cc in all_eligible_codes if cc in messaged_campaigns])],
]

for row in summary_rows:
    ws_summary.append(row)

# Style Summary
ws_summary.cell(row=1, column=1).font = font_title
ws_summary.row_dimensions[1].height = 25
ws_summary.column_dimensions['A'].width = 56
ws_summary.column_dimensions['B'].width = 32

for r in [15, 22, 27]:
    ws_summary.cell(row=r, column=1).fill = header_fill_navy
    ws_summary.cell(row=r, column=1).font = font_header
    ws_summary.cell(row=r, column=2).fill = header_fill_navy
    ws_summary.cell(row=r, column=2).font = font_header

# Formatting mappings for specific sheets
sheet_date_cols = {
    "WATAN96_Eligible_Master": ['F', 'I', 'J'],
    "High_Intent_POS_Suggested": ['F', 'I', 'J', 'M', 'N'],
    "Redeemed_Customers": ['F', 'I', 'J', 'N']
}

for ws in [ws_master, ws_pos, ws_red]:
    ws.freeze_panes = "A2"
    date_cols = sheet_date_cols.get(ws.title, ['F', 'I', 'J'])
    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 14)
        for cell in col:
            if cell.row > 1:
                cell.font = font_data
                cell.border = thin_border
                if col_letter in date_cols:
                    cell.number_format = 'mm-dd-yyyy'
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                elif col_letter == 'G':  # Total Spent (SAR)
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                    cell.number_format = '#,##0.00'
                elif col_letter == 'M' and ws.title == 'Redeemed_Customers':
                    cell.alignment = Alignment(horizontal="right", vertical="center")
                    cell.number_format = '#,##0.00'
                elif col_letter in ['A', 'B', 'E', 'H', 'K', 'L']:
                    cell.alignment = Alignment(horizontal="center", vertical="center")

saved_path = output_xlsx
try:
    wb.save(output_xlsx)
except PermissionError:
    saved_path = os.path.join(workspace_dir, "watan96_mastersheet_v2.xlsx")
    wb.save(saved_path)
    print(f"Note: {output_xlsx} is locked. Saved to: {saved_path}")

print(f"10. Successfully saved Master Excel spreadsheet: {saved_path}")

# Attempt to sync back to output_xlsx if possible
if saved_path != output_xlsx:
    import shutil
    try:
        shutil.copyfile(saved_path, output_xlsx)
        print(f"    Also synced to {output_xlsx}")
    except:
        pass
