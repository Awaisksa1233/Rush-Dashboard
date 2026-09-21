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

# Let's inspect a few message IDs from today's report
today_rep_path = r"c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan96_sms_report_20260919_141152.json"
with open(today_rep_path, 'r', encoding='utf-8') as f:
    rep = json.load(f)

sample_mids = []
for r, info in rep['row_map'].items():
    sample_mids.append(info['message_id'])
    if len(sample_mids) >= 5:
        break

print("Sample MIDs:", sample_mids)

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SSH_HOST, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)
sftp = ssh.open_sftp()

php_code = f"""<?php
require '/home/ubuntu/rush-laravel-prod/vendor/autoload.php';
$app = require_once '/home/ubuntu/rush-laravel-prod/bootstrap/app.php';
$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
$kernel->bootstrap();

use Illuminate\\Support\\Facades\\Http;

$baseUrl = config('services.unifonic.base_url', 'https://el.cloud.unifonic.com');
$appId = config('services.unifonic.app_id');

$results = [];
foreach ({json.dumps(sample_mids)} as $mid) {{
    $r = Http::timeout(10)->withOptions(['force_ip_resolve' => 'v4'])->asForm()->post($baseUrl . '/rest/Messages/GetMessageIDStatus', [
        'AppSid' => $appId,
        'MessageID' => $mid,
        'responseType' => 'json'
    ]);
    $results[$mid] = $r->json();
}}
echo json_encode($results, JSON_PRETTY_PRINT);
"""

remote_script = "/home/ubuntu/rush-laravel-prod/temp_inspect_dlr_sample.php"
with sftp.file(remote_script, 'w') as f:
    f.write(php_code)

stdin, stdout, stderr = ssh.exec_command(f"cd /home/ubuntu/rush-laravel-prod && php {os.path.basename(remote_script)}")
out = stdout.read().decode('utf-8').strip()
sftp.remove(remote_script)
sftp.close()
ssh.close()

print("RAW UNIFONIC DLR RESPONSE:")
print(out)
