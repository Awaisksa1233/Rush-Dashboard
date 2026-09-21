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

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SSH_HOST, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)
sftp = ssh.open_sftp()

php_code = """<?php
require '/home/ubuntu/rush-laravel-prod/vendor/autoload.php';
$app = require_once '/home/ubuntu/rush-laravel-prod/bootstrap/app.php';
$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);
$kernel->bootstrap();

use Illuminate\\Support\\Facades\\Http;

$baseUrl = config('services.unifonic.base_url', 'https://el.cloud.unifonic.com');
$appId = config('services.unifonic.app_id');

$r1 = Http::timeout(10)->withOptions(['force_ip_resolve' => 'v4'])->asForm()->post($baseUrl . '/rest/Messages/GetMessageIDStatus', [
    'AppSid' => $appId,
    'MessageID' => '220000022651382',
    'responseType' => 'json'
]);

echo json_encode([
    'single' => $r1->json()
]);
"""

with sftp.file('/home/ubuntu/rush-laravel-prod/temp_test_unifonic_rep.php', 'w') as f:
    f.write(php_code)

stdin, stdout, stderr = ssh.exec_command('cd /home/ubuntu/rush-laravel-prod && php temp_test_unifonic_rep.php')
out = stdout.read().decode('utf-8').strip()
sftp.remove('/home/ubuntu/rush-laravel-prod/temp_test_unifonic_rep.php')
sftp.close()
ssh.close()

print('RESPONSE:', out)
