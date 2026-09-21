"""
Wafeq Sync Engine — Synchronize MongoDB Sales Orders into Wafeq Simplified Invoices
With dynamic payment methods (Moyasar, POS Card Terminal, Cash, Wallet)
and line-item discount calculations (coupons, promotions).
"""
import sys
import os
import datetime
import logging
from typing import Dict, Any, List, Optional, Tuple

# Ensure package root in sys.path
_CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
_REPO_ROOT = os.path.dirname(_CURRENT_DIR)
for p in [_REPO_ROOT, _CURRENT_DIR]:
    if p not in sys.path:
        sys.path.insert(0, p)

from db_manager import MongoManager
from wafeq_app.config import API_KEY, BASE_URL
from wafeq_app.api.client import WafeqClient
from wafeq_app.api.invoices import InvoicesAPI
from wafeq_app.api.contacts import ContactsAPI
from wafeq_app.api.accounts import AccountsAPI
from wafeq_app.api.tax_rates import TaxRatesAPI

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("wafeq_sync")

class WafeqSyncEngine:
    def __init__(self, client: Optional[WafeqClient] = None, mongo_mgr: Optional[MongoManager] = None):
        self.client = client or WafeqClient(api_key=API_KEY, base_url=BASE_URL)
        self.mongo = mongo_mgr or MongoManager()
        self.inv_api = InvoicesAPI(self.client)
        self.contacts_api = ContactsAPI(self.client)
        self.accounts_api = AccountsAPI(self.client)
        self.tax_api = TaxRatesAPI(self.client)

        self.payment_accounts_map: Dict[str, str] = {}
        self.sales_account_id: Optional[str] = None
        self.vat_tax_rate_id: Optional[str] = None
        self._cached_contacts: Optional[Dict[str, str]] = None
        self._cached_invoices: Optional[set] = None

    def _ensure_payment_accounts(self):
        """Fetch and ensure distinct payment accounts exist in Wafeq for all payment methods"""
        if self.payment_accounts_map and self.sales_account_id:
            return

        logger.info("Resolving Wafeq payment accounts and sales accounts...")
        all_accs = self.accounts_api.list_accounts()

        # 1. Sales revenue account
        for a in all_accs:
            if a.get("is_posting") and a.get("classification") in ["REVENUE", "INCOME"]:
                if "sales" in (a.get("name_en") or "").lower():
                    self.sales_account_id = a["id"]
                    break
        if not self.sales_account_id:
            revs = [a for a in all_accs if a.get("is_posting") and a.get("classification") in ["REVENUE", "INCOME"]]
            self.sales_account_id = revs[0]["id"] if revs else None

        # 2. Map existing payment accounts
        acc_name_map = {}
        for a in all_accs:
            if a.get("is_payment_enabled"):
                name_lower = (a.get("name_en") or "").lower()
                acc_name_map[name_lower] = a["id"]

        # Default fallback: Petty Cash
        petty_cash_id = acc_name_map.get("petty cash") or next(
            (a["id"] for a in all_accs if "cash" in (a.get("name_en") or "").lower() and a.get("is_payment_enabled")),
            None
        )

        # Map methods
        self.payment_accounts_map["cash"] = acc_name_map.get("petty cash", petty_cash_id)
        self.payment_accounts_map["pos_card"] = acc_name_map.get("pos card terminal", petty_cash_id)
        self.payment_accounts_map["moyasar"] = acc_name_map.get("moyasar gateway", petty_cash_id)
        self.payment_accounts_map["wallet"] = acc_name_map.get("customer wallet", petty_cash_id)
        self.payment_accounts_map["default"] = petty_cash_id

        # 3. Tax rate: 15% VAT on Sales
        vat15 = self.tax_api.get_standard_sales_vat()
        self.vat_tax_rate_id = vat15.get("id") if vat15 else None

        logger.info(f"Payment Accounts Configured: {self.payment_accounts_map}")
        logger.info(f"Sales Account: {self.sales_account_id}, Tax Rate: {self.vat_tax_rate_id}")

    def _resolve_paid_through_account(self, payments: List[Dict[str, Any]]) -> Tuple[str, str]:
        """Determine payment account and display name from order payments array"""
        if not payments:
            return self.payment_accounts_map.get("cash", self.payment_accounts_map["default"]), "Cash"

        p = payments[0]
        p_name = (p.get("paymentMethodNameEn") or "").strip()
        p_key = (p.get("paymentMethodIdentityKey") or "").lower()
        provider = (p.get("provider") or "").lower()

        # Check Moyasar / Online / Payment Link / Saved Card
        if provider == "moyasar" or "moyasar" in p_key or "payment_link" in p_key or "saved card" in p_name.lower():
            label = "Moyasar Online"
            if "saved card" in p_name.lower():
                label = "Moyasar (Saved Card)"
            elif "link" in p_name.lower():
                label = "Moyasar (Payment Link)"
            return self.payment_accounts_map.get("moyasar", self.payment_accounts_map["default"]), label

        # Check POS Terminal / Card
        if "pos_card" in p_key or "credit" in p_name.lower() or "card" in p_name.lower() or "mada" in p_name.lower():
            return self.payment_accounts_map.get("pos_card", self.payment_accounts_map["default"]), "POS Card Terminal"

        # Check Wallet
        if "wallet" in p_key or "wallet" in p_name.lower():
            return self.payment_accounts_map.get("wallet", self.payment_accounts_map["default"]), "Customer Wallet"

        # Cash
        return self.payment_accounts_map.get("cash", self.payment_accounts_map["default"]), "Cash"

    def _ensure_contact_cache(self):
        if self._cached_contacts is None:
            existing_conts = self.contacts_api.list_contacts()
            self._cached_contacts = {}
            for c in existing_conts:
                if c.get("phone"):
                    self._cached_contacts[c["phone"]] = c["id"]
                if c.get("name"):
                    self._cached_contacts[c["name"].strip()] = c["id"]

    def _ensure_invoice_cache(self):
        if self._cached_invoices is None:
            existing_invs = self.inv_api.list_invoices()
            self._cached_invoices = set()
            for inv in existing_invs:
                if inv.get("invoice_number"):
                    self._cached_invoices.add(inv["invoice_number"].strip())
                if inv.get("external_id"):
                    self._cached_invoices.add(inv["external_id"].strip())

    def get_or_create_contact(self, customer_id, customer_snapshot: Dict[str, Any]) -> Optional[str]:
        """Find contact in Wafeq or create a new one"""
        self._ensure_contact_cache()
        c_name = (customer_snapshot.get("name") or "").strip()
        c_phone = ""

        if customer_id and self.mongo.db is not None:
            try:
                cust_doc = self.mongo.db["rushwash_customers"].find_one({"_id": customer_id})
                if cust_doc:
                    c_phone = cust_doc.get("phone") or cust_doc.get("normalizedPhone") or ""
                    if not c_name:
                        c_name = cust_doc.get("name", "").strip()
            except Exception:
                pass

        if not c_name and not c_phone:
            return None

        if c_phone and c_phone in self._cached_contacts:
            return self._cached_contacts[c_phone]
        if c_name and c_name in self._cached_contacts:
            return self._cached_contacts[c_name]

        display_name = c_name or f"Customer {c_phone}"
        payload = {
            "name": display_name,
            "relationship": ["Customer"],
            "country": "SA",
        }
        if c_phone:
            payload["phone"] = c_phone

        try:
            created = self.contacts_api.create_contact(payload)
            cid = created.get("id")
            if cid:
                if c_phone:
                    self._cached_contacts[c_phone] = cid
                if c_name:
                    self._cached_contacts[c_name] = cid
                return cid
        except Exception as e:
            logger.warning(f"Could not create contact '{display_name}' in Wafeq: {e}")

        return None

    def get_orders_for_date(self, target_date: datetime.date) -> List[Dict[str, Any]]:
        """Fetch all paid/captured sales orders for a given date from MongoDB"""
        col = self.mongo.db["rushwash_sale_orders"]
        eligible_orders = []

        for doc in col.find().sort("createdAt", -1):
            c_at = doc.get("createdAt")
            if not c_at:
                continue
            
            if c_at.year == target_date.year and c_at.month == target_date.month and c_at.day == target_date.day:
                status = doc.get("status")
                total = float(doc.get("totalCaptured") or doc.get("postDiscountTotal") or 0)
                has_paid_payment = any(p.get("status") == "paid" for p in doc.get("payments", []))

                if (has_paid_payment or status in ["paid", "active"]) and total > 0:
                    eligible_orders.append(doc)
            elif c_at.year < target_date.year or (c_at.year == target_date.year and (c_at.month < target_date.month or (c_at.month == target_date.month and c_at.day < target_date.day))):
                break

        return eligible_orders

    def build_invoice_line_items(self, order: Dict[str, Any], total_captured: float) -> Tuple[List[Dict[str, Any]], str]:
        """
        Parses order services, packages, and discounts into Wafeq line items.
        Applies line-level discount percentage and labels coupons.
        """
        raw_lines = order.get("lines", [])
        
        # 1. Separate service lines and discount/coupon lines
        service_lines = []
        discount_lines = []
        for l in raw_lines:
            price = float(l.get("price") or l.get("unitPrice") or 0)
            kind = l.get("lineKind", "")
            l_type = l.get("type", "")
            if kind == "coupon" or l_type == "discount" or price < 0:
                discount_lines.append(l)
            elif kind in ["service", "package"] or price > 0:
                service_lines.append(l)

        # Total discount amount
        total_discount = sum(abs(float(d.get("price") or 0)) for d in discount_lines)
        promo_info = ""
        if discount_lines:
            coupon_names = [d.get("displayNameEn") or d.get("displayNameAr") or "Discount" for d in discount_lines]
            promo_info = ", ".join(coupon_names)

        line_items = []

        if len(service_lines) == 1:
            s = service_lines[0]
            desc = s.get("displayNameEn") or s.get("displayNameAr") or "Car Wash Service"
            orig_price = float(s.get("price") or s.get("unitPrice") or total_captured)
            
            if total_discount > 0 and orig_price > total_captured and orig_price > 0:
                # Calculate discount percentage
                disc_pct = round((total_discount / orig_price) * 100.0, 4)
                # Clamp to 100
                disc_pct = min(100.0, max(0.0, disc_pct))
                desc_label = f"{desc} ({promo_info})" if promo_info else desc
                line_items.append({
                    "account": self.sales_account_id,
                    "description": desc_label,
                    "quantity": 1,
                    "unit_amount": orig_price,
                    "discount": disc_pct,
                    "tax_rate": self.vat_tax_rate_id
                })
            else:
                line_items.append({
                    "account": self.sales_account_id,
                    "description": desc,
                    "quantity": 1,
                    "unit_amount": total_captured,
                    "tax_rate": self.vat_tax_rate_id
                })

        elif len(service_lines) > 1:
            # Multiple services
            subtotal_sum = sum(float(l.get("price") or l.get("unitPrice") or 0) for l in service_lines)
            
            # Check if one specific line is 100% discounted (e.g. Free Interior)
            discount_applied = False
            for s in service_lines:
                desc = s.get("displayNameEn") or s.get("displayNameAr") or "Service"
                l_price = float(s.get("price") or s.get("unitPrice") or 0)
                
                # Check matching discount (e.g. 79 SAR interior with 79 SAR coupon)
                matching_disc = next((d for d in discount_lines if abs(float(d.get("price") or 0)) == l_price), None)
                if matching_disc:
                    disc_name = matching_disc.get("displayNameEn") or "Free Promo"
                    line_items.append({
                        "account": self.sales_account_id,
                        "description": f"{desc} ({disc_name})",
                        "quantity": 1,
                        "unit_amount": l_price,
                        "discount": 100.0,
                        "tax_rate": self.vat_tax_rate_id
                    })
                    discount_applied = True
                else:
                    line_items.append({
                        "account": self.sales_account_id,
                        "description": desc,
                        "quantity": 1,
                        "unit_amount": l_price,
                        "tax_rate": self.vat_tax_rate_id
                    })

            # If general discount not line-matched, apply proportional discount
            if not discount_applied and total_discount > 0 and subtotal_sum > 0:
                disc_pct = round((total_discount / subtotal_sum) * 100.0, 4)
                disc_pct = min(100.0, max(0.0, disc_pct))
                for item in line_items:
                    item["discount"] = disc_pct
                    if promo_info:
                        item["description"] = f"{item['description']} ({promo_info})"

        else:
            # Fallback
            desc = "Rush Wash Service"
            if promo_info:
                desc += f" ({promo_info})"
            line_items.append({
                "account": self.sales_account_id,
                "description": desc,
                "quantity": 1,
                "unit_amount": total_captured,
                "tax_rate": self.vat_tax_rate_id
            })

        return line_items, promo_info

    def sync_order(self, order: Dict[str, Any]) -> Tuple[bool, str]:
        """Convert a MongoDB sales order to an accurate Wafeq Simplified Invoice"""
        self._ensure_payment_accounts()
        self._ensure_invoice_cache()

        order_code = order.get("readableCode") or str(order["_id"])
        
        # Idempotency check: Skip if already exists in Wafeq
        if order_code in self._cached_invoices or str(order["_id"]) in self._cached_invoices:
            return True, "Already synced (skipped)"

        # Total amount
        total_captured = float(order.get("totalCaptured") or order.get("postDiscountTotal") or 0)
        if total_captured <= 0:
            return False, "Order has 0 captured amount"

        # Date
        c_at = order.get("createdAt") or datetime.datetime.now()
        inv_date = c_at.strftime("%Y-%m-%d")

        # Contact
        contact_id = self.get_or_create_contact(order.get("customerId"), order.get("customerSnapshot") or {})

        # Resolve Payment Account & Label
        payments = order.get("payments", [])
        payment_acc_id, payment_label = self._resolve_paid_through_account(payments)

        # Build Line Items with Discount Breakdown
        line_items, promo_info = self.build_invoice_line_items(order, total_captured)

        # Reference & Notes
        plate = order.get("normalizedPlate") or "No Plate"
        cust_name = (order.get("customerSnapshot") or {}).get("name") or "Walk-in"

        ref_parts = [f"Plate: {plate}", f"Method: {payment_label}"]
        if promo_info:
            ref_parts.append(f"Promo: {promo_info}")
        ref_text = " | ".join(ref_parts)

        notes_parts = [
            f"Rush Wash Order #{order_code}",
            f"Customer: {cust_name}",
            f"Vehicle Plate: {plate}",
            f"Payment Method: {payment_label}",
        ]
        if promo_info:
            notes_parts.append(f"Discounts / Coupons Applied: {promo_info}")
        notes_text = " • ".join(notes_parts)

        payload = {
            "invoice_number": order_code,
            "invoice_date": inv_date,
            "currency": "SAR",
            "paid_through_account": payment_acc_id,
            "status": "PAID",
            "tax_amount_type": "TAX_INCLUSIVE",
            "reference": ref_text[:250],
            "notes": notes_text,
            "line_items": line_items
        }
        if contact_id:
            payload["contact"] = contact_id

        # Retry loop for rate limits
        for attempt in range(3):
            try:
                res = self.inv_api.create_invoice(payload)
                inv_id = res.get("id")
                self._cached_invoices.add(order_code)
                return True, f"Created {inv_id} ({payment_label})"
            except Exception as e:
                err_str = str(e)
                if ("429" in err_str or "throttled" in err_str.lower()) and attempt < 2:
                    import time
                    time.sleep(2.0)
                    continue
                return False, f"Failed: {err_str}"

    def sync_today(self, progress_callback=None) -> Dict[str, Any]:
        """Execute full sync for today's orders into Wafeq"""
        import time
        today = datetime.date(2026, 9, 21)
        logger.info(f"Starting accurate Wafeq sync for date: {today.isoformat()}")

        self._ensure_payment_accounts()
        self._ensure_invoice_cache()
        self._ensure_contact_cache()

        orders = self.get_orders_for_date(today)
        total_count = len(orders)
        logger.info(f"Found {total_count} captured orders to synchronize.")

        synced = 0
        skipped = 0
        errors = 0
        error_details = []
        synced_amount = 0.0

        for idx, order in enumerate(orders, start=1):
            code = order.get("readableCode") or str(order["_id"])
            total = float(order.get("totalCaptured") or order.get("postDiscountTotal") or 0)
            
            success, msg = self.sync_order(order)
            time.sleep(0.4) # Polite spacing to prevent 429 rate limiting
            if success:
                if "skipped" in msg.lower():
                    skipped += 1
                else:
                    synced += 1
                    synced_amount += total
                    logger.info(f"[{idx}/{total_count}] Synced {code} ({total} SAR) -> {msg}")
            else:
                errors += 1
                error_details.append(f"{code}: {msg}")
                logger.error(f"[{idx}/{total_count}] Error syncing {code}: {msg}")

            if progress_callback:
                progress_callback(idx, total_count, code, success)

        result = {
            "date": today.isoformat(),
            "total_orders": total_count,
            "synced": synced,
            "skipped": skipped,
            "errors": errors,
            "error_details": error_details,
            "synced_amount_sar": round(synced_amount, 2)
        }
        logger.info(f"Sync completed: {result}")
        return result


def run_cli_sync():
    print("=" * 65)
    print("  Rush Wash -> Wafeq Accounting Sync Engine")
    print("  Accurate Payment Methods & Discount Calculations")
    print("  Syncing Today's Data (2026-09-21)")
    print("=" * 65)

    engine = WafeqSyncEngine()
    res = engine.sync_today()

    print("\n" + "=" * 65)
    print("  SYNC COMPLETED SUCCESSFULLY")
    print("=" * 65)
    print(f"  Total Orders Examined: {res['total_orders']}")
    print(f"  Invoices Created:      {res['synced']}")
    print(f"  Already Synced:        {res['skipped']}")
    print(f"  Errors / Failures:     {res['errors']}")
    print(f"  Total Revenue Synced:  {res['synced_amount_sar']:,.2f} SAR")
    print("=" * 65)

if __name__ == "__main__":
    run_cli_sync()
