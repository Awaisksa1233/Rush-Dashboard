import os
import sys
import re
import json
import time
import argparse
from datetime import datetime, date, timedelta
import paramiko
import openpyxl

# Set utf-8 stdout for Windows console
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# SSH configuration
SSH_HOST     = '72.60.185.87'
SSH_PORT     = 22
SSH_USER     = 'root'
SSH_PASSWORD = "+A')4bEMQn?ZwOO6eQ6s"

# SMS Campaign configuration
SENDER_ID = "RushWash-AD"

MESSAGE = (
    "عرض اليوم الوطني من رش واش!\n\n"
    "غسيل خارجي نانو لا محدود بـ 96 ريال شهريًا لأول شهرين بدلًا من 249 ريال. "
    "العرض للمشتركين الجدد ولفترة محدودة. اشترك الآن عبر rush.com.sa أو عبر مسار المبيعات."
)

EXCEL_PATH = r"c:\Users\Rush\Documents\antigravity\gallant-volta\watan96_mastersheet.xlsx"
BACKUP_PATH = r"c:\Users\Rush\Documents\antigravity\gallant-volta\watan96_mastersheet_v2.xlsx"

def connect_ssh():
    print(f"[*] Connecting SSH to VPS ({SSH_HOST})...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, password=SSH_PASSWORD, timeout=15)
    return ssh

def execute_remote_bulk_send(ssh, phones, message, sender_id=SENDER_ID):
    """Writes a temporary PHP script on VPS, executes it to send SMS using Unifonic SendBulk endpoint, then deletes it."""
    sftp = ssh.open_sftp()
    
    php_phones_array = "[" + ",".join([f"'{p}'" for p in phones]) + "]"
    escaped_message = message.replace('\\', '\\\\').replace('"', '\\"').replace('$', '\\$')
    
    php_code = f"""<?php
require '/home/ubuntu/rush-laravel-prod/vendor/autoload.php';
$app = require_once '/home/ubuntu/rush-laravel-prod/bootstrap/app.php';
$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
$kernel->bootstrap();

use Illuminate\\Support\\Facades\\Http;

$phones = {php_phones_array};
$message = "{escaped_message}";

$baseUrl = config('services.unifonic.base_url', 'https://el.cloud.unifonic.com');
$appId = config('services.unifonic.app_id');
$sender = "{sender_id}"; 

function formatPhone($num) {{
    $clean = preg_replace('/[^0-9+]/', '', $num);
    if (str_starts_with($clean, '+')) {{
        $clean = substr($clean, 1);
    }}
    if (str_starts_with($clean, '0')) {{
        $clean = '966' . substr($clean, 1);
    }}
    if (!str_starts_with($clean, '966')) {{
        $clean = '966' . $clean;
    }}
    return $clean;
}}

$formattedPhones = array_map('formatPhone', $phones);
$recipientsString = implode(',', $formattedPhones);

try {{
    $response = Http::timeout(60)
        ->withOptions(['force_ip_resolve' => 'v4'])
        ->withHeaders([
            'Accept' => 'application/json',
            'Content-Type' => 'application/x-www-form-urlencoded',
        ])
        ->asForm()
        ->post($baseUrl . '/rest/Messages/SendBulk', [
            'AppSid' => $appId,
            'SenderID' => $sender,
            'Body' => $message,
            'Recipient' => $recipientsString,
            'responseType' => 'json',
        ]);

    $responseData = $response->json();

    if ($response->successful() && isset($responseData['success']) && ($responseData['success'] === true || $responseData['success'] === 'true')) {{
        echo json_encode([
            'success' => true,
            'message' => 'SMS sent successfully',
            'response' => $responseData,
            'provider' => 'unifonic'
        ]);
    }} else {{
        $errorMsg = $responseData['message'] ?? $responseData['error'] ?? 'Unknown API Error';
        echo json_encode([
            'success' => false,
            'message' => 'Failed to send SMS',
            'error' => $errorMsg,
            'response' => $responseData,
            'provider' => 'unifonic'
        ]);
    }}
}} catch (\\Exception $e) {{
    echo json_encode([
        'success' => false,
        'message' => 'Failed to send SMS due to exception',
        'error' => $e->getMessage(),
        'provider' => 'unifonic'
    ]);
}}
"""
    
    remote_script_path = f"/home/ubuntu/rush-laravel-prod/temp_watan96_{int(time.time()*1000)}.php"
    
    with sftp.file(remote_script_path, 'w') as f:
        f.write(php_code)
        
    cmd = f"cd /home/ubuntu/rush-laravel-prod && php {os.path.basename(remote_script_path)}"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8').strip()
    err = stderr.read().decode('utf-8').strip()
    
    try:
        sftp.remove(remote_script_path)
    except Exception:
        pass
    sftp.close()
    
    if err:
        return {"success": False, "error": err, "response": out}
    
    try:
        return json.loads(out)
    except Exception as e:
        return {"success": False, "error": f"Failed to parse response: {e}. Output was: {out}"}

def query_remote_dlr_batch(ssh, message_ids):
    """Queries Unifonic GetMessageIDStatus for a list of message IDs via VPS."""
    sftp = ssh.open_sftp()
    
    php_code = f"""<?php
require '/home/ubuntu/rush-laravel-prod/vendor/autoload.php';
$app = require_once '/home/ubuntu/rush-laravel-prod/bootstrap/app.php';
$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
$kernel->bootstrap();

use Illuminate\\Support\\Facades\\Http;

$baseUrl = config('services.unifonic.base_url', 'https://el.cloud.unifonic.com');
$appId = config('services.unifonic.app_id');
$msgIds = {json.dumps(message_ids)};

$results = [];
foreach ($msgIds as $mid) {{
    try {{
        $r = Http::timeout(10)->withOptions(['force_ip_resolve' => 'v4'])->asForm()->post($baseUrl . '/rest/Messages/GetMessageIDStatus', [
            'AppSid' => $appId,
            'MessageID' => $mid,
            'responseType' => 'json'
        ]);
        $results[$mid] = $r->json();
    }} catch (\\Exception $e) {{
        $results[$mid] = ['success' => false, 'error' => $e->getMessage()];
    }}
}}
echo json_encode($results);
"""
    remote_script_path = f"/home/ubuntu/rush-laravel-prod/temp_dlr_{int(time.time()*1000)}.php"
    with sftp.file(remote_script_path, 'w') as f:
        f.write(php_code)
        
    cmd = f"cd /home/ubuntu/rush-laravel-prod && php {os.path.basename(remote_script_path)}"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8').strip()
    err = stderr.read().decode('utf-8').strip()
    
    try:
        sftp.remove(remote_script_path)
    except Exception:
        pass
    sftp.close()
    
    try:
        return json.loads(out)
    except Exception as e:
        return {"error": f"Failed to parse DLR response: {e}. Output: {out}"}

def load_scheduled_today_recipients(excel_path=EXCEL_PATH):
    print(f"[*] Loading today's scheduled recipients from: {excel_path}")
    wb = openpyxl.load_workbook(excel_path, data_only=True)
    ws = wb['WATAN96_Eligible_Master']
    
    headers = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)]
    col_sched = headers.index('Schedule sms') + 1
    col_sent = headers.index('SMS Sent or No') + 1
    col_code = headers.index('Customer Code') + 1
    col_name = headers.index('Customer Name') + 1
    col_phone = headers.index('Phone Number') + 1
    
    valid_targets = []
    already_sent = []
    invalid_targets = []
    
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
            raw_phone = str(ws.cell(row=r, column=col_phone).value or '').strip()
            sent_val = str(ws.cell(row=r, column=col_sent).value or '').strip().lower()
            
            if sent_val == 'yes':
                already_sent.append({'row_idx': r, 'code': code, 'name': name, 'phone': raw_phone})
                continue
                
            clean = re.sub(r'[^0-9]', '', raw_phone)
            if clean.startswith('0'):
                clean = clean[1:]
            if clean.startswith('966'):
                clean = clean[3:]
                
            if len(clean) == 9 and clean.startswith('5'):
                valid_targets.append({
                    'row_idx': r,
                    'customer_code': code,
                    'customer_name': name,
                    'phone': '966' + clean,
                    'raw_phone': raw_phone
                })
            else:
                invalid_targets.append({
                    'row_idx': r,
                    'customer_code': code,
                    'customer_name': name,
                    'phone': raw_phone,
                    'clean': clean
                })
                
    wb.close()
    return valid_targets, already_sent, invalid_targets

def update_excel_sent_and_dlr(excel_path, row_dlr_map):
    """Updates SMS Sent or No to 'Yes' and adds/updates 'SMS Delivery Status' column."""
    print(f"[*] Updating mastersheet: {excel_path}...")
    wb = openpyxl.load_workbook(excel_path)
    ws = wb['WATAN96_Eligible_Master']
    
    headers = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)]
    col_sent = headers.index('SMS Sent or No') + 1
    
    # Check or create SMS Delivery Status column
    if 'SMS Delivery Status' in headers:
        col_dlr = headers.index('SMS Delivery Status') + 1
    else:
        col_dlr = len(headers) + 1
        ws.cell(row=1, column=col_dlr, value='SMS Delivery Status')
        # copy header style
        ref_cell = ws.cell(row=1, column=col_sent)
        cell_dlr = ws.cell(row=1, column=col_dlr)
        cell_dlr.font = openpyxl.styles.Font(name=ref_cell.font.name, size=ref_cell.font.size, bold=True, color="FFFFFF")
        cell_dlr.fill = openpyxl.styles.PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
        cell_dlr.alignment = openpyxl.styles.Alignment(horizontal='center', vertical='center')

    for r_idx, info in row_dlr_map.items():
        ws.cell(row=r_idx, column=col_sent, value='Yes')
        if 'dlr_status' in info:
            ws.cell(row=r_idx, column=col_dlr, value=info['dlr_status'])
            
    wb.save(excel_path)
    wb.close()
    print(f"[SUCCESS] Updated {len(row_dlr_map)} rows in {excel_path}.")
    
    import shutil
    shutil.copy2(excel_path, BACKUP_PATH)
    print(f"[SUCCESS] Synced to {BACKUP_PATH}.")

def main():
    parser = argparse.ArgumentParser(description="Send WATAN96 Promo SMS via Unifonic")
    parser.add_argument('--test', nargs='?', const='966569809578', help="Send a test SMS to specified phone")
    parser.add_argument('--send-today', action='store_true', help="Broadcast SMS to all customers scheduled for today")
    parser.add_argument('--query-dlr', type=str, help="Query delivery/DND status for a JSON report file")
    parser.add_argument('--yes', action='store_true', help="Skip interactive confirmation")
    args = parser.parse_args()
    
    if not args.test and not args.send_today and not args.query_dlr:
        print("[!] Please specify --test [PHONE], --send-today, or --query-dlr [REPORT_PATH]")
        parser.print_help()
        sys.exit(1)
        
    ssh = connect_ssh()
    
    try:
        if args.test:
            test_number = args.test.strip()
            clean = re.sub(r'[^0-9]', '', test_number)
            if clean.startswith('0'):
                clean = '966' + clean[1:]
            elif not clean.startswith('966'):
                clean = '966' + clean
            print(f"[*] Dispatching single TEST SMS to {clean} using Sender ID '{SENDER_ID}'...")
            res = execute_remote_bulk_send(ssh, [clean], MESSAGE, sender_id=SENDER_ID)
            print("[Result]:", json.dumps(res, indent=2, ensure_ascii=False))
            
        elif args.send_today:
            valid_targets, already_sent, invalid_targets = load_scheduled_today_recipients(EXCEL_PATH)
            total = len(valid_targets)
            
            print(f"\n=== WATAN96 Campaign Broadcast (Schedule: Today 2026-09-19) ===")
            print(f"Sender ID: {SENDER_ID}")
            print(f"Total Valid Targets to Send: {total}")
            print(f"Already Sent (Excluded): {len(already_sent)}")
            print(f"Invalid / Malformed (Excluded): {len(invalid_targets)}")
            
            if total == 0:
                print("[!] No valid recipients found.")
                return
                
            chunk_size = 200
            chunks = [valid_targets[i:i + chunk_size] for i in range(0, total, chunk_size)]
            print(f"[*] Prepared {len(chunks)} batches for {total} recipients.")
            
            all_messages = []
            successful_sent = 0
            failed_sent = 0
            batch_results = []
            row_map = {}
            
            for idx, chunk in enumerate(chunks):
                phones = [item['phone'] for item in chunk]
                print(f"  -> Dispatching Batch {idx + 1}/{len(chunks)} ({len(phones)} recipients)...")
                res = execute_remote_bulk_send(ssh, phones, MESSAGE, sender_id=SENDER_ID)
                
                batch_results.append({
                    "batch": idx + 1,
                    "count": len(phones),
                    "success": res.get('success', False),
                    "response": res
                })
                
                if res.get('success'):
                    successful_sent += len(phones)
                    msgs = res.get('response', {}).get('data', {}).get('Messages', [])
                    print(f"     [Batch {idx + 1}]: SUCCESS - Queued {len(msgs)} messages.")
                    # Match messages to recipients
                    for i_msg, item in enumerate(chunk):
                        m_id = msgs[i_msg].get('MessageID') if i_msg < len(msgs) else None
                        row_map[item['row_idx']] = {
                            'code': item['customer_code'],
                            'name': item['customer_name'],
                            'phone': item['phone'],
                            'message_id': str(m_id) if m_id else None,
                            'dlr_status': 'Sent'
                        }
                else:
                    failed_sent += len(phones)
                    print(f"     [Batch {idx + 1}]: FAILED - Error: {res.get('error')}")
                
                # Small delay between batches to avoid rate limits
                if idx < len(chunks) - 1:
                    time.sleep(2)
                    
            print(f"\n=== Broadcast Execution Completed ===")
            print(f"Successfully Sent: {successful_sent}")
            print(f"Failed: {failed_sent}")
            
            # Save report
            report_dir = r"c:\Users\Rush\Documents\antigravity\gallant-volta\exports"
            os.makedirs(report_dir, exist_ok=True)
            ts_str = datetime.now().strftime('%Y%m%d_%H%M%S')
            report_file = os.path.join(report_dir, f"watan96_sms_report_{ts_str}.json")
            with open(report_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "timestamp": datetime.now().isoformat(),
                    "sender_id": SENDER_ID,
                    "total_valid": total,
                    "successful": successful_sent,
                    "failed": failed_sent,
                    "batches": batch_results,
                    "row_map": row_map,
                    "already_sent_excluded": already_sent,
                    "invalid_excluded": invalid_targets
                }, f, indent=2, ensure_ascii=False)
            print(f"[*] Audit report written to: {report_file}")
            
            # Update excel
            update_excel_sent_and_dlr(EXCEL_PATH, row_map)
            
            # Pause 15 seconds to let initial operator DLR callbacks settle, then query DLR
            print("\n[*] Waiting 15 seconds for initial operator DLR processing...")
            time.sleep(15)
            
            print("[*] Querying Unifonic DLR & DND status for all dispatched messages...")
            msg_ids_to_query = [v['message_id'] for v in row_map.values() if v.get('message_id')]
            dlr_results = {}
            
            # Query in chunks of 50
            dlr_chunk_size = 50
            for c_idx in range(0, len(msg_ids_to_query), dlr_chunk_size):
                sub_ids = msg_ids_to_query[c_idx:c_idx + dlr_chunk_size]
                sub_res = query_remote_dlr_batch(ssh, sub_ids)
                dlr_results.update(sub_res)
                
            dlr_summary = {'DELIVERED': 0, 'DND_UNDELIVERED': 0, 'ENROUTE_PENDING': 0, 'OTHER': 0}
            for r_idx, info in row_map.items():
                m_id = info.get('message_id')
                dlr_data = (dlr_results.get(m_id) or {}).get('data', {})
                status = dlr_data.get('Status')
                dlr = dlr_data.get('DLR')
                
                if dlr == 'DELIVERED':
                    cat = 'Delivered'
                    dlr_summary['DELIVERED'] += 1
                elif status == 'Rejected' or dlr == 'UNDELIVERED':
                    cat = 'DND / Undelivered'
                    dlr_summary['DND_UNDELIVERED'] += 1
                elif dlr == 'ENROUTE' or status == 'Sent':
                    cat = 'Enroute'
                    dlr_summary['ENROUTE_PENDING'] += 1
                else:
                    cat = dlr or status or 'Sent'
                    dlr_summary['OTHER'] += 1
                info['dlr_status'] = cat
                info['raw_dlr'] = dlr_data
                
            print(f"\n=== SMS Delivery & DND Summary ===")
            print(f"Delivered to Handset: {dlr_summary['DELIVERED']}")
            print(f"DND / Undelivered (CITC Opt-out / Rejected): {dlr_summary['DND_UNDELIVERED']}")
            print(f"Enroute / Pending: {dlr_summary['ENROUTE_PENDING']}")
            
            # Re-update Excel with final DLR
            update_excel_sent_and_dlr(EXCEL_PATH, row_map)
            
            # Save final DLR audit JSON
            dlr_report_file = os.path.join(report_dir, f"watan96_sms_dlr_summary_{ts_str}.json")
            with open(dlr_report_file, 'w', encoding='utf-8') as f:
                json.dump({
                    "timestamp": datetime.now().isoformat(),
                    "sender_id": SENDER_ID,
                    "total_messages": len(row_map),
                    "summary": dlr_summary,
                    "details": row_map
                }, f, indent=2, ensure_ascii=False)
            print(f"[*] Complete DLR/DND audit saved to: {dlr_report_file}")
            
    finally:
        ssh.close()
        print("[*] SSH closed.")

if __name__ == '__main__':
    main()
