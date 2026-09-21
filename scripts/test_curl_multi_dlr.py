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

# Load today's report
today_rep_path = r"c:\Users\Rush\Documents\antigravity\gallant-volta\exports\watan96_sms_report_20260919_141152.json"
with open(today_rep_path, 'r', encoding='utf-8') as f:
    rep = json.load(f)

all_mids = [info['message_id'] for info in rep['row_map'].values() if info.get('message_id')]
print(f"Total message IDs: {len(all_mids)}")

# Let's test 100 of them using curl_multi in PHP (which is rock solid and standard)
sample_100 = all_mids[:100]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SSH_HOST, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)
sftp = ssh.open_sftp()

php_code = f"""<?php
require '/home/ubuntu/rush-laravel-prod/vendor/autoload.php';
$app = require_once '/home/ubuntu/rush-laravel-prod/bootstrap/app.php';
$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
$kernel->bootstrap();

$baseUrl = config('services.unifonic.base_url', 'https://el.cloud.unifonic.com');
$appId = config('services.unifonic.app_id');
$mids = {json.dumps(sample_100)};

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

remote_script = "/home/ubuntu/rush-laravel-prod/temp_curl_multi_dlr.php"
with sftp.file(remote_script, 'w') as f:
    f.write(php_code)

stdin, stdout, stderr = ssh.exec_command(f"cd /home/ubuntu/rush-laravel-prod && php {os.path.basename(remote_script)}")
out = stdout.read().decode('utf-8').strip()
sftp.remove(remote_script)
sftp.close()
ssh.close()

data = json.loads(out)
statuses = {}
dlrs = {}
for mid, res in data.items():
    d = (res or {}).get('data', {})
    st = d.get('Status', 'Unknown')
    dlr = d.get('DLR', 'Unknown')
    statuses[st] = statuses.get(st, 0) + 1
    dlrs[dlr] = dlrs.get(dlr, 0) + 1

print("100 Sample Status Breakdown:", statuses)
print("100 Sample DLR Breakdown:", dlrs)
