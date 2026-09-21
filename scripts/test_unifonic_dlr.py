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

# Load sample message IDs from yesterday's report
with open(r'c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan96_sms_report_20260918_181250.json', 'r', encoding='utf-8') as f:
    rep = json.load(f)

msg_ids = []
for b in rep['batches']:
    for m in b.get('response', {}).get('response', {}).get('data', {}).get('Messages', []):
        msg_ids.append(str(m.get('MessageID')))
        if len(msg_ids) >= 10:
            break
    if len(msg_ids) >= 10:
        break

print('Sample msg_ids to test:', msg_ids)

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
$msgIds = {json.dumps(msg_ids)};

$res = [];
foreach ($msgIds as $mid) {{
    $r = Http::timeout(10)->withOptions(['force_ip_resolve' => 'v4'])->asForm()->post($baseUrl . '/rest/Messages/GetMessageIDStatus', [
        'AppSid' => $appId,
        'MessageID' => $mid,
        'responseType' => 'json'
    ]);
    $res[$mid] = $r->json();
}}
echo json_encode($res);
"""

with sftp.file('/home/ubuntu/rush-laravel-prod/temp_test_dlr.php', 'w') as f:
    f.write(php_code)

stdin, stdout, stderr = ssh.exec_command('cd /home/ubuntu/rush-laravel-prod && php temp_test_dlr.php')
out = stdout.read().decode('utf-8').strip()
sftp.remove('/home/ubuntu/rush-laravel-prod/temp_test_dlr.php')
sftp.close()
ssh.close()

data = json.loads(out)
for mid, info in data.items():
    d = info.get('data', {})
    print(f"MessageID: {mid} -> Status: {d.get('Status')} | DLR: {d.get('DLR')} | Full: {d}")
