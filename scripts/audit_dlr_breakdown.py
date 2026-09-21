import os
import sys
import json
import paramiko

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

SSH_HOST = '72.60.185.87'
SSH_USER = 'root'
SSH_PASS = "+A')4bEMQn?ZwOO6eQ6s"

def audit_file(json_file_path, label):
    print(f"\n==========================================")
    print(f"=== Auditing {label} ===")
    print(f"File: {json_file_path}")
    
    with open(json_file_path, 'r', encoding='utf-8') as f:
        rep = json.load(f)

    msg_ids = []
    if 'row_map' in rep:
        for r_idx, info in rep['row_map'].items():
            if info.get('message_id'):
                msg_ids.append(info['message_id'])
    elif 'batches' in rep:
        for b in rep['batches']:
            for m in b.get('response', {}).get('response', {}).get('data', {}).get('Messages', []):
                msg_ids.append(str(m.get('MessageID')))

    print(f"Total message IDs to check: {len(msg_ids)}")
    if not msg_ids:
        return

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(SSH_HOST, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)
    sftp = ssh.open_sftp()

    # Use Laravel Http::pool in chunks of 50 concurrent requests
    php_code = f"""<?php
require '/home/ubuntu/rush-laravel-prod/vendor/autoload.php';
$app = require_once '/home/ubuntu/rush-laravel-prod/bootstrap/app.php';
$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
$kernel->bootstrap();

use Illuminate\\Support\\Facades\\Http;
use Illuminate\\Http\\Client\\Pool;

$baseUrl = config('services.unifonic.base_url', 'https://el.cloud.unifonic.com');
$appId = config('services.unifonic.app_id');
$msgIds = {json.dumps(msg_ids)};

$allResults = [];
$chunks = array_chunk($msgIds, 50);

foreach ($chunks as $chunk) {{
    $responses = Http::pool(function (Pool $pool) use ($chunk, $baseUrl, $appId) {{
        $reqs = [];
        foreach ($chunk as $mid) {{
            $reqs[$mid] = $pool->asForm()->timeout(10)->withOptions(['force_ip_resolve' => 'v4'])->post($baseUrl . '/rest/Messages/GetMessageIDStatus', [
                'AppSid' => $appId,
                'MessageID' => $mid,
                'responseType' => 'json'
            ]);
        }}
        return $reqs;
    }});

    foreach ($responses as $mid => $resp) {{
        if ($resp instanceof \\Illuminate\\Http\\Client\\Response && $resp->successful()) {{
            $allResults[$mid] = $resp->json();
        }} else {{
            $allResults[$mid] = ['error' => 'failed'];
        }}
    }}
}}

echo json_encode($allResults);
"""

    remote_file = f"/home/ubuntu/rush-laravel-prod/temp_pool_dlr_{int(os.path.getmtime(json_file_path))}.php"
    with sftp.file(remote_file, 'w') as f:
        f.write(php_code)

    stdin, stdout, stderr = ssh.exec_command(f"cd /home/ubuntu/rush-laravel-prod && php {os.path.basename(remote_file)}")
    out = stdout.read().decode('utf-8').strip()
    err = stderr.read().decode('utf-8').strip()
    try:
        sftp.remove(remote_file)
    except Exception:
        pass
    sftp.close()
    ssh.close()

    try:
        data = json.loads(out)
    except Exception as e:
        print("Error parsing PHP JSON output:", e, "Raw output was:", out[:200])
        return

    statuses = {}
    dlrs = {}
    total_delivered = 0
    total_dnd_rejected = 0
    total_enroute = 0
    
    if isinstance(data, dict):
        items_to_process = list(data.items())
    elif isinstance(data, list):
        items_to_process = [(msg_ids[i] if i < len(msg_ids) else str(i), item) for i, item in enumerate(data)]
    else:
        items_to_process = []
    
    for mid, info in items_to_process:
        d = (info or {}).get('data', {})
        st = d.get('Status', 'Unknown')
        dlr = d.get('DLR', 'Unknown')
        statuses[st] = statuses.get(st, 0) + 1
        dlrs[dlr] = dlrs.get(dlr, 0) + 1
        if dlr == 'DELIVERED':
            total_delivered += 1
        elif st == 'Rejected' or dlr == 'UNDELIVERED':
            total_dnd_rejected += 1
        elif dlr == 'ENROUTE' or st == 'Sent':
            total_enroute += 1

    print(f"Status Breakdown: {statuses}")
    print(f"DLR Breakdown: {dlrs}")
    print(f"  -> Delivered: {total_delivered} ({(total_delivered/len(msg_ids))*100:.1f}%)")
    print(f"  -> DND / Rejected: {total_dnd_rejected} ({(total_dnd_rejected/len(msg_ids))*100:.1f}%)")
    print(f"  -> Enroute / Pending: {total_enroute} ({(total_enroute/len(msg_ids))*100:.1f}%)")
    
    return data

if __name__ == '__main__':
    audit_file(r'c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan96_sms_report_20260918_181250.json', "Yesterday (Sept 18) Pilot Broadcast (384 SMS)")
    audit_file(r'c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan96_sms_report_20260919_141152.json', "Today (Sept 19) Schedule Broadcast (1,177 SMS)")
