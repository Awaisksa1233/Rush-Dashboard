"""
scripts/export_commission_raw_data.py - CLI utility to export raw commission audit records to CSV or JSON.

Usage:
    python scripts/export_commission_raw_data.py [--output commissions_raw.csv] [--format csv|json] [--date-filter "All Time"]
"""

import os
import sys
import argparse
import csv
import json

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from db_manager import MongoManager


def export_raw_data(output_path="rushwash_commission_audit_raw_data.csv", file_format="csv", date_filter="All Time", rep_code=None):
    print(f"Connecting to database and calculating raw commission records (Filter: {date_filter})...")
    db = MongoManager()
    if not db.is_connected or db.db is None:
        print("Error: Could not connect to database.")
        sys.exit(1)

    records = db.get_commission_audit_records(date_filter=date_filter, rep_code=rep_code)
    print(f"Retrieved {len(records)} qualifying renewal commission records.")

    if file_format.lower() == "json":
        if not output_path.endswith(".json"):
            output_path = os.path.splitext(output_path)[0] + ".json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2, default=str)
        print(f"Successfully exported JSON raw data to: {os.path.abspath(output_path)}")
        return

    # Default CSV
    if not output_path.endswith(".csv"):
        output_path = os.path.splitext(output_path)[0] + ".csv"

    with open(output_path, mode="w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "Subscription",
            "Customer Code",
            "Customer Name",
            "Qualifying Renewal Order",
            "Payment Provider ID",
            "Package Tier",
            "Interior Cleaning Included",
            "Package Service Display",
            "Total Commission (SAR)",
            "Original Salesperson Code",
            "Original Salesperson Name",
            "Upgrade Salesperson Code",
            "Addon Salesperson Code",
            "Is Winback",
            "Winback Eligibility",
            "Days Inactive",
            "Promotion Status",
            "Full Price Qualified",
            "Commission Status",
            "Earned Date",
            "Breakdown Items"
        ])
        for r in records:
            items_summary = "; ".join([
                f"{it.get('component')}: {it.get('salesperson_name')} ({it.get('salesperson_code')}) = {it.get('commission_amount')} SAR"
                for it in r.get("items", [])
            ])
            writer.writerow([
                r.get("subscription"),
                r.get("customer"),
                r.get("customer_name"),
                r.get("qualifying_renewal_order"),
                r.get("qualifying_payment_id"),
                r.get("package_tier"),
                "Yes" if r.get("has_interior") else "No",
                r.get("package_service_display"),
                r.get("commission_amount"),
                r.get("original_salesperson"),
                r.get("original_salesperson_name"),
                r.get("upgrade_salesperson") or "",
                r.get("addon_salesperson") or "",
                "Yes" if r.get("is_winback") else "No",
                r.get("winback_eligibility"),
                r.get("days_inactive") if r.get("days_inactive") is not None else "",
                r.get("promotion_status"),
                "Yes" if r.get("is_full_price") else "No",
                r.get("commission_status"),
                str(r.get("earned_date", ""))[:19],
                items_summary
            ])

    print(f"Successfully exported CSV raw data ({len(records)} rows) to: {os.path.abspath(output_path)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export RUSH Raw Commission Data")
    parser.add_argument("--output", "-o", default="rushwash_commission_audit_raw_data.csv", help="Output file path")
    parser.add_argument("--format", "-f", default="csv", choices=["csv", "json"], help="Output format (csv or json)")
    parser.add_argument("--date-filter", "-d", default="All Time", help="Date filter (e.g. 'All Time', 'This Month', 'Last 30 Days')")
    parser.add_argument("--rep", "-r", default=None, help="Filter to specific salesperson code")

    args = parser.parse_args()
    export_raw_data(
        output_path=args.output,
        file_format=args.format,
        date_filter=args.date_filter,
        rep_code=args.rep
    )
