import io
import csv
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Optional, List, Set
from pydantic import BaseModel

from fastapi import FastAPI, Request, Response, status, Query
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
import hashlib
import hmac

from unifonic_app.config import (
    APP_DIR,
    LOCAL_PORT,
    VPS_HOST,
    VPS_PORT,
    PUBLIC_HTTPS_URL,
    PUBLIC_HTTPS_ALT_URL,
    PUBLIC_DIRECT_IP_URL,
    DB_NAME,
    UNIFONIC_APP_ID,
    UNIFONIC_CHANNEL_ID,
    AUTH_USERNAME,
    AUTH_PASSWORD,
    SESSION_SECRET
)
from unifonic_app.models import parse_unifonic_event, extract_phone_number
from unifonic_app.storage import storage
from unifonic_app.engagement import log_engagement
from unifonic_app.unifonic_client import (
    send_whatsapp_message,
    get_messages_status,
    fetch_missed_inbound_messages,
    UNIFONIC_PUBLIC_ID,
    UNIFONIC_SECRET_KEY,
    UNIFONIC_CHANNEL_ID
)
from unifonic_app.ui_templates import login_html as render_login_html, full_solution_ui as render_full_solution_ui

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("unifonic_app")

app = FastAPI(
    title="RushWash &bull; WhatsApp Hub & Delivery Reports",
    description="Enterprise WhatsApp Live Chat, DLR Reports, and Webhook Hub.",
    version="2.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Realtime Event Broadcaster (SSE)
class EventBroadcaster:
    def __init__(self):
        self.listeners: List[asyncio.Queue] = []

    async def subscribe(self) -> asyncio.Queue:
        q = asyncio.Queue()
        self.listeners.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue):
        if q in self.listeners:
            self.listeners.remove(q)

    async def broadcast(self, data: dict):
        dead_queues = []
        for q in list(self.listeners):
            try:
                q.put_nowait(data)
            except Exception:
                dead_queues.append(q)
        for dq in dead_queues:
            self.unsubscribe(dq)

broadcaster = EventBroadcaster()

# Authentication Utilities
EXPECTED_AUTH_TOKEN = hashlib.sha256(f"{AUTH_USERNAME}:{AUTH_PASSWORD}:{SESSION_SECRET}".encode()).hexdigest()

def is_authenticated(request: Request) -> bool:
    token = request.cookies.get("rush_session")
    if token and hmac.compare_digest(token, EXPECTED_AUTH_TOKEN):
        return True
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        bearer = auth_header.split(" ", 1)[1].strip()
        if hmac.compare_digest(bearer, EXPECTED_AUTH_TOKEN):
            return True
    return False

@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    # Public endpoints: webhooks, health, login, logout, static/favicons, SSE stream
    if (
        path.startswith("/webhook")
        or path == "/health"
        or path == "/login"
        or path == "/logout"
        or path.startswith("/static")
        or path == "/favicon.ico"
        or path == "/api/events/stream"
    ):
        return await call_next(request)

    if not is_authenticated(request):
        if path.startswith("/api/"):
            return JSONResponse(status_code=401, content={"error": "Unauthorized. Please sign in at /login."})
        return RedirectResponse(url="/login", status_code=302)

    return await call_next(request)

class LoginRequest(BaseModel):
    username: str
    password: str

class ReplyRequest(BaseModel):
    text: str
    # Optional engagement tagging: "usage_nudge" | "renewal_reminder" (anything else = normal chat, not logged)
    purpose: Optional[str] = None
    customer_code: Optional[str] = None
    subscription_code: Optional[str] = None

class StartChatRequest(BaseModel):
    phone: str
    initial_message: Optional[str] = None
    purpose: Optional[str] = None
    customer_code: Optional[str] = None
    subscription_code: Optional[str] = None

class SettingsRequest(BaseModel):
    public_id: Optional[str] = None
    secret_key: Optional[str] = None
    channel_id: Optional[str] = None

current_settings = {
    "public_id": UNIFONIC_PUBLIC_ID,
    "secret_key": UNIFONIC_SECRET_KEY,
    "channel_id": UNIFONIC_CHANNEL_ID
}

def login_html() -> str:
    return render_login_html()

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    if is_authenticated(request):
        return RedirectResponse(url="/", status_code=302)
    return HTMLResponse(content=login_html())

@app.post("/login")
async def login_submit(req: LoginRequest):
    if req.username.strip() == AUTH_USERNAME and req.password.strip() == AUTH_PASSWORD:
        resp = JSONResponse(content={"success": True, "redirect": "/"})
        resp.set_cookie(
            key="rush_session",
            value=EXPECTED_AUTH_TOKEN,
            max_age=30 * 24 * 3600,
            httponly=True,
            samesite="lax",
            path="/"
        )
        return resp
    return JSONResponse(status_code=401, content={"success": False, "error": "Invalid username or password."})

@app.get("/logout")
async def logout():
    resp = RedirectResponse(url="/login", status_code=302)
    resp.delete_cookie(key="rush_session", path="/")
    return resp

# --- Webhook Ingestion Endpoints ---

@app.get("/health")
async def health_check():
    mongo_ok = storage.is_mongo_connected()
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mongo_connected": mongo_ok,
        "database": DB_NAME if mongo_ok else "fallback_jsonl",
        "primary_webhook_url": PUBLIC_HTTPS_URL,
        "backup_webhook_url": PUBLIC_HTTPS_ALT_URL,
        "direct_ip_url": PUBLIC_DIRECT_IP_URL
    }

@app.get("/webhook/whatsapp")
async def verify_webhook(request: Request):
    params = dict(request.query_params)
    logger.info(f"[Webhook GET Ping] Query params: {params}")
    challenge = params.get("hub.challenge") or params.get("challenge") or params.get("hub_challenge")
    if challenge:
        return Response(content=str(challenge), media_type="text/plain")
    return {
        "status": "active",
        "message": "Unifonic WhatsApp Webhook endpoint is online and ready.",
        "primary_url": PUBLIC_HTTPS_URL
    }

@app.post("/webhook/whatsapp")
async def receive_webhook(request: Request):
    content_type = request.headers.get("content-type", "").lower()
    raw_payload: Dict[str, Any] = {}

    try:
        if "application/json" in content_type:
            raw_payload = await request.json()
        elif "form" in content_type:
            form_data = await request.form()
            raw_payload = dict(form_data)
        else:
            body_bytes = await request.body()
            if body_bytes:
                try:
                    raw_payload = json.loads(body_bytes.decode("utf-8"))
                except Exception:
                    raw_payload = {"raw_text": body_bytes.decode("utf-8", errors="ignore")}
    except Exception as e:
        logger.error(f"Error parsing request payload: {e}")
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"status": "error", "message": f"Invalid payload: {str(e)}"}
        )

    event = parse_unifonic_event(raw_payload)

    divider = "=" * 60
    logger.info(f"\n{divider}\n[UNIFONIC WHATSAPP EVENT RECEIVED]\n"
                f"  Type:        {event.event_type.upper()}\n"
                f"  From:        {event.sender or 'N/A'}\n"
                f"  To:          {event.recipient or 'N/A'}\n"
                f"  Message ID:  {event.message_id or 'N/A'}\n"
                f"  Status:      {event.status or 'N/A'}\n"
                f"  Error:       {event.error or 'None'}\n"
                f"{divider}")

    save_result = storage.save_event(event)

    # Realtime notification to all connected browser tabs
    try:
        asyncio.create_task(broadcaster.broadcast({
            "type": "webhook_event",
            "event_type": event.event_type,
            "phone": event.customer_phone or event.sender or event.recipient,
            "content": event.content,
            "status": event.status,
            "timestamp": event.received_at
        }))
    except Exception as be:
        logger.debug(f"Broadcast error: {be}")

    return {
        "status": "received",
        "event_type": event.event_type,
        "message_id": event.message_id,
        "saved_to_mongo": bool(save_result.get("mongo_id")),
        "timestamp": event.received_at
    }

# --- Realtime Server-Sent Events (SSE) Endpoint ---

@app.get("/api/events/stream")
async def events_stream(request: Request):
    async def event_generator():
        q = await broadcaster.subscribe()
        try:
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            broadcaster.unsubscribe(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# --- Conversations & Chat API Endpoints ---

@app.get("/api/conversations")
async def list_conversations():
    convs = storage.get_conversations()
    return JSONResponse(
        content={"conversations": convs, "count": len(convs)},
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@app.get("/api/conversations/{phone}/messages")
async def get_messages(phone: str):
    clean = extract_phone_number(phone)
    messages = storage.get_conversation_messages(clean)
    return JSONResponse(
        content={"phone": clean, "messages": messages, "count": len(messages)},
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )

@app.post("/api/conversations/{phone}/reply")
async def send_reply(phone: str, req: ReplyRequest):
    clean_phone = extract_phone_number(phone)
    if not req.text.strip():
        return JSONResponse(status_code=400, content={"error": "Message text cannot be empty."})

    result = send_whatsapp_message(
        to_phone=clean_phone,
        text=req.text.strip(),
        public_id=current_settings.get("public_id"),
        secret_key=current_settings.get("secret_key"),
        channel_id=current_settings.get("channel_id")
    )

    status_str = result.get("status", "SENT")
    msg_id = result.get("message_id")
    error_str = result.get("error")

    engagement = None
    if req.purpose and result.get("success"):
        engagement = await asyncio.to_thread(
            log_engagement, clean_phone, req.purpose, msg_id, status_str, req.customer_code, req.subscription_code
        )

    saved_doc = storage.save_outbound_message(
        phone=clean_phone,
        text=req.text.strip(),
        message_id=msg_id,
        status=status_str,
        error=error_str
    )

    try:
        asyncio.create_task(broadcaster.broadcast({
            "type": "outbound_message",
            "phone": clean_phone,
            "content": req.text.strip(),
            "status": status_str
        }))
    except Exception as be:
        logger.debug(f"Broadcast error: {be}")

    return {
        "success": result.get("success", False),
        "status": status_str,
        "message_id": msg_id,
        "error": error_str,
        "saved_message": saved_doc,
        "engagement": engagement
    }

@app.post("/api/conversations/start")
async def start_conversation(req: StartChatRequest):
    clean_phone = extract_phone_number(req.phone)
    if not clean_phone:
        return JSONResponse(status_code=400, content={"error": "Invalid phone number."})

    saved_doc = None
    engagement = None
    if req.initial_message and req.initial_message.strip():
        result = send_whatsapp_message(
            to_phone=clean_phone,
            text=req.initial_message.strip(),
            public_id=current_settings.get("public_id"),
            secret_key=current_settings.get("secret_key"),
            channel_id=current_settings.get("channel_id")
        )
        saved_doc = storage.save_outbound_message(
            phone=clean_phone,
            text=req.initial_message.strip(),
            message_id=result.get("message_id"),
            status=result.get("status", "SENT"),
            error=result.get("error")
        )
        if req.purpose and result.get("success"):
            engagement = await asyncio.to_thread(
                log_engagement, clean_phone, req.purpose, result.get("message_id"), result.get("status", "SENT"),
                req.customer_code, req.subscription_code
            )

    try:
        asyncio.create_task(broadcaster.broadcast({
            "type": "chat_started",
            "phone": clean_phone
        }))
    except Exception as be:
        logger.debug(f"Broadcast error: {be}")

    return {"status": "ok", "phone": clean_phone, "message": saved_doc, "engagement": engagement}

# --- Delivery Reports & Analytics API Endpoints ---

@app.get("/api/reports")
async def get_delivery_reports(
    status: Optional[str] = Query(None, description="Filter by status: ALL, SENT, DELIVERED, READ, FAILED"),
    phone: Optional[str] = Query(None, description="Filter by phone number"),
    limit: int = 200
):
    reports = storage.get_delivery_reports(status_filter=status, phone_filter=phone, limit=limit)
    kpis = storage.get_delivery_kpis()
    return {
        "kpis": kpis,
        "reports": reports,
        "count": len(reports)
    }

@app.get("/api/reports/export")
async def export_reports_csv():
    reports = storage.get_delivery_reports(limit=5000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Message ID", "Recipient", "Status", "Sent At", "Delivered At", "Read At", "Error Reason", "Message Preview"])
    for r in reports:
        writer.writerow([
            r.get("message_id"),
            r.get("recipient"),
            r.get("status"),
            r.get("sent_at", ""),
            r.get("delivered_at", ""),
            r.get("read_at", ""),
            r.get("error", ""),
            r.get("content", "")
        ])
    output.seek(0)
    filename = f"whatsapp_delivery_reports_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/settings")
async def get_settings():
    pid = current_settings.get("public_id") or ""
    sec = current_settings.get("secret_key") or ""
    cid = current_settings.get("channel_id") or ""
    return {
        "public_id": pid,
        "is_secret_set": bool(sec),
        "channel_id": cid,
        "https_webhook_url": PUBLIC_HTTPS_URL,
        "database": DB_NAME if storage.is_mongo_connected() else "JSONL Log",
        "mongo_connected": storage.is_mongo_connected()
    }

@app.post("/api/settings")
async def update_settings(req: SettingsRequest):
    if req.public_id is not None:
        current_settings["public_id"] = req.public_id.strip()
    if req.secret_key is not None:
        current_settings["secret_key"] = req.secret_key.strip()
    if req.channel_id is not None:
        current_settings["channel_id"] = req.channel_id.strip()

    # Also persist to local .env
    try:
        env_file = APP_DIR / ".env"
        lines = []
        if env_file.exists():
            with open(env_file, "r", encoding="utf-8") as f:
                lines = f.readlines()
        
        updated_pub = False
        updated_sec = False
        updated_cid = False
        new_lines = []
        for l in lines:
            if l.startswith("UNIFONIC_PUBLIC_ID="):
                new_lines.append(f"UNIFONIC_PUBLIC_ID={current_settings['public_id']}\n")
                updated_pub = True
            elif l.startswith("UNIFONIC_SECRET_KEY="):
                new_lines.append(f"UNIFONIC_SECRET_KEY={current_settings['secret_key']}\n")
                updated_sec = True
            elif l.startswith("UNIFONIC_CHANNEL_ID="):
                new_lines.append(f"UNIFONIC_CHANNEL_ID={current_settings.get('channel_id', '')}\n")
                updated_cid = True
            else:
                new_lines.append(l)
        
        if not updated_pub and current_settings.get("public_id"):
            new_lines.append(f"UNIFONIC_PUBLIC_ID={current_settings['public_id']}\n")
        if not updated_sec and current_settings.get("secret_key"):
            new_lines.append(f"UNIFONIC_SECRET_KEY={current_settings['secret_key']}\n")
        if not updated_cid and current_settings.get("channel_id"):
            new_lines.append(f"UNIFONIC_CHANNEL_ID={current_settings['channel_id']}\n")

        with open(env_file, "w", encoding="utf-8") as f:
            f.writelines(new_lines)
    except Exception as e:
        logger.warning(f"Could not persist settings to .env: {e}")

    return {"status": "success", "message": "Settings updated and persisted."}

@app.get("/api/events")
async def list_raw_events(limit: int = 50):
    events = storage.get_recent_events(limit=limit)
    return {"count": len(events), "events": events}

# --- Live GET Sync with Unifonic ---

@app.get("/api/unifonic/status/{message_id}")
async def get_single_unifonic_status(message_id: str):
    """Directly queries Unifonic via GET for a specific message status."""
    results = get_messages_status(
        message_ids=[message_id],
        public_id=current_settings.get("public_id"),
        secret_key=current_settings.get("secret_key")
    )
    if results:
        storage.update_unifonic_statuses(results)
        return {"success": True, "message_id": message_id, "data": results[0]}
    return JSONResponse(status_code=404, content={"success": False, "error": "Message ID not found on Unifonic."})

@app.post("/api/unifonic/sync")
async def sync_all_unifonic_statuses():
    """Queries Unifonic via GET for all known message IDs and updates local statuses."""
    mids = storage.get_all_message_ids(limit=500)
    if not mids:
        return {"success": True, "queried_count": 0, "message": "No outbound message IDs to sync."}

    results = get_messages_status(
        message_ids=mids,
        public_id=current_settings.get("public_id"),
        secret_key=current_settings.get("secret_key")
    )

    updated_count = storage.update_unifonic_statuses(results)
    return {
        "success": True,
        "queried_count": len(mids),
        "results_received": len(results),
        "updated_records": updated_count,
        "data": results
    }

@app.post("/api/unifonic/recover-inbound")
async def recover_missed_inbound(
    max_conversations: int = Query(50, description="How many recent conversations to scan (max 100)"),
    messages_per_conversation: int = Query(20, description="How many messages to fetch per conversation")
):
    """
    Recovers inbound WhatsApp messages that were missed while the webhook was offline.

    Polls Unifonic's Conversations API, pulls the most recent inbound messages
    from each conversation thread, deduplicates against already-stored message IDs,
    and saves only the genuinely new ones to local storage.
    """
    max_conversations = min(max_conversations, 100)
    messages_per_conversation = min(messages_per_conversation, 100)

    raw_messages = fetch_missed_inbound_messages(
        public_id=current_settings.get("public_id"),
        secret_key=current_settings.get("secret_key"),
        channel_id=current_settings.get("channel_id"),
        max_conversations=max_conversations,
        messages_per_conversation=messages_per_conversation,
    )

    if not raw_messages:
        return {
            "success": True,
            "fetched": 0,
            "new_saved": 0,
            "skipped_duplicates": 0,
            "message": "No inbound messages returned from Unifonic. "
                       "This may mean no conversations exist yet, or credentials are incorrect."
        }

    # Collect known message IDs so we can skip duplicates
    known_ids: set = set(storage.get_all_message_ids(limit=2000))

    saved = []
    skipped = 0

    for msg in raw_messages:
        # Normalize the raw Unifonic message dict into a NormalizedWhatsAppEvent
        # Field names vary across API versions — try the most common keys.
        msg_id = str(
            msg.get("id") or msg.get("messageId") or msg.get("message_id") or ""
        ).strip()

        # Skip if we already have this message stored
        if msg_id and msg_id in known_ids:
            skipped += 1
            continue

        sender_raw = (
            msg.get("sender")
            or msg.get("from")
            or msg.get("senderId")
            or msg.get("contact")
            or (msg.get("recipient", {}) or {}).get("contact")
        )
        content_raw = None
        body = msg.get("content") or msg.get("message") or msg.get("text")
        if isinstance(body, dict):
            content_raw = body.get("text") or body.get("body")
        elif isinstance(body, str):
            content_raw = body

        # Build a synthetic webhook-style payload and let parse_unifonic_event handle it
        synthetic_payload = {
            "eventType": "message.received",
            "messageId": msg_id or None,
            "from": sender_raw,
            "content": {"text": content_raw} if content_raw else {},
            "createdAt": msg.get("createdAt") or msg.get("created_at") or msg.get("timestamp"),
            "_source": "recover_inbound_api",
            "_raw": msg,
        }

        event = parse_unifonic_event(synthetic_payload)
        # Override received_at if Unifonic gives us the real timestamp
        real_ts = msg.get("createdAt") or msg.get("created_at") or msg.get("timestamp")
        if real_ts:
            event.received_at = str(real_ts)

        save_result = storage.save_event(event)
        saved.append({
            "message_id": msg_id or event.message_id,
            "sender": event.sender,
            "content_preview": (content_raw or "")[:80],
            "saved_to_mongo": bool(save_result.get("mongo_id")),
        })

        # Track so subsequent iterations don't re-add the same ID
        if msg_id:
            known_ids.add(msg_id)

    logger.info(
        f"[RecoverInbound] Done — fetched={len(raw_messages)}, "
        f"new_saved={len(saved)}, skipped_duplicates={skipped}"
    )

    return {
        "success": True,
        "fetched": len(raw_messages),
        "new_saved": len(saved),
        "skipped_duplicates": skipped,
        "saved_messages": saved,
    }


@app.get("/", response_class=HTMLResponse)
async def full_solution_ui():
    """Complete WhatsApp solution: Live Chats, Delivery Reports (DLR), and Raw Webhook Feed."""
    return HTMLResponse(
        content=render_full_solution_ui(
            public_https_url=PUBLIC_HTTPS_URL,
            unifonic_public_id=current_settings.get("public_id") or UNIFONIC_PUBLIC_ID,
            unifonic_channel_id=current_settings.get("channel_id") or UNIFONIC_CHANNEL_ID
        )
    )
