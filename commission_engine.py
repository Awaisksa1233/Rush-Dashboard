"""
commission_engine.py - RUSH Subscription Commission Calculation Engine

Implements subscription commission calculation for RUSH CRM / POS system:
- Commission rates:
    Fresh: 2 SAR
    Shiny: 6 SAR
    Nano: 10 SAR
    Interior Cleaning: 10 SAR
- Qualifying condition: Successful first FULL-PRICE renewal (initial purchase = 0 SAR).
- Retries during retry window qualify if full price is successfully paid.
- Component-level attribution:
    - Original salesperson keeps base package commission.
    - Upgrade salesperson receives incremental commission (new pkg - old pkg).
    - Interior Cleaning salesperson receives 10 SAR (or original rep if sold together).
    - Inactive / former employees retain entitlement.
- Winback evaluation:
    - Customer expired/cancelled for >= 60 days before new subscription: 50% commission.
    - Customer inactive < 60 days: normal commission.
    - Winback promotion applied: 0 SAR commission.
- Awarded strictly once per subscription lifecycle (idempotent).
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Tuple
import re

# Standard Commission Rates in SAR
PACKAGE_COMMISSION_RATES = {
    "fresh": 2.0,
    "shiny": 6.0,
    "nano": 10.0,
}
INTERIOR_COMMISSION_RATE = 10.0

# Catalog / Code mappings
PACKAGE_CODE_MAP = {
    "SPK-00001": {"tier": "fresh", "has_interior": False, "name": "Fresh"},
    "SPK-00002": {"tier": "shiny", "has_interior": False, "name": "Shiny"},
    "SPK-00003": {"tier": "nano", "has_interior": False, "name": "Nano"},
    "SPK-00004": {"tier": None, "has_interior": True, "name": "Interior Clean"},
    "SPK-00005": {"tier": "nano", "has_interior": True, "name": "Nano + Interior"},
    "SPK-00006": {"tier": "shiny", "has_interior": True, "name": "Shiny + Interior Cleaning"},
}

WINBACK_PROMO_PATTERNS = [
    r"winback",
    r"comeback",
    r"rushback",
    r"come_back",
    r"win_back",
]

WINBACK_DISCOUNT_CODES = {"COMEBACK", "RUSHBACK", "RUSHBACK25", "DSC-00059", "DSC-00064", "DSC-00065"}
WINBACK_CAMPAIGN_CODES = {"CMP-00004", "CMP-00009", "CMP-00010"}


def parse_datetime(val: Any) -> Optional[datetime]:
    """Parses date from string, Mongo dict, or datetime into UTC datetime."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val
    if isinstance(val, dict) and "$date" in val:
        val = val["$date"]
    if isinstance(val, str):
        val = val.strip()
        if not val:
            return None
        # Handle ISO with Z or offset
        val = val.replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(val)
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
        except Exception:
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    dt = datetime.strptime(val[:19], fmt)
                    return dt.replace(tzinfo=timezone.utc)
                except Exception:
                    pass
    return None


def resolve_package_and_services(order_or_sub: Dict[str, Any]) -> Tuple[Optional[str], bool]:
    """
    Identifies the active exterior package tier ('fresh', 'shiny', 'nano')
    and whether Interior Cleaning is present.
    """
    tier: Optional[str] = None
    has_interior = False

    # 1. Check lines / lineSnapshots
    lines = order_or_sub.get("lines") or order_or_sub.get("lineSnapshots") or []
    for line in lines:
        line_code = (
            line.get("catalogCode")
            or line.get("planReadableCode")
            or line.get("servicePackageCode")
            or ""
        ).upper()
        display_name = (line.get("displayNameEn") or line.get("nameEn") or "").lower()

        if line_code in PACKAGE_CODE_MAP:
            info = PACKAGE_CODE_MAP[line_code]
            if info["tier"]:
                tier = info["tier"]
            if info["has_interior"]:
                has_interior = True
        elif "interior" in display_name:
            has_interior = True
        elif "nano" in display_name:
            tier = "nano"
        elif "shiny" in display_name:
            tier = "shiny"
        elif "fresh" in display_name:
            tier = "fresh"

    # 2. Check direct packageReadableCode or packageNameEn if not resolved
    if not tier:
        pkg_code = (
            order_or_sub.get("packageReadableCode")
            or order_or_sub.get("packageCode")
            or ""
        ).upper()
        if pkg_code in PACKAGE_CODE_MAP:
            info = PACKAGE_CODE_MAP[pkg_code]
            if info["tier"]:
                tier = info["tier"]
            if info["has_interior"]:
                has_interior = True

    if not tier:
        pkg_name = (
            order_or_sub.get("packageNameEn")
            or order_or_sub.get("packageName")
            or ""
        ).lower()
        if "nano" in pkg_name:
            tier = "nano"
        elif "shiny" in pkg_name:
            tier = "shiny"
        elif "fresh" in pkg_name:
            tier = "fresh"

        if "interior" in pkg_name:
            has_interior = True

    # 3. Check child subscription or parentSubCode presence for interior
    if order_or_sub.get("hasInteriorAddon") or order_or_sub.get("interiorAddonPresent"):
        has_interior = True

    return tier, has_interior


def is_order_full_price(order: Dict[str, Any]) -> bool:
    """
    Determines if a renewal order was paid at full price (not discounted/promotional).
    """
    # If order is explicitly marked as discounted
    if order.get("isDiscounted") is True:
        return False

    post = order.get("postDiscountTotal")
    pre = order.get("preDiscountSubtotal")

    if post is not None and pre is not None:
        try:
            if float(post) < float(pre):
                return False
        except (ValueError, TypeError):
            pass

    # Check for discount lines
    lines = order.get("lines") or order.get("lineSnapshots") or []
    for line in lines:
        line_kind = line.get("lineKind") or line.get("type") or ""
        if line_kind in ["discount", "custom_discount", "coupon"]:
            return False
        price = line.get("price") or 0
        try:
            if float(price) < 0:
                return False
        except (ValueError, TypeError):
            pass

    # Check if discounts / coupon list is non-empty
    discounts = order.get("discounts")
    if discounts and isinstance(discounts, list) and len(discounts) > 0:
        return False

    if order.get("couponCode") or order.get("discountCode"):
        return False

    return True


def is_winback_promo(
    order: Optional[Dict[str, Any]] = None,
    subscription: Optional[Dict[str, Any]] = None,
    coupon_redemptions: Optional[List[Dict[str, Any]]] = None
) -> bool:
    """
    Checks if a winback promotion was used at rejoining.
    """
    sources_to_check = []
    if order:
        sources_to_check.append(order.get("couponCode") or "")
        sources_to_check.append(order.get("discountCode") or "")
        sources_to_check.append(order.get("promoCode") or "")
        lines = order.get("lines") or []
        for l in lines:
            sources_to_check.append(l.get("displayNameEn") or "")
            sources_to_check.append(l.get("code") or "")
    if subscription:
        sources_to_check.append(subscription.get("promoCode") or "")
        sources_to_check.append(subscription.get("promoEntitlement") or "")
        sources_to_check.append(subscription.get("discountCode") or "")

    if coupon_redemptions:
        for cr in coupon_redemptions:
            c_code = cr.get("couponCode") or cr.get("couponReadableCode") or ""
            camp_code = cr.get("campaignCode") or ""
            if c_code.upper() in WINBACK_DISCOUNT_CODES or camp_code.upper() in WINBACK_CAMPAIGN_CODES:
                return True
            sources_to_check.append(c_code)
            sources_to_check.append(camp_code)

    for item in sources_to_check:
        if not item or not isinstance(item, str):
            continue
        item_upper = item.upper()
        if item_upper in WINBACK_DISCOUNT_CODES or item_upper in WINBACK_CAMPAIGN_CODES:
            return True
        for pat in WINBACK_PROMO_PATTERNS:
            if re.search(pat, item, re.IGNORECASE):
                return True

    return False


def is_payment_successful(order: Dict[str, Any]) -> Tuple[bool, bool, Optional[datetime]]:
    """
    Checks whether the renewal order payment was successful, whether it succeeded on retry,
    and returns (is_paid, is_retry, paid_at).
    """
    payments = order.get("payments") or []
    order_status = (order.get("status") or "").lower()

    if not payments:
        # Fallback to order status
        if order_status in ["paid", "active"]:
            completed_at = parse_datetime(order.get("completedAt") or order.get("updatedAt") or order.get("createdAt"))
            return True, False, completed_at
        return False, False, None

    # Check payments list
    successful_payments = []
    has_prior_failure = False

    for idx, p in enumerate(payments):
        p_status = (p.get("status") or "").lower()
        att_num = p.get("attemptNumber", idx + 1)
        if p_status in ["paid", "succeeded", "captured"]:
            p_date = parse_datetime(p.get("occurredAt") or order.get("completedAt") or order.get("createdAt"))
            successful_payments.append((p, att_num, p_date))
        elif p_status in ["failed", "declined"]:
            has_prior_failure = True

    if successful_payments:
        _, att_num, paid_at = successful_payments[-1]
        is_retry = (att_num > 1) or has_prior_failure or (order.get("isRetry") is True)
        return True, is_retry, paid_at

    # If no successful payment entry, order is unpaid
    return False, False, None


def evaluate_winback_status(
    new_sub_created_at: Optional[datetime],
    previous_sub_ended_at: Optional[datetime]
) -> Tuple[bool, Optional[int]]:
    """
    Determines if customer qualifies as winback (inactive >= 60 days).
    Returns (is_winback, days_inactive).
    """
    if not new_sub_created_at or not previous_sub_ended_at:
        return False, None

    # Customer must have been expired/cancelled for 60 days or more before new subscription starts
    diff = new_sub_created_at - previous_sub_ended_at
    days_inactive = diff.days

    # Exactly 60 days or more qualifies
    if days_inactive >= 60:
        return True, days_inactive

    return False, days_inactive


class CommissionEngine:
    """
    Stateful and stateless engine to compute subscription commissions,
    preserves historical attribution, and outputs detailed audit records.
    """

    def __init__(self):
        # Set of awarded subscription IDs / lifecycle keys to guarantee idempotency
        self.awarded_subscriptions = set()

    def reset_awarded(self):
        self.awarded_subscriptions.clear()

    def calculate_renewal_commission(
        self,
        subscription: Dict[str, Any],
        qualifying_renewal_order: Dict[str, Any],
        original_order: Optional[Dict[str, Any]] = None,
        upgrade_orders: Optional[List[Dict[str, Any]]] = None,
        previous_subscription: Optional[Dict[str, Any]] = None,
        coupon_redemptions: Optional[List[Dict[str, Any]]] = None,
        force_recalculate: bool = False
    ) -> Dict[str, Any]:
        """
        Calculates commission for a subscription at its renewal order.

        Returns an audit record dictionary with full attribution breakdown.
        """
        sub_code = (
            subscription.get("readableCode")
            or subscription.get("id")
            or (str(subscription.get("_id", {}).get("$oid", "")) if isinstance(subscription.get("_id"), dict) else str(subscription.get("_id", "")))
        )
        sub_lifecycle_key = f"sub_{sub_code}"

        # 1. Idempotency Check
        if not force_recalculate and sub_lifecycle_key in self.awarded_subscriptions:
            return {
                "qualified": False,
                "status": "already_awarded",
                "commission_amount": 0.0,
                "reason": "Commission has already been awarded for this subscription lifecycle.",
                "subscription": sub_code,
                "items": []
            }

        # 2. Verify Qualifying Renewal Payment
        is_paid, is_retry, paid_date = is_payment_successful(qualifying_renewal_order)
        if not is_paid:
            return {
                "qualified": False,
                "status": "payment_unsuccessful",
                "commission_amount": 0.0,
                "reason": "Renewal payment has not been successfully collected.",
                "subscription": sub_code,
                "items": []
            }

        # 3. Full-Price Qualification Check
        is_full = is_order_full_price(qualifying_renewal_order)
        if not is_full:
            return {
                "qualified": False,
                "status": "discounted_renewal",
                "commission_amount": 0.0,
                "reason": "Renewal was not at full price. Commission waits for the first full-price renewal.",
                "subscription": sub_code,
                "items": []
            }

        # 4. Winback Promo Check (0 SAR if rejoined with winback promotion)
        if is_winback_promo(original_order, subscription, coupon_redemptions):
            # Still counts as the qualifying renewal evaluated, but awards 0 SAR permanently
            if not force_recalculate:
                self.awarded_subscriptions.add(sub_lifecycle_key)
            return {
                "qualified": True,
                "status": "winback_promo_excluded",
                "commission_amount": 0.0,
                "reason": "Rejoined using a winback promotion. Disqualified from commission.",
                "subscription": sub_code,
                "is_winback": True,
                "winback_promo": True,
                "earned_date": paid_date,
                "items": []
            }

        # 5. Determine Active Package & Services on the Qualifying Renewal
        renewal_tier, renewal_has_interior = resolve_package_and_services(qualifying_renewal_order)

        # If renewal lines didn't explicitly specify package, fallback to current subscription package
        if not renewal_tier and not renewal_has_interior:
            renewal_tier, renewal_has_interior = resolve_package_and_services(subscription)

        # 6. Winback Evaluation (>= 60 days inactive)
        sub_created_at = parse_datetime(subscription.get("createdAt") or (original_order.get("createdAt") if original_order else None))
        prev_ended_at = None
        if previous_subscription:
            prev_ended_at = parse_datetime(
                previous_subscription.get("cancelEffective")
                or previous_subscription.get("cancelledAt")
                or previous_subscription.get("terminatedAt")
                or previous_subscription.get("renewalDate")
            )

        # Also support explicit flag on subscription for winback
        is_winback = False
        days_inactive = None
        if subscription.get("isWinback") is not None:
            is_winback = bool(subscription.get("isWinback"))
            days_inactive = subscription.get("daysInactive")
        elif previous_subscription and sub_created_at and prev_ended_at:
            is_winback, days_inactive = evaluate_winback_status(sub_created_at, prev_ended_at)

        rate_multiplier = 0.5 if is_winback else 1.0

        # 7. Salesperson Attribution Resolution
        # Identify original salesperson
        original_rep = (
            (original_order.get("salespersonCode") if original_order else None)
            or (original_order.get("employeeReadableCode") if original_order else None)
            or subscription.get("originalSalespersonCode")
            or subscription.get("salespersonCode")
            or "UNASSIGNED_ORIGINAL"
        )
        original_rep_name = (
            (original_order.get("salespersonName") if original_order else None)
            or subscription.get("originalSalespersonName")
            or original_rep
        )

        # Identify original package tier sold
        orig_tier, orig_has_interior = None, False
        if original_order:
            orig_tier, orig_has_interior = resolve_package_and_services(original_order)
        if not orig_tier:
            # Fallback to subscription initial package snapshot
            orig_tier = subscription.get("originalPackageTier") or renewal_tier

        # Track upgrades and component attribution
        # Base package commission
        items = []
        total_commission = 0.0

        # Package Hierarchy values: fresh (2), shiny (6), nano (10)
        final_tier_val = PACKAGE_COMMISSION_RATES.get(renewal_tier, 0.0) if renewal_tier else 0.0
        orig_tier_val = PACKAGE_COMMISSION_RATES.get(orig_tier, 0.0) if orig_tier else 0.0

        # If downgraded or same
        if final_tier_val > 0:
            if orig_tier_val > 0 and orig_tier_val <= final_tier_val:
                orig_pkg_comm = round(orig_tier_val * rate_multiplier, 2)
                incremental_comm = round((final_tier_val - orig_tier_val) * rate_multiplier, 2)

                # Original rep receives their base package attribution
                items.append({
                    "component": f"Package Base ({orig_tier.capitalize()})",
                    "salesperson_code": original_rep,
                    "salesperson_name": original_rep_name,
                    "role_in_sale": "original_salesperson",
                    "base_rate": orig_tier_val,
                    "commission_amount": orig_pkg_comm,
                })
                total_commission += orig_pkg_comm

                # If upgraded by another salesperson
                if incremental_comm > 0:
                    # Find upgrade rep
                    upgrade_rep = original_rep
                    upgrade_rep_name = original_rep_name
                    if upgrade_orders:
                        # Find the upgrade order that upgraded the exterior tier
                        for uo in reversed(upgrade_orders):
                            uo_tier, _ = resolve_package_and_services(uo)
                            if uo_tier and (uo_tier == renewal_tier or uo.get("subscriptionTransitionKind") in ["upgrade", "change"]):
                                uo_rep = uo.get("salespersonCode") or uo.get("employeeReadableCode")
                                if uo_rep:
                                    upgrade_rep = uo_rep
                                    upgrade_rep_name = uo.get("salespersonName") or upgrade_rep
                                    break

                    items.append({
                        "component": f"Package Upgrade ({orig_tier.capitalize()} -> {renewal_tier.capitalize()})",
                        "salesperson_code": upgrade_rep,
                        "salesperson_name": upgrade_rep_name,
                        "role_in_sale": "upgrade_salesperson",
                        "base_rate": final_tier_val - orig_tier_val,
                        "commission_amount": incremental_comm,
                    })
                    total_commission += incremental_comm
            else:
                # Direct attribution of the renewal package rate
                pkg_comm = round(final_tier_val * rate_multiplier, 2)
                items.append({
                    "component": f"Package ({renewal_tier.capitalize()})",
                    "salesperson_code": original_rep,
                    "salesperson_name": original_rep_name,
                    "role_in_sale": "original_salesperson",
                    "base_rate": final_tier_val,
                    "commission_amount": pkg_comm,
                })
                total_commission += pkg_comm

        # Interior Cleaning Attribution
        if renewal_has_interior:
            interior_base = INTERIOR_COMMISSION_RATE
            interior_comm = round(interior_base * rate_multiplier, 2)

            # Determine who added interior clean
            interior_rep = original_rep
            interior_rep_name = original_rep_name

            # If interior was added after initial subscription by another rep
            if not orig_has_interior and upgrade_orders:
                for uo in upgrade_orders:
                    _, uo_interior = resolve_package_and_services(uo)
                    if uo_interior or uo.get("subscriptionTransitionKind") == "add_interior":
                        uo_rep = uo.get("salespersonCode") or uo.get("employeeReadableCode")
                        if uo_rep:
                            interior_rep = uo_rep
                            interior_rep_name = uo.get("salespersonName") or interior_rep
                            break

            items.append({
                "component": "Interior Cleaning",
                "salesperson_code": interior_rep,
                "salesperson_name": interior_rep_name,
                "role_in_sale": "addon_salesperson" if interior_rep != original_rep else "original_salesperson",
                "base_rate": interior_base,
                "commission_amount": interior_comm,
            })
            total_commission += interior_comm

        total_commission = round(total_commission, 2)

        # Mark as awarded to preserve idempotency
        if not force_recalculate:
            self.awarded_subscriptions.add(sub_lifecycle_key)

        customer_snap = subscription.get("customerSnapshot") or qualifying_renewal_order.get("customerSnapshot") or {}
        cust_code = customer_snap.get("readableCode") or subscription.get("customerCode") or subscription.get("customerId")

        upgrade_rep_code = None
        addon_rep_code = None
        for it in items:
            if it.get("role_in_sale") == "upgrade_salesperson":
                upgrade_rep_code = it.get("salesperson_code")
            elif it.get("role_in_sale") == "addon_salesperson":
                addon_rep_code = it.get("salesperson_code")

        pkg_display = (renewal_tier.capitalize() if renewal_tier else "Standard")
        if renewal_has_interior:
            pkg_display += " + Interior Clean"

        audit_record = {
            "qualified": True,
            "status": "earned",
            "commission_status": "Earned",
            "commission_amount": total_commission,
            "customer": cust_code,
            "customer_name": customer_snap.get("name"),
            "subscription": sub_code,
            "qualifying_renewal_order": qualifying_renewal_order.get("readableCode") or qualifying_renewal_order.get("id"),
            "qualifying_payment_id": (
                qualifying_renewal_order.get("payments", [{}])[-1].get("providerPaymentId")
                if qualifying_renewal_order.get("payments")
                else None
            ),
            "package_tier": renewal_tier,
            "has_interior": renewal_has_interior,
            "package_service_display": pkg_display,
            "is_winback": is_winback,
            "winback_eligibility": f"Winback ({days_inactive}d inactive)" if is_winback else "Standard New Subscriber",
            "days_inactive": days_inactive,
            "is_retry": is_retry,
            "is_full_price": True,
            "promotion_status": "Full Price (No Promotion)",
            "earned_date": paid_date or datetime.now(timezone.utc),
            "original_salesperson": original_rep,
            "original_salesperson_name": original_rep_name,
            "upgrade_salesperson": upgrade_rep_code,
            "addon_salesperson": addon_rep_code,
            "salesperson_receiving": [it["salesperson_code"] for it in items],
            "items": items
        }

        return audit_record


def calculate_commissions_from_data(
    subs: List[Dict[str, Any]],
    orders: List[Dict[str, Any]],
    employees: Any,
    sessions: Any,
    coupon_redemptions: Optional[List[Dict[str, Any]]] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    rep_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    Computes subscription renewal commissions from in-memory records.
    Works identically for database cursors, API payloads, or backup JSONs.
    """
    from collections import defaultdict
    engine = CommissionEngine()

    # 1. Normalize employee map
    emp_map = {}
    if isinstance(employees, dict):
        emp_map = employees
    elif isinstance(employees, list):
        for e in employees:
            rc = e.get("readableCode")
            if rc:
                emp_map[rc] = e
            if "_id" in e:
                oid = e["_id"].get("$oid") if isinstance(e["_id"], dict) else str(e["_id"])
                emp_map[oid] = e
            if e.get("platformUserId"):
                emp_map[e["platformUserId"]] = e

    # Normalize sessions
    session_map = {}
    if isinstance(sessions, dict):
        session_map = sessions
    elif isinstance(sessions, list):
        for s in sessions:
            s_code = s.get("readableCode")
            e_code = s.get("employeeReadableCode")
            e_oid = str(s.get("employeeId", {}).get("$oid", "")) if isinstance(s.get("employeeId"), dict) else str(s.get("employeeId", ""))
            p_uid = s.get("platformUserId")
            emp_doc = emp_map.get(e_code) or emp_map.get(e_oid) or emp_map.get(p_uid) or {}
            session_map[s_code] = {
                "code": e_code or emp_doc.get("readableCode") or "EMP-UNKNOWN",
                "name": emp_doc.get("legacyName") or emp_doc.get("name") or "Sales Rep",
                "role": emp_doc.get("role", "cashier")
            }

    # 2. Index orders by subscription and customer
    sub_orders = defaultdict(list)
    cust_orders = defaultdict(list)
    for o in orders:
        sess_code = o.get("posSessionReadableCode")
        if sess_code and sess_code in session_map:
            o["salespersonCode"] = session_map[sess_code]["code"]
            o["salespersonName"] = session_map[sess_code]["name"]
        elif not o.get("salespersonCode"):
            o["salespersonCode"] = None
            o["salespersonName"] = None

        sc = o.get("subscriptionReadableCode")
        if not sc and o.get("notes"):
            m_sub = re.search(r"SUB-\d+", str(o.get("notes", "")), re.IGNORECASE)
            if m_sub:
                sc = m_sub.group(0).upper()
                o["subscriptionReadableCode"] = sc

        if sc:
            sub_orders[sc].append(o)

        c_snap = o.get("customerSnapshot") or {}
        c_code = c_snap.get("readableCode") or str(o.get("customerId", ""))
        if c_code:
            cust_orders[c_code].append(o)

    for sc in sub_orders:
        sub_orders[sc].sort(key=lambda x: str(x.get("createdAt") or ""))

    # 3. Index main subscriptions by customer
    cust_subs = defaultdict(list)
    for s in subs:
        if s.get("parentSubCode"):
            continue
        c_snap = s.get("customerSnapshot") or {}
        c_code = c_snap.get("readableCode") or (s.get("customerId", {}).get("$oid") if isinstance(s.get("customerId"), dict) else str(s.get("customerId", "")))
        if c_code:
            cust_subs[c_code].append(s)

    # 4. Calculate commissions
    total_awarded = 0
    total_comm_sar = 0.0
    audit_records = []
    rep_commissions = defaultdict(lambda: {
        "total_commission": 0.0,
        "qualifying_renewals_count": 0,
        "package_base_commission": 0.0,
        "upgrade_commission": 0.0,
        "interior_commission": 0.0,
        "winback_commission": 0.0
    })

    utc_start = parse_datetime(start_date)
    utc_end = parse_datetime(end_date)

    for c_code, c_subs in cust_subs.items():
        c_subs.sort(key=lambda x: str(x.get("createdAt") or ""))
        for idx, s in enumerate(c_subs):
            prev_sub = c_subs[idx - 1] if idx > 0 else None
            s_code = s.get("readableCode")
            o_list = sub_orders.get(s_code, [])
            if not o_list:
                continue

            orig_order = None
            upgrades = []
            renewals = []

            for o in o_list:
                if o.get("isRenewal") or o.get("subscriptionTransitionKind") == "renew" or "subscription_renewal" in (o.get("notes") or "").lower():
                    renewals.append(o)
                elif o.get("subscriptionTransitionKind") in ["upgrade", "change", "add_interior"]:
                    upgrades.append(o)
                elif not orig_order:
                    orig_order = o

            if not orig_order:
                for co in cust_orders.get(c_code, []):
                    if co.get("salespersonCode") and not co.get("isRenewal"):
                        orig_order = co
                        break

            for ro in renewals:
                res = engine.calculate_renewal_commission(
                    subscription=s,
                    qualifying_renewal_order=ro,
                    original_order=orig_order,
                    upgrade_orders=upgrades,
                    previous_subscription=prev_sub,
                    coupon_redemptions=coupon_redemptions
                )
                if res.get("qualified") and res.get("status") == "earned":
                    e_date = parse_datetime(res.get("earned_date"))
                    if utc_start and e_date and e_date < utc_start:
                        break
                    if utc_end and e_date and e_date > utc_end:
                        break

                    if rep_code:
                        matches_rep = any(it.get("salesperson_code") == rep_code for it in res.get("items", []))
                        if not matches_rep and res.get("original_salesperson") != rep_code:
                            break

                    total_awarded += 1
                    total_comm_sar += res["commission_amount"]
                    audit_records.append(res)

                    for item in res.get("items", []):
                        r_code = item["salesperson_code"]
                        comm_val = item["commission_amount"]
                        r_dict = rep_commissions[r_code]
                        r_dict["total_commission"] += comm_val
                        r_dict["qualifying_renewals_count"] += 1
                        comp = item.get("component", "")
                        if "Upgrade" in comp:
                            r_dict["upgrade_commission"] += comm_val
                        elif "Interior" in comp:
                            r_dict["interior_commission"] += comm_val
                        else:
                            r_dict["package_base_commission"] += comm_val

                        if res.get("is_winback"):
                            r_dict["winback_commission"] += comm_val
                    break

    for r_dict in rep_commissions.values():
        r_dict["total_commission"] = round(r_dict["total_commission"], 2)
        r_dict["package_base_commission"] = round(r_dict["package_base_commission"], 2)
        r_dict["upgrade_commission"] = round(r_dict["upgrade_commission"], 2)
        r_dict["interior_commission"] = round(r_dict["interior_commission"], 2)
        r_dict["winback_commission"] = round(r_dict["winback_commission"], 2)

    return {
        "total_commissions": round(total_comm_sar, 2),
        "total_qualifying_renewals": total_awarded,
        "rep_commissions": dict(rep_commissions),
        "audit_records": audit_records
    }


def calculate_portfolio_commissions(
    db,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    rep_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    Computes subscription renewal commissions across MongoDB database.
    """
    if db is None:
        return {
            "total_commissions": 0.0,
            "total_qualifying_renewals": 0,
            "rep_commissions": {},
            "audit_records": []
        }

    employees = list(db.rushwash_employees.find())
    sessions = list(db.rushwash_pos_sessions.find({}, {
        "readableCode": 1, "employeeReadableCode": 1, "employeeId": 1, "platformUserId": 1
    }))
    orders = list(db.rushwash_sale_orders.find({}, {
        "readableCode": 1, "customerId": 1, "customerSnapshot": 1,
        "subscriptionReadableCode": 1, "subscriptionTransitionKind": 1,
        "isRenewal": 1, "notes": 1, "posSessionReadableCode": 1,
        "createdAt": 1, "completedAt": 1, "postDiscountTotal": 1,
        "preDiscountSubtotal": 1, "lines": 1, "payments": 1, "status": 1
    }))
    subs = list(db.rushwash_subscriptions.find({}, {
        "readableCode": 1, "customerId": 1, "customerSnapshot": 1,
        "packageReadableCode": 1, "packageNameEn": 1, "parentSubCode": 1,
        "price": 1, "status": 1, "createdAt": 1, "renewalDate": 1,
        "cancelledAt": 1, "cancelEffective": 1, "terminatedAt": 1
    }))

    return calculate_commissions_from_data(
        subs=subs,
        orders=orders,
        employees=employees,
        sessions=sessions,
        start_date=start_date,
        end_date=end_date,
        rep_code=rep_code
    )

