import sys
import json
import paramiko

if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

SSH_HOST     = '72.60.185.87'
SSH_PORT     = 22
SSH_USER     = 'root'
SSH_PASSWORD = "+A')4bEMQn?ZwOO6eQ6s"

message_ids = sys.argv[1:] if len(sys.argv) > 1 else ['54000394741247', '55000027172404']

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, password=SSH_PASSWORD, timeout=15)

sftp = ssh.open_sftp()

php_code = f"""<?php
require '/home/ubuntu/rush-laravel-prod/vendor/autoload.php';
$app = require_once '/home/ubuntu/rush-laravel-prod/bootstrap/app.php';
$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
$kernel->bootstrap();

use Illuminate\\Support\\Facades\\Http;

$baseUrl = config('services.unifonic.base_url', 'https://el.cloud.unifonic.com');
$appId = config('services.unifonic.app_id');
$sender = config('services.unifonic.sender_id');

$results = [];
$msgIds = {json.dumps(message_ids)};

foreach ($msgIds as $mId) {{
    $response = Http::timeout(15)
        ->withOptions(['force_ip_resolve' => 'v4'])
        ->asForm()
        ->post($baseUrl . '/rest/Messages/GetMessageIDStatus', [
            'AppSid' => $appId,
            'MessageID' => $mId,
            'responseType' => 'json',
        ]);
    $results[$mId] = $response->json();
}}

echo json_encode([
    'default_config_sender' => $sender,
    'results' => $results
]);
"""

remote_script_path = "/home/ubuntu/rush-laravel-prod/temp_check_status.php"
with sftp.file(remote_script_path, 'w') as f:
    f.write(php_code)

cmd = "cd /home/ubuntu/rush-laravel-prod && php temp_check_status.php"
stdin, stdout, stderr = ssh.exec_command(cmd)
out = stdout.read().decode('utf-8').strip()
err = stderr.read().decode('utf-8').strip()

try:
    sftp.remove(remote_script_path)
except Exception:
    pass
sftp.close()
ssh.close()

if err:
    print("ERR:", err)
print("OUT:", out)
