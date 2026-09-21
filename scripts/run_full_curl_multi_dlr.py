import os
import sys
import json
from datetime import datetime, timezone, timedelta
import paramiko
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

SSH_HOST = '72.60.185.87'
SSH_USER = 'root'
SSH_PASS = "+A')4bEMQn?ZwOO6eQ6s"

EXCEL_PATH = r"c:\Users\Rush\Documents\antigravity\gallant-volta\watan96_mastersheet.xlsx"
BACKUP_PATH = r"c:\Users\Rush\Documents\antigravity\gallant-volta\watan96_mastersheet_v2.xlsx"

today_rep_path = r"c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan96_sms_report_20260919_141152.json"
with open(today_rep_path, 'r', encoding='utf-8') as f:
    rep = json.load(f)

all_items = []
for r_idx, info in rep['row_map'].items():
    if info.get('message_id'):
        all_items.append({
            'row_idx': int(r_idx),
            'code': info['code'],
            'name': info['name'],
            'phone': info['phone'],
            'message_id': info['message_id']
        })

print(f"[*] Loaded {len(all_items)} messages to query with curl_multi...")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SSH_HOST, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)
sftp = ssh.open_sftp()

chunk_size = 200
chunks = [all_items[i:i + chunk_size] for i in range(0, len(all_items), chunk_size)]
final_dlr_results = {}

for c_idx, chunk in enumerate(chunks):
    mids = [it['message_id'] for it in chunk]
    php_code = f"""<?php
require '/home/ubuntu/rush-laravel-prod/vendor/autoload.php';
$app = require_once '/home/ubuntu/rush-laravel-prod/bootstrap/app.php';
$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
$kernel->bootstrap();

$baseUrl = config('services.unifonic.base_url', 'https://el.cloud.unifonic.com');
$appId = config('services.unifonic.app_id');
$mids = {json.dumps(mids)};

$mh = curl_multi_init();
$handles = [];

foreach ($mids as $mid) {{
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $baseUrl . '/rest/Messages/GetMessageIDStatus');
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'AppSid' => $appId,
        'MessageID' => $mid,
        'responseType' => 'json'
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
    curl_multi_add_handle($mh, $ch);
    $handles[$mid] = $ch;
}}

$running = null;
do {{
    curl_multi_exec($mh, $running);
    curl_multi_select($mh);
}} while ($running > 0);

$results = [];
foreach ($handles as $mid => $ch) {{
    $content = curl_multi_getcontent($ch);
    $json = json_decode($content, true);
    $results[$mid] = $json;
    curl_multi_remove_handle($mh, $ch);
    curl_close($ch);
}}
curl_multi_close($mh);

echo json_encode($results);
"""
    remote_script = f"/home/ubuntu/rush-laravel-prod/temp_cm_{c_idx}.php"
    with sftp.file(remote_script, 'w') as f:
        f.write(php_code)
        
    stdin, stdout, stderr = ssh.exec_command(f"cd /home/ubuntu/rush-laravel-prod && php {os.path.basename(remote_script)}")
    out = stdout.read().decode('utf-8').strip()
    try:
        sftp.remove(remote_script)
    except Exception:
        pass
        
    try:
        data = json.loads(out)
        final_dlr_results.update(data)
        print(f"  Chunk {c_idx+1}/{len(chunks)} ({len(mids)} items) done.")
    except Exception as e:
        print(f"  Chunk {c_idx+1} error: {e}")

sftp.close()
ssh.close()

# Categorize
detailed_rows = []
summary = {
    'DELIVERED': 0,
    'DND_REJECTED': 0,
    'ENROUTE_SENT': 0,
    'OTHER': 0
}

for item in all_items:
    mid = item['message_id']
    raw_res = final_dlr_results.get(mid, {})
    d = (raw_res or {}).get('data', {})
    st = d.get('Status', 'Unknown')
    dlr = d.get('DLR', 'Unknown')
    
    if dlr == 'DELIVERED':
        cat = 'Delivered'
        summary['DELIVERED'] += 1
    elif st == 'Rejected' or dlr == 'UNDELIVERED':
        cat = 'DND / Rejected'
        summary['DND_REJECTED'] += 1
    elif dlr == 'ENROUTE' or st == 'Sent':
        cat = 'Enroute'
        summary['ENROUTE_SENT'] += 1
    else:
        cat = 'Pending'
        summary['OTHER'] += 1
        
    detailed_rows.append({
        'row_idx': item['row_idx'],
        'customer_code': item['code'],
        'customer_name': item['name'],
        'phone': item['phone'],
        'message_id': mid,
        'status': st,
        'dlr': dlr,
        'category': cat
    })

print("\n==========================================")
print("=== FINAL CAMPAIGN DLR & DND SUMMARY ===")
print("==========================================")
print(f"Total Dispatched: {len(all_items)}")
print(f"Delivered: {summary['DELIVERED']}")
print(f"DND / Operator Rejected: {summary['DND_REJECTED']} ({(summary['DND_REJECTED']/len(all_items))*100:.1f}%)")
print(f"Enroute (In Transit): {summary['ENROUTE_SENT']} ({(summary['ENROUTE_SENT']/len(all_items))*100:.1f}%)")

# Update Mastersheet column 15
wb = openpyxl.load_workbook(EXCEL_PATH)
ws = wb['WATAN96_Eligible_Master']
headers = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)]
col_sent = headers.index('SMS Sent or No') + 1
col_dlr = headers.index('SMS Delivery Status') + 1

for r in detailed_rows:
    ws.cell(row=r['row_idx'], column=col_sent, value='Yes')
    ws.cell(row=r['row_idx'], column=col_dlr, value=r['category'])

wb.save(EXCEL_PATH)
wb.close()
print(f"[SUCCESS] Updated {EXCEL_PATH}.")

import shutil
shutil.copy2(EXCEL_PATH, BACKUP_PATH)
print(f"[SUCCESS] Synced {BACKUP_PATH}.")

# Export standalone Excel report
report_wb = openpyxl.Workbook()
ws_rep = report_wb.active
ws_rep.title = "SMS_Delivery_Report_Today"

rep_headers = ['Customer Code', 'Customer Name', 'Phone Number', 'Message ID', 'Gateway Status', 'DLR Status', 'Final Result']
ws_rep.append(rep_headers)
for c_i in range(1, len(rep_headers) + 1):
    c = ws_rep.cell(row=1, column=c_i)
    c.font = Font(name="Segoe UI", bold=True, color="FFFFFF")
    c.fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    c.alignment = Alignment(horizontal='center')

for r in detailed_rows:
    ws_rep.append([
        r['customer_code'],
        r['customer_name'],
        r['phone'],
        r['message_id'],
        r['status'],
        r['dlr'],
        r['category']
    ])

for col in ws_rep.columns:
    max_len = max(len(str(cell.value or '')) for cell in col)
    col_letter = get_column_letter(col[0].column)
    ws_rep.column_dimensions[col_letter].width = max(max_len + 3, 14)

excel_rep_path = r"c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan96_sms_dlr_report_20260919.xlsx"
report_wb.save(excel_rep_path)
print(f"[SUCCESS] Saved standalone Excel DLR report to: {excel_rep_path}")
