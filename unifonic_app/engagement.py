"""Report usage nudges and renewal reminders sent from this app to the Rush CRM engagement log.

The CRM API resolves the member (by customer code, subscription code or phone) and stores
the event in its own database; message text is never sent. Logging is best-effort: a failure
here never blocks or fails the WhatsApp send.
"""
import logging
from typing import Any, Dict, Optional

import requests

from unifonic_app.config import CRM_API_URL, ENGAGEMENT_LOG_TOKEN

logger = logging.getLogger("unifonic_app.engagement")

ENGAGEMENT_PURPOSES = {"usage_nudge", "renewal_reminder"}


def log_engagement(
    phone: str,
    purpose: Optional[str],
    message_id: Optional[str] = None,
    status: Optional[str] = None,
    customer_code: Optional[str] = None,
    subscription_code: Optional[str] = None,
    channel: str = "whatsapp",
) -> Dict[str, Any]:
    """POST one engagement event to the CRM. Returns {"logged": bool, ...}; never raises."""
    if purpose not in ENGAGEMENT_PURPOSES:
        return {"logged": False, "reason": "no purpose"}
    if not CRM_API_URL:
        logger.warning("CRM_API_URL not set; %s for %s was sent but not logged", purpose, phone)
        return {"logged": False, "reason": "CRM_API_URL not configured"}

    payload = {
        "type": purpose,
        "channel": channel,
        "phone": phone,
        "customerCode": customer_code or None,
        "subscriptionCode": subscription_code or None,
        "messageId": message_id,
        "status": status,
        "source": "unifonic_app",
    }
    headers = {"Content-Type": "application/json"}
    if ENGAGEMENT_LOG_TOKEN:
        headers["x-engagement-token"] = ENGAGEMENT_LOG_TOKEN
    try:
        resp = requests.post(f"{CRM_API_URL}/api/engagement/log", json=payload, headers=headers, timeout=5)
        body = resp.json() if resp.content else {}
        if resp.status_code >= 300:
            logger.warning("Engagement log rejected (%s): %s", resp.status_code, body.get("error"))
            return {"logged": False, "reason": body.get("error") or f"HTTP {resp.status_code}"}
        return {"logged": True, "matched": body.get("matched"), "customer_code": body.get("customerCode")}
    except Exception as exc:  # network errors must not break messaging
        logger.warning("Engagement log failed: %s", exc)
        return {"logged": False, "reason": str(exc)}
