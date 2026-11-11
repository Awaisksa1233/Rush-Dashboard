import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory for the project and the unifonic_app
APP_DIR = Path(__file__).resolve().parent
PROJECT_DIR = APP_DIR.parent

# Load environment from project root .env
load_dotenv(PROJECT_DIR / ".env")
load_dotenv(APP_DIR / ".env")

# Network & Server Configuration
LOCAL_HOST = os.getenv("LOCAL_HOST", "127.0.0.1")
LOCAL_PORT = int(os.getenv("LOCAL_PORT", "8000"))

# VPS Proxy Configuration
VPS_HOST = os.getenv("VPS_HOST", "72.60.185.87")
VPS_PORT = int(os.getenv("VPS_PORT", "8090"))
SSH_PORT = int(os.getenv("SSH_PORT", "22"))
SSH_USER = os.getenv("SSH_USER", "root")
SSH_PASS = os.getenv("SSH_PASS", "+A')4bEMQn?ZwOO6eQ6s")

# Public Webhook URLs (HTTPS via VPS Apache reverse proxy)
PUBLIC_HTTPS_URL = "https://test.rush.com.sa/webhook/whatsapp"
PUBLIC_HTTPS_ALT_URL = "https://rush.com.sa/webhook/whatsapp"
PUBLIC_DIRECT_IP_URL = f"http://{VPS_HOST}:{VPS_PORT}/webhook/whatsapp"
PUBLIC_WEBHOOK_URL = PUBLIC_HTTPS_URL

# Unifonic Credentials
UNIFONIC_PUBLIC_ID = os.getenv("UNIFONIC_PUBLIC_ID", "92d3a815-4224-4f47-bf10-8eb91256230c")
UNIFONIC_SECRET_KEY = os.getenv("UNIFONIC_SECRET_KEY", "xb7xDyeMHp1KmSidpV5ZG5p0fGutMakOFQ8HkldmI0KqRs687T3CeXS0qh0hhZYCXB7XxfHl5rs")
UNIFONIC_CHANNEL_ID = os.getenv("UNIFONIC_CHANNEL_ID", "d6bb3874-a6f2-485f-bf43-7c6df97c2109")
UNIFONIC_APP_ID = os.getenv("UNIFONIC_APP_ID", "80bee0d0-9f5f-42eb-8225-5b80d6f5c0d7")
UNIFONIC_SENDER_ID = os.getenv("UNIFONIC_SENDER_ID", "RushWash")
UNIFONIC_BASE_URL = os.getenv("UNIFONIC_BASE_URL", "https://el.cloud.unifonic.com")
UNIFONIC_CONVERSATIONS_URL = os.getenv("UNIFONIC_CONVERSATIONS_URL", "https://apis.unifonic.com/v1/messages")

# MongoDB Persistence
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb+srv://Awais:Awais%40123@prod-cluster000.djidvip.mongodb.net/rushwash")
DB_NAME = os.getenv("DB_NAME", "rushwash")
COLLECTION_NAME = "unifonic_whatsapp_events"

# Authentication Credentials
AUTH_USERNAME = os.getenv("AUTH_USERNAME", "admin")
AUTH_PASSWORD = os.getenv("AUTH_PASSWORD", "RushWash@2026")
SESSION_SECRET = os.getenv("SESSION_SECRET", "rushwash-whatsapp-auth-secret-key-2026")

# Logs directory
LOGS_DIR = APP_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
JSONL_LOG_PATH = LOGS_DIR / "whatsapp_events.jsonl"

# CRM engagement logging (usage nudges & renewal reminders)
# Base URL of the Rush CRM API, e.g. http://localhost:3001. Empty = logging disabled.
# Messages tagged with a purpose are POSTed to {CRM_API_URL}/api/engagement/log.
CRM_API_URL = os.getenv("CRM_API_URL", "").rstrip("/")
# Optional shared secret; must match ENGAGEMENT_LOG_TOKEN on the CRM API if set there.
ENGAGEMENT_LOG_TOKEN = os.getenv("ENGAGEMENT_LOG_TOKEN", "")
