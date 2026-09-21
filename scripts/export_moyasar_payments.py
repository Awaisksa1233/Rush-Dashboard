import os
import sys
import json
import csv
from datetime import datetime, timezone, timedelta
from collections import Counter

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

workspace_dir = r"c:\Users\Rush\Documents\antigravity\gallant-volta"
backup_file = os.path.join(
    workspace_dir, 'database', 'atlas_backup', 'latest', 'rushwash', 'rushwash_sale_orders.jsonl'
)
output_csv = os.path.join(
    workspace_dir, 'moyasar_payment_attempts_aug23_sep08.csv'
)

tz_riyadh = timezone(timedelta(hours=3))

def parse_date(obj):
    if isinstance(obj, dict):
        obj = obj.get("$date")
    if not obj:
        return None
    try:
        s = str(obj).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None

# Filter window: 2026-08-23 00:00:00 to 2026-09-08 23:59:59
start_dt = datetime(2026, 8, 23, 0, 0, 0, tzinfo=timezone.utc)
end_dt = datetime(2026, 9, 8, 23, 59, 59, tzinfo=timezone.utc)

records = []
status_counter = Counter()
failure_counter = Counter()
method_counter = Counter()

with open(backup_file, 'r', encoding='utf-8') as f:
    for line in f:
        data = json.loads(line)
        order_id = data.get("readableCode") or ""
        order_status = data.get("status") or ""
        
        cus_snap = data.get("customerSnapshot") or {}
        cus_id = cus_snap.get("readableCode") or (data.get("customerId") or {}).get("$oid") or ""
        cus_name = cus_snap.get("name") or ""
        cus_phone = cus_snap.get("phone") or ""
        
        veh_snap = data.get("vehicleSnapshot") or {}
        plate = data.get("normalizedPlate") or veh_snap.get("displayPlate") or veh_snap.get("normalizedPlate") or "N/A"
        
        payments = data.get("payments", [])
        for p in payments:
            prov = p.get("provider")
            method_key = str(p.get("paymentMethodIdentityKey", ""))
            method_code = str(p.get("paymentMethodCode", ""))
            is_moyasar = (prov == "moyasar" or "moyasar" in method_key.lower() or "moyasar" in method_code.lower())
            if not is_moyasar:
                continue
            
            dt = parse_date(p.get("occurredAt")) or parse_date(data.get("createdAt"))
            if not dt or not (start_dt <= dt <= end_dt):
                continue
            
            st = p.get("status") or "unknown"
            reason = p.get("failureReason") or ""
            
            if st == "failed" and reason:
                result_display = f"failed: {reason}"
            elif st == "failed":
                result_display = "failed"
            else:
                result_display = st
                
            status_counter[st] += 1
            if reason:
                failure_counter[reason] += 1
            
            method = p.get("paymentMethodNameEn") or method_code or "Moyasar"
            method_counter[method] += 1
            
            records.append({
                "license_plate": plate,
                "order_id": order_id,
                "cus_id": cus_id,
                "result": result_display,
                "payment_status": st,
                "failure_reason": reason,
                "customer_name": cus_name,
                "customer_phone": cus_phone,
                "amount_sar": f"{p.get('amount', 0):.2f}" if p.get('amount') is not None else "0.00",
                "attempt_number": p.get("attemptNumber", 1),
                "payment_method": method,
                "moyasar_payment_id": p.get("providerPaymentId") or "",
                "time_riyadh": dt.astimezone(tz_riyadh).strftime("%Y-%m-%d %H:%M:%S"),
                "time_utc": dt.strftime("%Y-%m-%d %H:%M:%S"),
                "order_status": order_status,
                "_sort_key": dt
            })

# Sort newest to oldest
records.sort(key=lambda x: x["_sort_key"], reverse=True)

# Write to CSV
fieldnames = [
    "License Plate",
    "Order ID",
    "Customer ID",
    "Result",
    "Customer Name",
    "Customer Phone",
    "Amount (SAR)",
    "Attempt #",
    "Payment Method",
    "Moyasar Payment ID",
    "Time (Riyadh UTC+3)",
    "Time (UTC)",
    "Payment Status",
    "Failure Reason",
    "Order Status"
]

with open(output_csv, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(fieldnames)
    for r in records:
        writer.writerow([
            r["license_plate"],
            r["order_id"],
            r["cus_id"],
            r["result"],
            r["customer_name"],
            r["customer_phone"],
            r["amount_sar"],
            r["attempt_number"],
            r["payment_method"],
            r["moyasar_payment_id"],
            r["time_riyadh"],
            r["time_utc"],
            r["payment_status"],
            r["failure_reason"],
            r["order_status"]
        ])

print(f"Successfully exported {len(records)} Moyasar payment attempts to:")
print(f"  {output_csv}")
print(f"\nBreakdown by Result / Payment Status:")
for st, cnt in status_counter.most_common():
    pct = (cnt / len(records) * 100) if records else 0
    print(f"  - {st.upper():<10}: {cnt:>5} ({pct:>5.1f}%)")

print(f"\nTop Failure Reasons (for failed attempts):")
for rsn, cnt in failure_counter.most_common(10):
    print(f"  - {rsn:<35}: {cnt:>4}")

print(f"\nPayment Methods Used:")
for m, cnt in method_counter.most_common():
    print(f"  - {m:<25}: {cnt:>5}")
