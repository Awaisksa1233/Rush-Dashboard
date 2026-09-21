"""
tests/test_commission_engine.py - Comprehensive automated tests for RUSH Subscription Commission Engine.

Explicitly validates all 25 edge cases specified in Section 15 of requirements:
1. Fresh -> full-price renewal -> 2 SAR
2. Shiny -> full-price renewal -> 6 SAR
3. Nano -> full-price renewal -> 10 SAR
4. Nano + Interior -> full-price renewal -> 20 SAR
5. Interior only -> full-price renewal -> 10 SAR
6. First renewal fails -> no commission
7. Renewal succeeds during retry window -> commission awarded
8. Multiple successful webhook/retry events -> commission awarded only once
9. First renewal discounted -> no commission
10. Later full-price renewal -> commission awarded
11. Winback promo -> no commission
12. Fresh -> Shiny -> A gets 2, B gets 4
13. Fresh -> Nano -> A gets 2, B gets 8
14. Shiny -> Nano -> A gets 6, B gets 4
15. A sells Nano, B adds Interior -> A 10, B 10
16. A sells Nano + Interior -> A 20
17. Interior added then removed before qualifying renewal -> no Interior commission
18. Customer inactive for less than 60 days -> not a winback
19. Customer inactive exactly 60 days -> qualifies as winback
20. Customer inactive more than 60 days -> qualifies as winback
21. Winback Fresh -> 1 SAR
22. Winback Nano -> 5 SAR
23. Winback Nano + Interior -> 10 SAR
24. Winback Fresh -> Nano upgrade -> original salesperson 1 SAR, upgrade salesperson 4 SAR
25. Original salesperson inactive/removed before renewal -> original salesperson still receives commission.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import unittest
from datetime import datetime, timezone, timedelta
from commission_engine import (
    CommissionEngine,
    evaluate_winback_status,
    is_order_full_price,
    is_winback_promo
)


class TestRushCommissionEngine(unittest.TestCase):
    def setUp(self):
        self.engine = CommissionEngine()

    # --- Scenario 1: Fresh -> full-price renewal -> 2 SAR ---
    def test_01_new_customer_fresh_full_price(self):
        sub = {"readableCode": "SUB-001", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00001"}]}
        renew = {"readableCode": "ORD-002", "status": "paid", "postDiscountTotal": 149, "preDiscountSubtotal": 149, "lines": [{"catalogCode": "SPK-00001"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 2.0)
        self.assertEqual(len(res["items"]), 1)
        self.assertEqual(res["items"][0]["salesperson_code"], "EMP-A")
        self.assertEqual(res["items"][0]["commission_amount"], 2.0)

    # --- Scenario 2: Shiny -> full-price renewal -> 6 SAR ---
    def test_02_new_customer_shiny_full_price(self):
        sub = {"readableCode": "SUB-002", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00002"}]}
        renew = {"readableCode": "ORD-002", "status": "paid", "postDiscountTotal": 199, "preDiscountSubtotal": 199, "lines": [{"catalogCode": "SPK-00002"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 6.0)
        self.assertEqual(res["items"][0]["commission_amount"], 6.0)

    # --- Scenario 3: Nano -> full-price renewal -> 10 SAR ---
    def test_03_new_customer_nano_full_price(self):
        sub = {"readableCode": "SUB-003", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00003"}]}
        renew = {"readableCode": "ORD-002", "status": "paid", "postDiscountTotal": 249, "preDiscountSubtotal": 249, "lines": [{"catalogCode": "SPK-00003"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 10.0)

    # --- Scenario 4: Nano + Interior -> full-price renewal -> 20 SAR ---
    def test_04_new_customer_nano_plus_interior_full_price(self):
        sub = {"readableCode": "SUB-004", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00005"}]}
        renew = {"readableCode": "ORD-002", "status": "paid", "postDiscountTotal": 398, "preDiscountSubtotal": 398, "lines": [{"catalogCode": "SPK-00005"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 20.0)
        # Check both components attributed to EMP-A
        self.assertEqual(sum(it["commission_amount"] for it in res["items"]), 20.0)

    # --- Scenario 5: Interior only -> full-price renewal -> 10 SAR ---
    def test_05_new_customer_interior_only_full_price(self):
        sub = {"readableCode": "SUB-005", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00004"}]}
        renew = {"readableCode": "ORD-002", "status": "paid", "postDiscountTotal": 149, "preDiscountSubtotal": 149, "lines": [{"catalogCode": "SPK-00004"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 10.0)
        self.assertEqual(res["items"][0]["component"], "Interior Cleaning")

    # --- Scenario 6: First renewal fails -> no commission ---
    def test_06_first_renewal_fails_no_commission(self):
        sub = {"readableCode": "SUB-006", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00003"}]}
        failed_renew = {
            "readableCode": "ORD-002",
            "status": "abandoned",
            "payments": [{"status": "failed", "attemptNumber": 1}]
        }

        res = self.engine.calculate_renewal_commission(sub, failed_renew, original_order=orig)
        self.assertFalse(res["qualified"])
        self.assertEqual(res["commission_amount"], 0.0)
        self.assertEqual(res["status"], "payment_unsuccessful")

    # --- Scenario 7: Renewal succeeds during retry window -> commission awarded ---
    def test_07_renewal_succeeds_during_retry_window(self):
        sub = {"readableCode": "SUB-007", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00003"}]}
        retry_renew = {
            "readableCode": "ORD-002",
            "status": "paid",
            "postDiscountTotal": 249,
            "preDiscountSubtotal": 249,
            "lines": [{"catalogCode": "SPK-00003"}],
            "payments": [
                {"status": "failed", "attemptNumber": 1},
                {"status": "failed", "attemptNumber": 2},
                {"status": "paid", "attemptNumber": 3, "amount": 249}
            ]
        }

        res = self.engine.calculate_renewal_commission(sub, retry_renew, original_order=orig)
        self.assertTrue(res["qualified"])
        self.assertTrue(res["is_retry"])
        self.assertEqual(res["commission_amount"], 10.0)

    # --- Scenario 8: Multiple successful webhook/retry events -> commission awarded only once ---
    def test_08_multiple_webhook_retry_events_awarded_only_once(self):
        sub = {"readableCode": "SUB-008", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00003"}]}
        renew = {"readableCode": "ORD-002", "status": "paid", "postDiscountTotal": 249, "preDiscountSubtotal": 249, "lines": [{"catalogCode": "SPK-00003"}]}

        res1 = self.engine.calculate_renewal_commission(sub, renew, original_order=orig)
        self.assertTrue(res1["qualified"])
        self.assertEqual(res1["commission_amount"], 10.0)

        # Duplicate webhook / subsequent event for the same subscription
        res2 = self.engine.calculate_renewal_commission(sub, renew, original_order=orig)
        self.assertFalse(res2["qualified"])
        self.assertEqual(res2["status"], "already_awarded")
        self.assertEqual(res2["commission_amount"], 0.0)

    # --- Scenario 9: First renewal discounted -> no commission ---
    def test_09_first_renewal_discounted_no_commission(self):
        sub = {"readableCode": "SUB-009", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00003"}]}
        discounted_renew = {
            "readableCode": "ORD-002",
            "status": "paid",
            "postDiscountTotal": 199,  # Discounted from 249
            "preDiscountSubtotal": 249,
            "lines": [{"catalogCode": "SPK-00003"}]
        }

        res = self.engine.calculate_renewal_commission(sub, discounted_renew, original_order=orig)
        self.assertFalse(res["qualified"])
        self.assertEqual(res["status"], "discounted_renewal")
        self.assertEqual(res["commission_amount"], 0.0)

    # --- Scenario 10: Later full-price renewal -> commission awarded ---
    def test_10_later_full_price_renewal_after_discounted(self):
        sub = {"readableCode": "SUB-010", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00003"}]}

        # Month 1: discounted renewal
        renew_month1 = {"readableCode": "ORD-002", "status": "paid", "postDiscountTotal": 199, "preDiscountSubtotal": 249, "lines": [{"catalogCode": "SPK-00003"}]}
        res1 = self.engine.calculate_renewal_commission(sub, renew_month1, original_order=orig)
        self.assertFalse(res1["qualified"])

        # Month 2: full-price renewal
        renew_month2 = {"readableCode": "ORD-003", "status": "paid", "postDiscountTotal": 249, "preDiscountSubtotal": 249, "lines": [{"catalogCode": "SPK-00003"}]}
        res2 = self.engine.calculate_renewal_commission(sub, renew_month2, original_order=orig)
        self.assertTrue(res2["qualified"])
        self.assertEqual(res2["commission_amount"], 10.0)

    # --- Scenario 11: Winback promo -> no commission ---
    def test_11_winback_promo_no_commission(self):
        sub = {"readableCode": "SUB-011", "salespersonCode": "EMP-A"}
        orig = {
            "readableCode": "ORD-001",
            "salespersonCode": "EMP-A",
            "couponCode": "RUSHBACK25",
            "lines": [{"catalogCode": "SPK-00003"}]
        }
        renew = {"readableCode": "ORD-002", "status": "paid", "postDiscountTotal": 249, "preDiscountSubtotal": 249, "lines": [{"catalogCode": "SPK-00003"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig)
        self.assertTrue(res["qualified"])  # evaluated lifecycle
        self.assertEqual(res["status"], "winback_promo_excluded")
        self.assertEqual(res["commission_amount"], 0.0)

    # --- Scenario 12: Fresh -> Shiny -> A gets 2, B gets 4 ---
    def test_12_upgrade_fresh_to_shiny(self):
        sub = {"readableCode": "SUB-012", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00001"}]}
        upgrades = [{"readableCode": "ORD-002", "salespersonCode": "EMP-B", "subscriptionTransitionKind": "upgrade", "lines": [{"catalogCode": "SPK-00002"}]}]
        renew = {"readableCode": "ORD-003", "status": "paid", "postDiscountTotal": 199, "preDiscountSubtotal": 199, "lines": [{"catalogCode": "SPK-00002"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig, upgrade_orders=upgrades)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 6.0)
        rep_comm = {it["salesperson_code"]: it["commission_amount"] for it in res["items"]}
        self.assertEqual(rep_comm["EMP-A"], 2.0)
        self.assertEqual(rep_comm["EMP-B"], 4.0)

    # --- Scenario 13: Fresh -> Nano -> A gets 2, B gets 8 ---
    def test_13_upgrade_fresh_to_nano(self):
        sub = {"readableCode": "SUB-013", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00001"}]}
        upgrades = [{"readableCode": "ORD-002", "salespersonCode": "EMP-B", "subscriptionTransitionKind": "upgrade", "lines": [{"catalogCode": "SPK-00003"}]}]
        renew = {"readableCode": "ORD-003", "status": "paid", "postDiscountTotal": 249, "preDiscountSubtotal": 249, "lines": [{"catalogCode": "SPK-00003"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig, upgrade_orders=upgrades)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 10.0)
        rep_comm = {it["salesperson_code"]: it["commission_amount"] for it in res["items"]}
        self.assertEqual(rep_comm["EMP-A"], 2.0)
        self.assertEqual(rep_comm["EMP-B"], 8.0)

    # --- Scenario 14: Shiny -> Nano -> A gets 6, B gets 4 ---
    def test_14_upgrade_shiny_to_nano(self):
        sub = {"readableCode": "SUB-014", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00002"}]}
        upgrades = [{"readableCode": "ORD-002", "salespersonCode": "EMP-B", "subscriptionTransitionKind": "upgrade", "lines": [{"catalogCode": "SPK-00003"}]}]
        renew = {"readableCode": "ORD-003", "status": "paid", "postDiscountTotal": 249, "preDiscountSubtotal": 249, "lines": [{"catalogCode": "SPK-00003"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig, upgrade_orders=upgrades)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 10.0)
        rep_comm = {it["salesperson_code"]: it["commission_amount"] for it in res["items"]}
        self.assertEqual(rep_comm["EMP-A"], 6.0)
        self.assertEqual(rep_comm["EMP-B"], 4.0)

    # --- Scenario 15: A sells Nano, B adds Interior -> A 10, B 10 ---
    def test_15_nano_sold_by_A_interior_added_by_B(self):
        sub = {"readableCode": "SUB-015", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00003"}]}
        upgrades = [{"readableCode": "ORD-002", "salespersonCode": "EMP-B", "subscriptionTransitionKind": "add_interior", "lines": [{"catalogCode": "SPK-00004"}]}]
        renew = {"readableCode": "ORD-003", "status": "paid", "postDiscountTotal": 398, "preDiscountSubtotal": 398, "lines": [{"catalogCode": "SPK-00005"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig, upgrade_orders=upgrades)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 20.0)
        rep_comm = {it["salesperson_code"]: it["commission_amount"] for it in res["items"]}
        self.assertEqual(rep_comm["EMP-A"], 10.0)
        self.assertEqual(rep_comm["EMP-B"], 10.0)

    # --- Scenario 16: A sells Nano + Interior -> A 20 ---
    def test_16_A_sells_nano_plus_interior(self):
        sub = {"readableCode": "SUB-016", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00005"}]}
        renew = {"readableCode": "ORD-002", "status": "paid", "postDiscountTotal": 398, "preDiscountSubtotal": 398, "lines": [{"catalogCode": "SPK-00005"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 20.0)
        rep_comm = {}
        for it in res["items"]:
            rep_comm[it["salesperson_code"]] = rep_comm.get(it["salesperson_code"], 0.0) + it["commission_amount"]
        self.assertEqual(rep_comm["EMP-A"], 20.0)

    # --- Scenario 17: Interior added then removed before qualifying renewal -> no Interior commission ---
    def test_17_interior_added_then_removed_before_renewal(self):
        sub = {"readableCode": "SUB-017", "salespersonCode": "EMP-A"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-A", "lines": [{"catalogCode": "SPK-00001"}]}
        upgrades = [
            {"readableCode": "ORD-002", "salespersonCode": "EMP-B", "subscriptionTransitionKind": "upgrade", "lines": [{"catalogCode": "SPK-00003"}]},
            {"readableCode": "ORD-003", "salespersonCode": "EMP-C", "subscriptionTransitionKind": "add_interior", "lines": [{"catalogCode": "SPK-00004"}]}
        ]
        # At renewal, Interior was removed; only Nano renewed
        renew = {"readableCode": "ORD-004", "status": "paid", "postDiscountTotal": 249, "preDiscountSubtotal": 249, "lines": [{"catalogCode": "SPK-00003"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig, upgrade_orders=upgrades)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 10.0)
        rep_comm = {it["salesperson_code"]: it["commission_amount"] for it in res["items"]}
        self.assertEqual(rep_comm["EMP-A"], 2.0)
        self.assertEqual(rep_comm["EMP-B"], 8.0)
        self.assertNotIn("EMP-C", rep_comm)

    # --- Scenario 18: Customer inactive for less than 60 days -> not a winback ---
    def test_18_inactive_less_than_60_days_not_winback(self):
        t_ended = datetime(2026, 1, 1, tzinfo=timezone.utc)
        t_started = t_ended + timedelta(days=59)
        is_wb, days = evaluate_winback_status(t_started, t_ended)
        self.assertFalse(is_wb)
        self.assertEqual(days, 59)

    # --- Scenario 19: Customer inactive exactly 60 days -> qualifies as winback ---
    def test_19_inactive_exactly_60_days_qualifies_winback(self):
        t_ended = datetime(2026, 1, 1, tzinfo=timezone.utc)
        t_started = t_ended + timedelta(days=60)
        is_wb, days = evaluate_winback_status(t_started, t_ended)
        self.assertTrue(is_wb)
        self.assertEqual(days, 60)

    # --- Scenario 20: Customer inactive more than 60 days -> qualifies as winback ---
    def test_20_inactive_more_than_60_days_qualifies_winback(self):
        t_ended = datetime(2026, 1, 1, tzinfo=timezone.utc)
        t_started = t_ended + timedelta(days=90)
        is_wb, days = evaluate_winback_status(t_started, t_ended)
        self.assertTrue(is_wb)
        self.assertEqual(days, 90)

    # --- Scenario 21: Winback Fresh -> 1 SAR ---
    def test_21_winback_fresh(self):
        sub = {"readableCode": "SUB-021", "salespersonCode": "EMP-B", "isWinback": True}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-B", "lines": [{"catalogCode": "SPK-00001"}]}
        renew = {"readableCode": "ORD-002", "status": "paid", "postDiscountTotal": 149, "preDiscountSubtotal": 149, "lines": [{"catalogCode": "SPK-00001"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig)
        self.assertTrue(res["qualified"])
        self.assertTrue(res["is_winback"])
        self.assertEqual(res["commission_amount"], 1.0)
        self.assertEqual(res["items"][0]["commission_amount"], 1.0)

    # --- Scenario 22: Winback Nano -> 5 SAR ---
    def test_22_winback_nano(self):
        sub = {"readableCode": "SUB-022", "salespersonCode": "EMP-B", "isWinback": True}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-B", "lines": [{"catalogCode": "SPK-00003"}]}
        renew = {"readableCode": "ORD-002", "status": "paid", "postDiscountTotal": 249, "preDiscountSubtotal": 249, "lines": [{"catalogCode": "SPK-00003"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 5.0)

    # --- Scenario 23: Winback Nano + Interior -> 10 SAR ---
    def test_23_winback_nano_plus_interior(self):
        sub = {"readableCode": "SUB-023", "salespersonCode": "EMP-B", "isWinback": True}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-B", "lines": [{"catalogCode": "SPK-00005"}]}
        renew = {"readableCode": "ORD-002", "status": "paid", "postDiscountTotal": 398, "preDiscountSubtotal": 398, "lines": [{"catalogCode": "SPK-00005"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 10.0)

    # --- Scenario 24: Winback Fresh -> Nano upgrade -> original salesperson 1 SAR, upgrade salesperson 4 SAR ---
    def test_24_winback_fresh_to_nano_upgrade(self):
        sub = {"readableCode": "SUB-024", "salespersonCode": "EMP-B", "isWinback": True}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-B", "lines": [{"catalogCode": "SPK-00001"}]}
        upgrades = [{"readableCode": "ORD-002", "salespersonCode": "EMP-UPGRADE", "subscriptionTransitionKind": "upgrade", "lines": [{"catalogCode": "SPK-00003"}]}]
        renew = {"readableCode": "ORD-003", "status": "paid", "postDiscountTotal": 249, "preDiscountSubtotal": 249, "lines": [{"catalogCode": "SPK-00003"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig, upgrade_orders=upgrades)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 5.0)
        rep_comm = {it["salesperson_code"]: it["commission_amount"] for it in res["items"]}
        self.assertEqual(rep_comm["EMP-B"], 1.0)
        self.assertEqual(rep_comm["EMP-UPGRADE"], 4.0)

    # --- Scenario 25: Original salesperson inactive/removed before renewal -> original salesperson still receives commission ---
    def test_25_original_salesperson_inactive_retains_commission(self):
        # Original salesperson left the company before the qualifying renewal
        sub = {"readableCode": "SUB-025", "salespersonCode": "EMP-FORMER", "employeeStatus": "terminated"}
        orig = {"readableCode": "ORD-001", "salespersonCode": "EMP-FORMER", "lines": [{"catalogCode": "SPK-00001"}]}
        renew = {"readableCode": "ORD-002", "status": "paid", "postDiscountTotal": 149, "preDiscountSubtotal": 149, "lines": [{"catalogCode": "SPK-00001"}]}

        res = self.engine.calculate_renewal_commission(sub, renew, original_order=orig)
        self.assertTrue(res["qualified"])
        self.assertEqual(res["commission_amount"], 2.0)
        self.assertEqual(res["items"][0]["salesperson_code"], "EMP-FORMER")
        self.assertEqual(res["original_salesperson"], "EMP-FORMER")


if __name__ == "__main__":
    unittest.main()
