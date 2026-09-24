import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pymongo import MongoClient, DESCENDING, ASCENDING
from unifonic_app.config import MONGODB_URI, DB_NAME, COLLECTION_NAME, JSONL_LOG_PATH
from unifonic_app.models import NormalizedWhatsAppEvent, extract_phone_number

logger = logging.getLogger("unifonic_app.storage")

def get_event_customer_timestamp(ev: Dict[str, Any]) -> str:
    """
    Extracts the true customer message timestamp, prioritizing customer send / gateway receive time
    over webhook reception / DB insert time.
    """
    if not isinstance(ev, dict):
        return ""
    
    raw = ev.get("raw_payload") if isinstance(ev.get("raw_payload"), dict) else {}
    candidates = [
        raw.get("timestamp"),
        raw.get("receivedAt"),
        raw.get("sentAt"),
        raw.get("sent_at"),
        raw.get("createdAt"),
        raw.get("created_at"),
        raw.get("time"),
        raw.get("Date"),
        (raw.get("message") or {}).get("timestamp") if isinstance(raw.get("message"), dict) else None,
        (raw.get("content") or {}).get("timestamp") if isinstance(raw.get("content"), dict) else None,
        ev.get("sent_at"),
        ev.get("received_at"),
        ev.get("saved_at")
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
    return ""

class StorageManager:
    def __init__(self):
        self.mongo_client: Optional[MongoClient] = None
        self.db = None
        self.collection = None
        self._init_mongo()

    def _init_mongo(self):
        try:
            if MONGODB_URI:
                self.mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
                self.mongo_client.admin.command('ping')
                self.db = self.mongo_client[DB_NAME]
                self.collection = self.db[COLLECTION_NAME]
                try:
                    self.collection.create_index([("message_id", 1)], unique=True)
                    self.collection.create_index([("customer_phone", 1)])
                    self.collection.create_index([("event_type", 1)])
                    self.collection.create_index([("status", 1)])
                    self.collection.create_index([("received_at", DESCENDING)])
                except Exception as ie:
                    logger.info(f"MongoDB index creation skipped/not permitted: {ie}")
                logger.info("MongoDB connected successfully.")
        except Exception as e:
            logger.warning(f"MongoDB connection failed: {e}. Falling back to file-based JSONL storage.")
            self.mongo_client = None
            self.db = None
            self.collection = None

    def _append_jsonl(self, doc: Dict[str, Any]):
        try:
            with open(JSONL_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(doc, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.error(f"Failed to append to JSONL log: {e}")

    def is_mongo_connected(self) -> bool:
        if not self.mongo_client or self.collection is None:
            return False
        try:
            self.mongo_client.admin.command('ping')
            return True
        except Exception:
            return False

    def save_event(self, event: NormalizedWhatsAppEvent) -> Dict[str, Any]:
        doc = event.model_dump()
        doc["saved_at"] = datetime.now(timezone.utc).isoformat()
        
        # Ensure clean customer_phone
        if event.event_type == "inbound_message":
            doc["customer_phone"] = extract_phone_number(event.sender)
            doc["direction"] = "inbound"
        elif event.event_type == "outbound_message":
            doc["customer_phone"] = extract_phone_number(event.recipient)
            doc["direction"] = "outbound"
        elif event.event_type == "delivery_status":
            doc["customer_phone"] = extract_phone_number(event.recipient or event.customer_phone)
            doc["direction"] = "status_update"
            if event.message_id and event.status:
                self.update_message_status(event.message_id, event.status, event.error)
        else:
            doc["customer_phone"] = extract_phone_number(event.sender or event.recipient)
            doc["direction"] = "unknown"

        # 1. Append to local JSONL log file
        try:
            with open(JSONL_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(doc, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.error(f"Failed to append to JSONL log: {e}")

        # 2. Persist to MongoDB if available (upsert by unique message_id)
        mongo_id = None
        if self.collection is not None:
            try:
                if event.message_id:
                    res = self.collection.update_one(
                        {"message_id": event.message_id},
                        {"$set": doc},
                        upsert=True
                    )
                    mongo_id = str(res.upserted_id or event.message_id)
                else:
                    res = self.collection.insert_one(doc)
                    mongo_id = str(res.inserted_id)
            except Exception as e:
                logger.error(f"Failed to insert/upsert into MongoDB: {e}")

        return {
            "saved": True,
            "mongo_id": mongo_id,
            "jsonl": str(JSONL_LOG_PATH),
            "event_type": event.event_type,
            "customer_phone": doc.get("customer_phone")
        }

    def save_outbound_message(self, phone: str, text: str, message_id: Optional[str] = None, status: str = "SENT", error: Optional[str] = None) -> Dict[str, Any]:
        clean_phone = extract_phone_number(phone)
        now_iso = datetime.now(timezone.utc).isoformat()
        mid = message_id or f"msg_out_{int(datetime.now(timezone.utc).timestamp()*1000)}"
        doc = {
            "id": f"out_{int(datetime.now(timezone.utc).timestamp()*1000)}",
            "event_type": "outbound_message",
            "direction": "outbound",
            "sender": "RushWash",
            "recipient": clean_phone,
            "customer_phone": clean_phone,
            "message_id": mid,
            "status": status.upper(),
            "content": text,
            "error": error,
            "channel": "whatsapp",
            "sent_at": now_iso,
            "delivered_at": None,
            "read_at": None,
            "received_at": now_iso,
            "saved_at": now_iso,
            "raw_payload": {
                "text": text,
                "recipient": clean_phone,
                "status": status,
                "error": error
            }
        }

        # 1. Write to JSONL
        try:
            with open(JSONL_LOG_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(doc, ensure_ascii=False) + "\n")
        except Exception as e:
            logger.error(f"Error appending outbound message to JSONL: {e}")

        # 2. Write to MongoDB
        if self.collection is not None:
            try:
                self.collection.insert_one(doc)
            except Exception as e:
                logger.error(f"Error saving outbound message to Mongo: {e}")

        return doc

    def update_message_status(self, message_id: str, new_status: str, error_desc: Optional[str] = None):
        if not message_id:
            return
        st_upper = new_status.upper()
        now_iso = datetime.now(timezone.utc).isoformat()
        update_fields: Dict[str, Any] = {
            "status": st_upper,
            "status_updated_at": now_iso
        }
        if "DELIV" in st_upper:
            update_fields["delivered_at"] = now_iso
        elif "READ" in st_upper:
            update_fields["read_at"] = now_iso
        elif "FAIL" in st_upper or "REJECT" in st_upper or "UNDELIV" in st_upper:
            update_fields["error"] = error_desc or "Delivery failed"

        if self.collection is not None:
            try:
                self.collection.update_many(
                    {"message_id": message_id},
                    {"$set": update_fields}
                )
            except Exception as e:
                logger.warning(f"Failed to update status in Mongo: {e}")

    def _read_all_jsonl(self) -> List[Dict[str, Any]]:
        events = []
        if JSONL_LOG_PATH.exists():
            try:
                with open(JSONL_LOG_PATH, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                events.append(json.loads(line))
                            except Exception:
                                pass
            except Exception as e:
                logger.error(f"Error reading JSONL: {e}")
        return events

    def get_conversations(self) -> List[Dict[str, Any]]:
        """
        Returns active chats. ONLY genuine conversations (inbound or outbound with text content).
        Sorted strictly by customer message timestamp (latest customer/agent message first).
        """
        all_events = self._read_all_jsonl()
        if not all_events and self.collection is not None:
            try:
                cursor = self.collection.find(
                    {
                        "event_type": {"$in": ["inbound_message", "outbound_message"]},
                        "content": {"$nin": [None, ""]}
                    },
                    {"_id": 0}
                )
                all_events = list(cursor)
            except Exception:
                pass

        # Group all genuine messages by clean customer phone
        phone_groups: Dict[str, List[Dict[str, Any]]] = {}
        for ev in all_events:
            content = ev.get("content")
            if not content or not str(content).strip():
                continue

            ev_type = ev.get("event_type")
            if ev_type not in ["inbound_message", "outbound_message"]:
                continue

            raw_phone = ev.get("customer_phone") or ev.get("sender") or ev.get("recipient")
            phone = extract_phone_number(raw_phone)
            if not phone or phone.lower() in ["rushwash", "rush"]:
                continue

            if phone not in phone_groups:
                phone_groups[phone] = []
            phone_groups[phone].append(ev)

        conv_list = []
        for phone, msgs in phone_groups.items():
            # Sort all messages of this contact chronologically by customer timestamp
            msgs.sort(key=lambda m: get_event_customer_timestamp(m) or "")
            if not msgs:
                continue

            latest_msg = msgs[-1]
            last_content = str(latest_msg.get("content") or "").strip()
            latest_type = latest_msg.get("event_type")
            last_direction = latest_msg.get("direction") or ("inbound" if latest_type == "inbound_message" else "outbound")
            last_timestamp = get_event_customer_timestamp(latest_msg)
            last_status = latest_msg.get("status")

            # Calculate unread count: count all inbound messages since the last outbound message
            unread_count = 0
            last_outbound_idx = -1
            for idx, m in enumerate(msgs):
                m_dir = m.get("direction") or ("inbound" if m.get("event_type") == "inbound_message" else "outbound")
                if m_dir == "outbound":
                    last_outbound_idx = idx

            for idx, m in enumerate(msgs):
                m_dir = m.get("direction") or ("inbound" if m.get("event_type") == "inbound_message" else "outbound")
                if m_dir == "inbound" and idx > last_outbound_idx:
                    unread_count += 1

            conv_list.append({
                "phone": phone,
                "last_message": last_content,
                "last_direction": last_direction,
                "last_timestamp": last_timestamp,
                "unread_count": unread_count,
                "message_count": len(msgs),
                "last_status": last_status
            })

        # Sort conversation list strictly by newest customer/message timestamp at the top
        conv_list.sort(key=lambda x: x["last_timestamp"] or "", reverse=True)
        return conv_list

    def get_conversation_messages(self, phone: str) -> List[Dict[str, Any]]:
        clean_phone = extract_phone_number(phone)
        messages = []
        
        for ev in self._read_all_jsonl():
            if not ev.get("content"):
                continue
            ev_phone = extract_phone_number(ev.get("customer_phone") or ev.get("sender") or ev.get("recipient"))
            if ev_phone == clean_phone and ev.get("event_type") in ["inbound_message", "outbound_message"]:
                messages.append(ev)

        if not messages and self.collection is not None:
            try:
                query = {
                    "$or": [
                        {"customer_phone": clean_phone},
                        {"sender": clean_phone},
                        {"recipient": clean_phone}
                    ],
                    "event_type": {"$in": ["inbound_message", "outbound_message"]},
                    "content": {"$nin": [None, ""]}
                }
                cursor = self.collection.find(query, {"_id": 0})
                messages = list(cursor)
            except Exception:
                pass

        # Normalize display timestamps to customer message timestamp
        for m in messages:
            cust_ts = get_event_customer_timestamp(m)
            if cust_ts:
                m["received_at"] = cust_ts

        # Sort strictly chronologically by customer timestamp (oldest first to newest at bottom)
        messages.sort(key=lambda x: get_event_customer_timestamp(x) or "")
        return messages

    def get_delivery_reports(self, status_filter: Optional[str] = None, phone_filter: Optional[str] = None, limit: int = 200) -> List[Dict[str, Any]]:
        """
        Retrieves all WhatsApp delivery reports (both locally dispatched messages and
        Unifonic webhook delivery status callbacks from campaigns/templates).
        """
        all_ev = self._read_all_jsonl()
        if not all_ev and self.collection is not None:
            try:
                cursor = self.collection.find({"event_type": "delivery_status"}, {"_id": 0})
                all_ev = list(cursor)
            except Exception:
                pass
        
        # Correlate messages by message_id
        # message_id -> consolidated record
        reports_by_id: Dict[str, Dict[str, Any]] = {}

        for ev in all_ev:
            ev_type = ev.get("event_type")
            mid = ev.get("message_id")
            if not mid:
                continue

            phone = extract_phone_number(ev.get("recipient") or ev.get("customer_phone") or ev.get("raw_payload", {}).get("recipient"))
            raw_st = (ev.get("status") or ev.get("raw_payload", {}).get("eventType") or "SENT").upper()
            
            # Normalize status
            norm_st = "SENT"
            if "DELIV" in raw_st: norm_st = "DELIVERED"
            elif "READ" in raw_st: norm_st = "READ"
            elif "REJECT" in raw_st or "FAIL" in raw_st or "UNDELIV" in raw_st: norm_st = "FAILED"
            
            timestamp = ev.get("received_at") or ev.get("sent_at")

            if mid not in reports_by_id:
                reports_by_id[mid] = {
                    "message_id": mid,
                    "recipient": phone or "Unknown",
                    "content": ev.get("content") or "WhatsApp Notification / Campaign",
                    "status": norm_st,
                    "sent_at": timestamp,
                    "delivered_at": timestamp if norm_st == "DELIVERED" else None,
                    "read_at": timestamp if norm_st == "READ" else None,
                    "error": ev.get("error") or ev.get("raw_payload", {}).get("failReason")
                }
            else:
                rep = reports_by_id[mid]
                if phone and rep["recipient"] == "Unknown":
                    rep["recipient"] = phone
                if ev.get("content"):
                    rep["content"] = ev["content"]

                # Promote status according to progression: SENT -> DELIVERED -> READ or FAILED
                if norm_st == "READ":
                    rep["status"] = "READ"
                    rep["read_at"] = timestamp
                    if not rep["delivered_at"]: rep["delivered_at"] = timestamp
                elif norm_st == "DELIVERED" and rep["status"] != "READ":
                    rep["status"] = "DELIVERED"
                    rep["delivered_at"] = timestamp
                elif norm_st == "FAILED":
                    rep["status"] = "FAILED"
                    rep["error"] = ev.get("error") or ev.get("raw_payload", {}).get("failReason")

        # Convert to list and sort by latest activity
        reports = list(reports_by_id.values())
        reports.sort(key=lambda x: x.get("read_at") or x.get("delivered_at") or x.get("sent_at") or "", reverse=True)

        # Apply filters
        filtered = []
        for r in reports:
            if status_filter and status_filter.upper() != "ALL":
                sf = status_filter.upper()
                if sf == "SENT":
                    if r["status"] not in ["SENT", "DELIVERED", "READ"]:
                        continue
                elif sf == "DELIVERED":
                    if r["status"] not in ["DELIVERED", "READ"]:
                        continue
                elif sf == "UNCONFIRMED":
                    if r["status"] != "SENT":
                        continue
                elif r["status"] != sf:
                    continue
            if phone_filter and phone_filter not in str(r.get("recipient", "")):
                continue
            filtered.append(r)
            if len(filtered) >= limit:
                break

        return filtered

    def get_delivery_kpis(self) -> Dict[str, Any]:
        reports = self.get_delivery_reports(limit=5000)
        total = len(reports)
        
        read_count = 0
        delivered_only_count = 0
        unconfirmed_count = 0
        failed_count = 0

        for r in reports:
            st = (r.get("status") or "SENT").upper()
            if st == "READ":
                read_count += 1
            elif st == "DELIVERED":
                delivered_only_count += 1
            elif st == "FAILED":
                failed_count += 1
            else:
                unconfirmed_count += 1

        delivered_total = delivered_only_count + read_count
        sent_total = delivered_total + unconfirmed_count
        submitted_total = total
        
        # Unifonic Official Success Rate = (Sent / Total) * 100
        success_rate = round((sent_total / total * 100), 1) if total > 0 else 0.0
        delivery_rate = round((delivered_total / sent_total * 100), 1) if sent_total > 0 else 0.0
        read_rate = round((read_count / delivered_total * 100), 1) if delivered_total > 0 else 0.0
        failure_rate = round((failed_count / total * 100), 1) if total > 0 else 0.0

        # Count received customer messages (inbound)
        all_events = self._read_all_jsonl()
        inbound_count = sum(1 for ev in all_events if ev.get("event_type") == "inbound_message")
        
        # Unifonic Channel / Category stats
        marketing_lite_count = delivered_total
        utility_count = 0
        marketing_count = 0
        authentication_count = 0
        service_count = inbound_count
        
        # Meta conversation rates: ~$0.05 per Marketing Lite conversation in KSA
        bi_spending = round(marketing_lite_count * 0.05, 2)
        ui_spending = 0.0

        return {
            "total": total,
            "submitted": submitted_total,
            "sent": sent_total,
            "delivered": delivered_total,
            "read": read_count,
            "unconfirmed": unconfirmed_count,
            "failed": failed_count,
            "success_rate": success_rate,

            # Unifonic Channel Breakdown & Spending
            "channel": "Whatsapp",
            "messages_sent": sent_total,
            "messages_received": inbound_count,
            "messages_delivered": delivered_total,
            "marketing_lite": marketing_lite_count,
            "utility": utility_count,
            "marketing": marketing_count,
            "authentication": authentication_count,
            "service": service_count,
            "estimated_spending_bi": f"{bi_spending:.2f}",
            "estimated_spending_ui": f"{ui_spending:.2f}",

            # Compatibility fields
            "total_sent": total,
            "pending_sent": unconfirmed_count,
            "delivery_rate": delivery_rate,
            "read_rate": read_rate,
            "failure_rate": failure_rate
        }

    def get_recent_events(self, limit: int = 50) -> List[Dict[str, Any]]:
        events = self._read_all_jsonl()
        return list(reversed(events[-limit:]))

    def get_all_message_ids(self, limit: int = 1000) -> List[str]:
        ids = set()
        if self.is_mongo_connected():
            try:
                cursor = self.collection.find(
                    {"message_id": {"$exists": True, "$ne": None}},
                    {"message_id": 1}
                ).limit(limit)
                for doc in cursor:
                    m = doc.get("message_id")
                    if m and str(m).strip() and not str(m).startswith("msg_"):
                        ids.add(str(m).strip())
            except Exception as e:
                logger.warning(f"Error querying message IDs from Mongo: {e}")

        # Also fallback to JSONL
        for ev in self._read_all_jsonl():
            m = ev.get("message_id")
            if m and str(m).strip() and not str(m).startswith("msg_"):
                ids.add(str(m).strip())

        return list(ids)

    def update_unifonic_statuses(self, status_items: List[Dict[str, Any]]) -> int:
        updated = 0
        now_iso = datetime.now(timezone.utc).isoformat()
        for item in status_items:
            mid = item.get("messageId")
            st = item.get("status")
            if not mid or not st:
                continue

            statuses = item.get("statuses", [])
            delivered_at = None
            read_at = None
            for s in statuses:
                if s.get("status") == "DELIVERED":
                    delivered_at = s.get("createdAt")
                elif s.get("status") == "READ":
                    read_at = s.get("createdAt")

            # Update in Mongo
            if self.is_mongo_connected():
                try:
                    update_fields = {
                        "status": st,
                        "unifonic_sync_at": now_iso,
                        "raw_unifonic_status": item
                    }
                    if delivered_at:
                        update_fields["delivered_at"] = delivered_at
                    if read_at:
                        update_fields["read_at"] = read_at

                    res = self.collection.update_many(
                        {"message_id": mid},
                        {"$set": update_fields}
                    )
                    if res.modified_count > 0:
                        updated += 1
                except Exception as e:
                    logger.warning(f"Error updating Mongo status for {mid}: {e}")

            # Also write sync event to JSONL
            ev_data = {
                "event_type": "delivery_status",
                "message_id": mid,
                "status": st,
                "customer_phone": extract_phone_number(item.get("contact")),
                "delivered_at": delivered_at,
                "read_at": read_at,
                "received_at": now_iso,
                "direction": "status_update",
                "raw_payload": item
            }
            self._append_jsonl(ev_data)
            updated += 1

        return updated

storage = StorageManager()

