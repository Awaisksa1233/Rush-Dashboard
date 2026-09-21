import paramiko

SSH_HOST = '72.60.185.87'
SSH_USER = 'root'
SSH_PASS = "+A')4bEMQn?ZwOO6eQ6s"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SSH_HOST, port=22, username=SSH_USER, password=SSH_PASS, timeout=15)

stdin, stdout, stderr = ssh.exec_command('grep -rn "server_name" /etc/nginx/sites-enabled/')
print("NGINX VHOSTS:")
print(stdout.read().decode())

stdin, stdout, stderr = ssh.exec_command('ls -la /var/www/ /home/ubuntu/')
print("DIRECTORIES:")
print(stdout.read().decode())

ssh.close()
