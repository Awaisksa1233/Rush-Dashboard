import select
import socket
import threading
import time
import logging
import paramiko
from unifonic_app.config import (
    VPS_HOST,
    VPS_PORT,
    SSH_PORT,
    SSH_USER,
    SSH_PASS,
    LOCAL_HOST,
    LOCAL_PORT
)

logger = logging.getLogger("unifonic_app.tunnel")

def handler(chan, host, port):
    sock = socket.socket()
    try:
        sock.connect((host, port))
    except Exception as e:
        logger.error(f"Forwarding request to {host}:{port} failed: {e}")
        chan.close()
        return

    while True:
        r, w, x = select.select([sock, chan], [], [])
        if sock in r:
            data = sock.recv(4096)
            if len(data) == 0:
                break
            chan.send(data)
        if chan in r:
            data = chan.recv(4096)
            if len(data) == 0:
                break
            sock.send(data)
    chan.close()
    sock.close()

def reverse_forward_tunnel(server_port, remote_host, remote_port, transport):
    # Bind to 0.0.0.0 so external calls to the VPS public IP are accepted
    transport.request_port_forward("0.0.0.0", server_port)
    logger.info(f"Reverse tunnel listening on VPS {VPS_HOST}:{server_port} -> local {remote_host}:{remote_port}")
    while True:
        chan = transport.accept(1000)
        if chan is None:
            continue
        thr = threading.Thread(
            target=handler, args=(chan, remote_host, remote_port), daemon=True
        )
        thr.start()

class VPSTunnel:
    def __init__(self):
        self.client = None
        self.running = False
        self.thread = None

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def _run(self):
        while self.running:
            try:
                logger.info(f"Connecting SSH tunnel to {VPS_HOST}:{SSH_PORT}...")
                client = paramiko.SSHClient()
                client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                client.connect(
                    VPS_HOST,
                    port=SSH_PORT,
                    username=SSH_USER,
                    password=SSH_PASS,
                    timeout=15,
                    look_for_keys=False
                )
                self.client = client
                transport = client.get_transport()
                logger.info(f"[+] SSH reverse tunnel established! Public port: {VPS_PORT}")
                reverse_forward_tunnel(VPS_PORT, LOCAL_HOST, LOCAL_PORT, transport)
            except Exception as e:
                logger.warning(f"SSH Tunnel dropped: {e}. Retrying in 5 seconds...")
                time.sleep(5)

    def stop(self):
        self.running = False
        if self.client:
            try:
                self.client.close()
            except Exception:
                pass
