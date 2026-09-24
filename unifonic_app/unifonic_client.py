import os
import re
import requests
import logging
from typing import Dict, Any, Optional
from unifonic_app.config import (
    UNIFONIC_APP_ID,
    UNIFONIC_PUBLIC_ID,
    UNIFONIC_SECRET_KEY,
    UNIFONIC_CHANNEL_ID,
    UNIFONIC_CONVERSATIONS_URL
)

logger = logging.getLogger("unifonic_app.client")

def format_e164_phone(phone: str) -> str:
    """
    Normalizes a phone number to standard E.164 format with a leading '+'
    as strictly required by Unifonic API (regex: ^\\+[1-9]\\d{1,14}$).
    """
    digits = re.sub(r"\D", "", str(phone).strip())
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("05") and len(digits) == 10:
        digits = "966" + digits[1:]
    elif digits.startswith("5") and len(digits) == 9:
        digits = "966" + digits
    elif not digits.startswith("966") and len(digits) == 9:
        digits = "966" + digits

    return f"+{digits}"

def send_whatsapp_message(
    to_phone: str,
    text: str,
    public_id: Optional[str] = None,
    secret_key: Optional[str] = None,
    channel_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Sends an outbound WhatsApp message via Unifonic Conversations API.
    """
    pid = (public_id or UNIFONIC_PUBLIC_ID or "").strip()
    secret = (secret_key or UNIFONIC_SECRET_KEY or "").strip()

    if not secret:
        logger.warning(f"Cannot send WhatsApp message to {to_phone}: UNIFONIC_SECRET_KEY is not configured.")
        return {
            "success": False,
            "message_id": None,
            "status": "FAILED",
            "error": "Unifonic API Secret Key is missing. Please configure it in settings."
        }

    formatted_contact = format_e164_phone(to_phone)

    payload = {
        "recipient": {
            "contact": formatted_contact,
            "channel": "whatsapp"
        },
        "content": {
            "type": "text",
            "text": text
        }
    }

    # Optional channelId if specific channel is targeted
    cid = (channel_id or UNIFONIC_CHANNEL_ID or "").strip()
    if cid:
        payload["recipient"]["channelId"] = cid

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "publicId": pid,
        "secret": secret
    }

    logger.info(f"Dispatching WhatsApp message to {formatted_contact} via {UNIFONIC_CONVERSATIONS_URL}")

    try:
        response = requests.post(UNIFONIC_CONVERSATIONS_URL, json=payload, headers=headers, timeout=15)
        resp_data = {}
        try:
            resp_data = response.json()
        except Exception:
            resp_data = {"raw_response": response.text}

        if response.status_code in [200, 201, 202]:
            msg_id = resp_data.get("messageId") or resp_data.get("id") or resp_data.get("data", {}).get("messageId")
            logger.info(f"WhatsApp message sent successfully: MessageID={msg_id}")
            return {
                "success": True,
                "message_id": str(msg_id) if msg_id else None,
                "status": "SENT",
                "response": resp_data
            }
        else:
            err_msg = resp_data.get("message") or resp_data.get("error") or f"HTTP {response.status_code}"
            logger.warning(f"Unifonic WhatsApp API error ({response.status_code}): {err_msg}")
            return {
                "success": False,
                "message_id": None,
                "status": "FAILED",
                "error": str(err_msg),
                "http_status": response.status_code,
                "response": resp_data
            }
    except Exception as e:
        logger.error(f"Failed to connect to Unifonic WhatsApp API: {e}")
        return {
            "success": False,
            "message_id": None,
            "status": "FAILED",
            "error": str(e)
        }

def get_messages_status(
    message_ids: list,
    public_id: Optional[str] = None,
    secret_key: Optional[str] = None
) -> list:
    """
    Executes GET requests to Unifonic Conversations API to retrieve live delivery status
    and transition history for a list of message IDs.
    Endpoint: GET https://apis.unifonic.com/v1/messages/status?messageIds=...
    """
    pid = (public_id or UNIFONIC_PUBLIC_ID or "").strip()
    secret = (secret_key or UNIFONIC_SECRET_KEY or "").strip()

    if not message_ids or not pid or not secret:
        return []

    headers = {
        "Accept": "application/json",
        "PublicId": pid,
        "Secret": secret,
        "publicId": pid,
        "secret": secret
    }

    results = []
    chunk_size = 50
    clean_ids = [str(m).strip() for m in message_ids if m and str(m).strip()]

    for i in range(0, len(clean_ids), chunk_size):
        batch = clean_ids[i:i + chunk_size]
        url = f"https://apis.unifonic.com/v1/messages/status?messageIds={','.join(batch)}"
        try:
            logger.info(f"GET status from Unifonic: {len(batch)} message IDs")
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code in [200, 201]:
                data = resp.json()
                if isinstance(data, list):
                    results.extend(data)
                elif isinstance(data, dict):
                    results.append(data)
            else:
                logger.warning(f"Unifonic GET status error ({resp.status_code}): {resp.text}")
        except Exception as e:
            logger.error(f"Failed to GET status from Unifonic: {e}")

    return results


def fetch_missed_inbound_messages(
    public_id: Optional[str] = None,
    secret_key: Optional[str] = None,
    channel_id: Optional[str] = None,
    max_conversations: int = 50,
    messages_per_conversation: int = 20,
) -> list:
    """
    Polls Unifonic's Conversations API to recover inbound messages that were
    missed while the webhook was offline.

    Flow:
      1. GET /v1/conversations           → list recent conversation threads
      2. GET /v1/conversations/{id}/messages → fetch messages for each thread
      3. Return only direction=INBOUND messages so callers can save them.

    Returns a list of raw message dicts (each contains at minimum: id, direction,
    content, sender/recipient, createdAt).
    """
    pid = (public_id or UNIFONIC_PUBLIC_ID or "").strip()
    secret = (secret_key or UNIFONIC_SECRET_KEY or "").strip()
    cid = (channel_id or UNIFONIC_CHANNEL_ID or "").strip()

    if not pid or not secret:
        logger.warning("fetch_missed_inbound_messages: missing credentials, aborting.")
        return []

    headers = {
        "Accept": "application/json",
        "publicId": pid,
        "secret": secret,
    }

    # ── Step 1: list conversations ──────────────────────────────────────────
    conv_url = "https://apis.unifonic.com/v1/conversations"
    params: dict = {"limit": max_conversations}
    if cid:
        params["channelId"] = cid

    try:
        resp = requests.get(conv_url, headers=headers, params=params, timeout=15)
        if resp.status_code not in [200, 201]:
            logger.warning(
                f"[RecoverInbound] GET /v1/conversations failed ({resp.status_code}): {resp.text[:300]}"
            )
            return []
        data = resp.json()
    except Exception as e:
        logger.error(f"[RecoverInbound] Request error listing conversations: {e}")
        return []

    # Handle both list and {"data": [...]} shapes
    if isinstance(data, list):
        conversations = data
    elif isinstance(data, dict):
        conversations = data.get("data") or data.get("conversations") or data.get("items") or []
    else:
        conversations = []

    logger.info(f"[RecoverInbound] Found {len(conversations)} conversation(s) to scan.")

    # ── Step 2: fetch messages for each conversation ────────────────────────
    inbound_messages = []

    for conv in conversations:
        conv_id = conv.get("id") or conv.get("conversationId")
        if not conv_id:
            continue

        msg_url = f"https://apis.unifonic.com/v1/conversations/{conv_id}/messages"
        msg_params = {"limit": messages_per_conversation}

        try:
            msg_resp = requests.get(msg_url, headers=headers, params=msg_params, timeout=15)
            if msg_resp.status_code not in [200, 201]:
                logger.warning(
                    f"[RecoverInbound] GET messages for conv {conv_id} failed "
                    f"({msg_resp.status_code}): {msg_resp.text[:200]}"
                )
                continue
            msg_data = msg_resp.json()
        except Exception as e:
            logger.error(f"[RecoverInbound] Error fetching messages for conv {conv_id}: {e}")
            continue

        if isinstance(msg_data, list):
            messages = msg_data
        elif isinstance(msg_data, dict):
            messages = msg_data.get("data") or msg_data.get("messages") or msg_data.get("items") or []
        else:
            messages = []

        for msg in messages:
            direction = str(msg.get("direction") or msg.get("type") or "").upper()
            # Keep only messages sent by the customer (INBOUND / RECEIVED)
            if direction in ("INBOUND", "RECEIVED", "IN") or "INBOUND" in direction:
                msg["_conversation_id"] = conv_id
                inbound_messages.append(msg)

    logger.info(f"[RecoverInbound] Recovered {len(inbound_messages)} inbound message(s).")
    return inbound_messages
