import os
import sys
import time
from pathlib import Path

# Ensure root dir in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import paramiko
from unifonic_app.config import (
    VPS_HOST,
    SSH_PORT,
    SSH_USER,
    SSH_PASS,
    UNIFONIC_PUBLIC_ID,
    UNIFONIC_SECRET_KEY,
    UNIFONIC_CHANNEL_ID,
    UNIFONIC_APP_ID,
    UNIFONIC_SENDER_ID,
    UNIFONIC_BASE_URL,
    UNIFONIC_CONVERSATIONS_URL,
    MONGODB_URI,
    DB_NAME,
    AUTH_USERNAME,
    AUTH_PASSWORD,
    SESSION_SECRET
)

REMOTE_DIR = "/opt/unifonic_app"
LOCAL_APP_DIR = Path(__file__).resolve().parent.parent / "unifonic_app"

# Ensure UTF-8 output on Windows console
if sys.platform.startswith('win'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def safe_print(text):
    try:
        print(text)
    except Exception:
        print(str(text).encode('ascii', errors='replace').decode('ascii'))

def run_ssh(client, cmd, ignore_error=False):
    safe_print(f"\n[SSH] Running: {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='ignore').strip()
    err = stderr.read().decode('utf-8', errors='ignore').strip()
    if out:
        safe_print(f"[OUT]\n{out}")
    if err and not ignore_error:
        safe_print(f"[ERR]\n{err}")
    return out, err

def upload_file(sftp, local_path, remote_path):
    print(f"[SFTP] Uploading {local_path} -> {remote_path}")
    sftp.put(str(local_path), str(remote_path))

def main():
    print(f"Connecting to VPS {VPS_HOST}:{SSH_PORT}...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        VPS_HOST,
        port=SSH_PORT,
        username=SSH_USER,
        password=SSH_PASS,
        timeout=30,
        banner_timeout=30,
        auth_timeout=30,
        look_for_keys=False,
        allow_agent=False
    )
    print("SSH connection established.")

    # 1. Prepare remote directories
    run_ssh(client, f"mkdir -p {REMOTE_DIR}/unifonic_app {REMOTE_DIR}/logs")

    # 2. SFTP upload application code
    sftp = client.open_sftp()
    py_files = ["__init__.py", "config.py", "models.py", "storage.py", "unifonic_client.py", "ui_templates.py", "main.py"]
    for f in py_files:
        loc = LOCAL_APP_DIR / f
        if loc.exists():
            upload_file(sftp, loc, f"{REMOTE_DIR}/unifonic_app/{f}")

    # Also upload existing events log if present
    local_log = LOCAL_APP_DIR / "logs" / "whatsapp_events.jsonl"
    if local_log.exists():
        upload_file(sftp, local_log, f"{REMOTE_DIR}/logs/whatsapp_events.jsonl")

    # 3. Create .env on VPS
    env_content = f"""UNIFONIC_PUBLIC_ID={UNIFONIC_PUBLIC_ID}
UNIFONIC_SECRET_KEY={UNIFONIC_SECRET_KEY}
UNIFONIC_CHANNEL_ID={UNIFONIC_CHANNEL_ID}
UNIFONIC_APP_ID={UNIFONIC_APP_ID}
UNIFONIC_SENDER_ID={UNIFONIC_SENDER_ID}
UNIFONIC_BASE_URL={UNIFONIC_BASE_URL}
UNIFONIC_CONVERSATIONS_URL={UNIFONIC_CONVERSATIONS_URL}

AUTH_USERNAME={AUTH_USERNAME}
AUTH_PASSWORD={AUTH_PASSWORD}
SESSION_SECRET={SESSION_SECRET}

LOCAL_HOST=127.0.0.1
LOCAL_PORT=8090
PUBLIC_HTTPS_URL=https://whatsapp.rush.com.sa/webhook/whatsapp
PUBLIC_HTTPS_ALT_URL=https://test.rush.com.sa/webhook/whatsapp

MONGODB_URI={MONGODB_URI}
DB_NAME={DB_NAME}
"""
    with sftp.file(f"{REMOTE_DIR}/.env", "w") as f:
        f.write(env_content)
    with sftp.file(f"{REMOTE_DIR}/unifonic_app/.env", "w") as f:
        f.write(env_content)

    # 4. Create run_server.py entrypoint
    entrypoint_content = """import sys
import os
from pathlib import Path

# Add directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("LOCAL_PORT", "8090"))
    uvicorn.run("unifonic_app.main:app", host="127.0.0.1", port=port, log_level="info")
"""
    with sftp.file(f"{REMOTE_DIR}/run_server.py", "w") as f:
        f.write(entrypoint_content)

    # 5. Create requirements.txt
    reqs_content = """fastapi>=0.100.0
uvicorn[standard]>=0.23.0
requests>=2.28.0
python-dotenv>=1.0.0
pymongo>=4.5.0
pydantic>=2.0.0
dnspython>=2.4.0
"""
    with sftp.file(f"{REMOTE_DIR}/requirements.txt", "w") as f:
        f.write(reqs_content)

    sftp.close()
    print("[+] Application files uploaded successfully.")

    # 6. Setup Virtualenv & install dependencies
    setup_cmds = [
        "export DEBIAN_FRONTEND=noninteractive && apt-get update -y && apt-get install -y python3-pip python3-venv",
        f"python3 -m venv {REMOTE_DIR}/venv",
        f"{REMOTE_DIR}/venv/bin/pip install --upgrade pip",
        f"{REMOTE_DIR}/venv/bin/pip install -r {REMOTE_DIR}/requirements.txt"
    ]
    for c in setup_cmds:
        run_ssh(client, c)

    # 7. Create and install Systemd Service
    systemd_unit = f"""[Unit]
Description=RushWash Unifonic WhatsApp Webhook & Dashboard Hub
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={REMOTE_DIR}
EnvironmentFile={REMOTE_DIR}/.env
ExecStart={REMOTE_DIR}/venv/bin/python {REMOTE_DIR}/run_server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""
    sftp = client.open_sftp()
    with sftp.file("/etc/systemd/system/unifonic-whatsapp.service", "w") as f:
        f.write(systemd_unit)
    sftp.close()

    service_cmds = [
        "systemctl daemon-reload",
        "systemctl enable unifonic-whatsapp.service",
        "systemctl restart unifonic-whatsapp.service",
        "systemctl status unifonic-whatsapp.service --no-pager"
    ]
    for c in service_cmds:
        run_ssh(client, c)

    # 8. Configure Apache VirtualHost for whatsapp.rush.com.sa (HTTP + HTTPS)
    apache_conf = """<VirtualHost *:80>
    ServerName whatsapp.rush.com.sa

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:8090/
    ProxyPassReverse / http://127.0.0.1:8090/

    ErrorLog ${APACHE_LOG_DIR}/whatsapp_error.log
    CustomLog ${APACHE_LOG_DIR}/whatsapp_access.log combined
</VirtualHost>

<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName whatsapp.rush.com.sa

    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:8090/
    ProxyPassReverse / http://127.0.0.1:8090/

    SSLCertificateFile /etc/letsencrypt/live/test.rush.com.sa/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/test.rush.com.sa/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf

    ErrorLog ${APACHE_LOG_DIR}/whatsapp_ssl_error.log
    CustomLog ${APACHE_LOG_DIR}/whatsapp_ssl_access.log combined
</VirtualHost>
</IfModule>
"""
    sftp = client.open_sftp()
    with sftp.file("/etc/apache2/sites-available/5-whatsapp-rush.conf", "w") as f:
        f.write(apache_conf)
    sftp.close()

    apache_cmds = [
        "a2enmod proxy proxy_http rewrite ssl headers",
        "a2ensite 5-whatsapp-rush.conf",
        "apache2ctl configtest",
        "systemctl reload apache2"
    ]
    for c in apache_cmds:
        run_ssh(client, c)

    # 9. Verify local endpoint on VPS
    run_ssh(client, "curl -s http://127.0.0.1:8090/health")

    client.close()
    print("\n[✔] Deployment to VPS completed successfully!")

if __name__ == '__main__':
    main()
