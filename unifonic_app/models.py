import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Union
from pydantic import BaseModel, Field

class NormalizedWhatsAppEvent(BaseModel):
    id: Optional[str] = None
    event_type: str = "unknown"  # "inbound_message" | "outbound_message" | "delivery_status" | "unknown"
    sender: Optional[str] = None
    recipient: Optional[str] = None
    customer_phone: Optional[str] = None
    message_id: Optional[str] = None
    status: Optional[str] = None
    content: Optional[str] = None
    error: Optional[str] = None
    channel: str = "whatsapp"
    raw_payload: Dict[str, Any] = Field(default_factory=dict)
    received_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

def extract_phone_number(val: Any) -> Optional[str]:
    """
    Extracts and normalizes a clean phone number from various formats:
    - String: "+966559421442", "0559421442", "966559421442"
    - Dict: {"contact": "+966...", "channel": "whatsapp", "userId": "..."}
    - Dict: {"recipientId": "966..."}
    """
    if not val:
        return None

    # If it's a dict, inspect common keys
    if isinstance(val, dict):
        raw = val.get("contact") or val.get("recipientId") or val.get("phone") or val.get("number") or val.get("id") or ""
        return extract_phone_number(raw)

    # Convert to string and handle stringified dicts (e.g. "{'contact': '...'}")
    s = str(val).strip()
    if s.startswith("{") and "contact" in s:
        m = re.search(r"['\"]contact['\"]\s*:\s*['\"]([^'\"]+)['\"]", s)
        if m:
            s = m.group(1)
        else:
            m2 = re.search(r"['\"]recipientId['\"]\s*:\s*['\"]([^'\"]+)['\"]", s)
            if m2:
                s = m2.group(1)

    # Remove all non-digits
    digits = re.sub(r"\D", "", s)
    if not digits:
        return None

    # Handle local Saudi numbers (05xxxxxxxx -> 9665xxxxxxxx)
    if digits.startswith("05") and len(digits) == 10:
        digits = "966" + digits[1:]
    elif digits.startswith("5") and len(digits) == 9:
        digits = "966" + digits

    return digits

def extract_event_timestamp(payload: Dict[str, Any]) -> str:
    """
    Extracts the true customer message timestamp (when customer sent / Unifonic gateway received),
    prioritizing customer send time over server/webhook reception time.
    """
    if not isinstance(payload, dict):
        return datetime.now(timezone.utc).isoformat()

    candidates = [
        payload.get("timestamp"),
        payload.get("receivedAt"),
        payload.get("sentAt"),
        payload.get("sent_at"),
        payload.get("createdAt"),
        payload.get("created_at"),
        payload.get("time"),
        payload.get("Date"),
        (payload.get("message") or {}).get("timestamp") if isinstance(payload.get("message"), dict) else None,
        (payload.get("content") or {}).get("timestamp") if isinstance(payload.get("content"), dict) else None,
    ]
    for c in candidates:
        if c and str(c).strip():
            ts_str = str(c).strip()
            if ts_str.isdigit():
                try:
                    val = int(ts_str)
                    if val > 1e11:
                        return datetime.fromtimestamp(val / 1000, tz=timezone.utc).isoformat()
                    else:
                        return datetime.fromtimestamp(val, tz=timezone.utc).isoformat()
                except Exception:
                    pass
            if " " in ts_str and "T" not in ts_str:
                ts_str = ts_str.replace(" ", "T")
                if not ts_str.endswith("Z") and "+" not in ts_str:
                    ts_str += "Z"
            return ts_str
    return datetime.now(timezone.utc).isoformat()

def parse_unifonic_event(payload: Dict[str, Any]) -> NormalizedWhatsAppEvent:
    """
    Parses live Unifonic WhatsApp webhook payloads into a uniform structure.
    Handles:
      - Unifonic Conversations API event types:
        - "message.sent"
        - "message.delivered"
        - "message.read"
        - "message.rejected" / "message.failed"
        - "message.received" / "message.incoming"
      - Legacy and form-encoded formats
    """
    ev_type = str(payload.get("eventType") or payload.get("event") or payload.get("type") or "").lower()
    
    # Extract message ID
    message_id = (
        payload.get("messageId")
        or payload.get("message_id")
        or payload.get("MessageID")
        or payload.get("id")
        or (payload.get("data", {}).get("messageId") if isinstance(payload.get("data"), dict) else None)
    )

    event_time = extract_event_timestamp(payload)

    # 1. Check for Unifonic Conversations API Delivery Status Callbacks
    # e.g. "message.sent", "message.delivered", "message.read", "message.rejected"
    if any(k in ev_type for k in ["sent", "deliv", "read", "reject", "fail", "status", "dlr"]):
        status_val = "SENT"
        if "deliv" in ev_type:
            status_val = "DELIVERED"
        elif "read" in ev_type:
            status_val = "READ"
        elif "reject" in ev_type or "fail" in ev_type:
            status_val = "FAILED"
        elif payload.get("status"):
            st_raw = str(payload.get("status")).upper()
            if "DELIV" in st_raw: status_val = "DELIVERED"
            elif "READ" in st_raw: status_val = "READ"
            elif "FAIL" in st_raw or "REJECT" in st_raw: status_val = "FAILED"
            else: status_val = "SENT"

        recipient_phone = extract_phone_number(
            payload.get("recipient") or payload.get("recipientId") or payload.get("to") or payload.get("contact")
        )
        sender_phone = extract_phone_number(payload.get("sender") or payload.get("from"))
        fail_reason = payload.get("failReason") or payload.get("error") or payload.get("reason")

        return NormalizedWhatsAppEvent(
            event_type="delivery_status",
            status=status_val,
            recipient=recipient_phone,
            sender=sender_phone,
            customer_phone=recipient_phone,
            message_id=str(message_id) if message_id else None,
            content=None,
            error=str(fail_reason) if fail_reason else None,
            received_at=event_time,
            raw_payload=payload
        )

    # 2. Check for Inbound Customer WhatsApp Message
    # e.g. "message.received", "message.incoming", "incoming_message"
    sender_phone = extract_phone_number(
        payload.get("from") or payload.get("sender") or payload.get("senderId") or payload.get("source")
    )
    recipient_phone = extract_phone_number(
        payload.get("to") or payload.get("recipient") or payload.get("recipientId")
    )

    # Extract text content
    content_text = None
    if isinstance(payload.get("content"), dict):
        content_text = payload.get("content", {}).get("text")
    elif isinstance(payload.get("message"), dict):
        content_text = payload.get("message", {}).get("text") or payload.get("message", {}).get("body")
    else:
        content_text = payload.get("text") or payload.get("body") or payload.get("message")

    return NormalizedWhatsAppEvent(
        event_type="inbound_message",
        sender=sender_phone,
        recipient=recipient_phone,
        customer_phone=sender_phone,
        message_id=str(message_id) if message_id else None,
        content=str(content_text) if content_text else None,
        received_at=event_time,
        raw_payload=payload
    )
