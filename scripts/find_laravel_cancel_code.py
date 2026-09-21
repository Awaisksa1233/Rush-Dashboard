import sys
import paramiko

SSH_HOST = '72.60.185.87'
SSH_USER = 'root'
SSH_PASS = "+A')4bEMQn?ZwOO6eQ6s"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SSH_HOST, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)

# Search for where cancelled_voluntary and cancelEffective are set
cmds = [
    'grep -rn "cancelled_voluntary" /home/ubuntu/rush-laravel-prod/app/ 2>/dev/null',
    'grep -rn "cancelEffective" /home/ubuntu/rush-laravel-prod/app/ 2>/dev/null',
    'grep -i "SUB-34224" /home/ubuntu/rush-laravel-prod/storage/logs/laravel*.log 2>/dev/null | tail -n 20',
    'grep -i "CUS-12957" /home/ubuntu/rush-laravel-prod/storage/logs/laravel*.log 2>/dev/null | tail -n 20'
]

for cmd in cmds:
    print(f"=== CMD: {cmd} ===")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8').strip()
    print(out if out else "[No output]")
    print("")

ssh.close()
