import os
import sys
import json
import time
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

# Load today's report
today_report_path = r"c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan96_sms_report_20260919_141152.json"
with open(today_report_path, 'r', encoding='utf-8') as f:
    today_rep = json.load(f)

# Load yesterday's report
yesterday_report_path = r"c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan96_sms_report_20260918_181250.json"
with open(yesterday_report_path, 'r', encoding='utf-8') as f:
    yesterday_rep = json.load(f)

print("[*] Connecting SSH to VPS...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SSH_HOST, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)
sftp = ssh.open_sftp()

def query_dlr_in_chunks(msg_id_list):
    print(f"[*] Querying {len(msg_id_list)} message statuses via Unifonic...")
    # In chunks of 100
    chunk_size = 100
    chunks = [msg_id_list[i:i + chunk_size] for i in range(0, len(msg_id_list), chunk_size)]
    results = {}
    
    for c_idx, ch in enumerate(chunks):
        php_code = f"""<?php
require '/home/ubuntu/rush-laravel-prod/vendor/autoload.php';
$app = require_once '/home/ubuntu/rush-laravel-prod/bootstrap/app.php';
$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
$kernel->bootstrap();

use Illuminate\\Support\\Facades\\Http;
use Illuminate\\Http\\Client\\Pool;

$baseUrl = config('services.unifonic.base_url', 'https://el.cloud.unifonic.com');
$appId = config('services.unifonic.app_id');
$chunk = {json.dumps(ch)};

$responses = Http::pool(function (Pool $pool) use ($chunk, $baseUrl, $appId) {{
    $reqs = [];
    foreach ($chunk as $idx => $mid) {{
        $reqs[$idx] = $pool->asForm()->timeout(10)->withOptions(['force_ip_resolve' => 'v4'])->post($baseUrl . '/rest/Messages/GetMessageIDStatus', [
            'AppSid' => $appId,
            'MessageID' => $mid,
            'responseType' => 'json'
        ]);
    }}
    return $reqs;
}});

$out = [];
foreach ($responses as $idx => $resp) {{
    $mid = $chunk[$idx];
    if ($resp instanceof \\Illuminate\\Http\\Client\\Response && $resp->successful()) {{
        $out[$mid] = $resp->json();
    }} else {{
        $out[$mid] = ['error' => 'query_failed'];
    }}
}}

echo json_encode($out);
"""
        remote_script = f"/home/ubuntu/rush-laravel-prod/temp_dlr_chunk_{c_idx}.php"
        with sftp.file(remote_script, 'w') as f:
            f.write(php_code)
            
        stdin, stdout, stderr = ssh.exec_command(f"cd /home/ubuntu/rush-laravel-prod && php {os.path.basename(remote_script)}")
        out = stdout.read().decode('utf-8').strip()
        try:
            sftp.remove(remote_script)
        except Exception:
            pass
            
        try:
            chunk_data = json.loads(out)
            results.update(chunk_data)
        except Exception as e:
            print(f"Error parsing chunk {c_idx}: {e}")
            
    return results

# Gather all message IDs from today's broadcast
today_msg_ids = []
row_to_mid = {}
for r_idx, info in today_rep.get('row_map', {}).items():
    mid = info.get('message_id')
    if mid:
        today_msg_ids.append(mid)
        row_to_mid[int(r_idx)] = mid

print(f"Total today message IDs: {len(today_msg_ids)}")
today_dlr_data = query_dlr_in_chunks(today_msg_ids)

# Parse stats
today_stats = {'DELIVERED': 0, 'DND_UNDELIVERED': 0, 'ENROUTE': 0, 'OTHER': 0}
row_status_map = {}

for r_idx, mid in row_to_mid.items():
    item = today_dlr_data.get(mid, {})
    d = (item or {}).get('data', {})
    st = d.get('Status')
    dlr = d.get('DLR')
    
    if dlr == 'DELIVERED':
        label = 'Delivered'
        today_stats['DELIVERED'] += 1
    elif st == 'Rejected' or dlr == 'UNDELIVERED':
        label = 'DND / Undelivered'
        today_stats['DND_UNDELIVERED'] += 1
    elif dlr == 'ENROUTE' or st == 'Sent':
        label = 'Enroute'
        today_stats['ENROUTE'] += 1
    else:
        label = dlr or st or 'Enroute'
        today_stats['OTHER'] += 1
        
    row_status_map[r_idx] = label

print("\n=== Today's SMS Delivery Report ===")
print(f"Total Broadcast: {len(today_msg_ids)}")
print(f"Delivered: {today_stats['DELIVERED']} ({(today_stats['DELIVERED']/len(today_msg_ids))*100:.1f}%)")
print(f"DND / Undelivered (CITC DND or Rejected): {today_stats['DND_UNDELIVERED']} ({(today_stats['DND_UNDELIVERED']/len(today_msg_ids))*100:.1f}%)")
print(f"Enroute (In Transit): {today_stats['ENROUTE']} ({(today_stats['ENROUTE']/len(today_msg_ids))*100:.1f}%)")

# Update Mastersheet column 15
print("[*] Updating mastersheet with exact delivery status per row...")
wb = openpyxl.load_workbook(EXCEL_PATH)
ws = wb['WATAN96_Eligible_Master']
headers = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)]

col_sent = headers.index('SMS Sent or No') + 1
if 'SMS Delivery Status' in headers:
    col_dlr = headers.index('SMS Delivery Status') + 1
else:
    col_dlr = len(headers) + 1
    ws.cell(row=1, column=col_dlr, value='SMS Delivery Status')
    ws.cell(row=1, column=col_dlr).font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    ws.cell(row=1, column=col_dlr).fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
    ws.cell(row=1, column=col_dlr).alignment = Alignment(horizontal='center', vertical='center')

for r_idx, lbl in row_status_map.items():
    ws.cell(row=r_idx, column=col_sent, value='Yes')
    ws.cell(row=r_idx, column=col_dlr, value=lbl)

wb.save(EXCEL_PATH)
wb.close()
print(f"[SUCCESS] Mastersheet updated.")

import shutil
shutil.copy2(EXCEL_PATH, BACKUP_PATH)
print(f"[SUCCESS] Synced backup to {BACKUP_PATH}.")

# Save summary report JSON
export_report_path = r"c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan96_sms_dlr_full_report_today.json"
with open(export_report_path, 'w', encoding='utf-8') as f:
    json.dump({
        "timestamp": datetime.now().isoformat(),
        "total": len(today_msg_ids),
        "summary": today_stats,
        "details": row_status_map
    }, f, indent=2)
print(f"[SUCCESS] Full DLR report saved to {export_report_path}.")

sftp.close()
ssh.close()
