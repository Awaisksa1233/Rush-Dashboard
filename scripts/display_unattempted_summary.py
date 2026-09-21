import csv
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

with open('unattempted_renewals_aug27_sep08.csv', 'r', encoding='utf-8-sig') as f:
    rows = list(csv.DictReader(f))

bill_now = [r for r in rows if r['Action Bucket'] == 'BILL_IMMEDIATELY']
print(f"=== 1. BILL IMMEDIATELY: {len(bill_now)} Active Accounts with Tokens ===")
for r in bill_now:
    print(f"{r['Plate']:<10} | {r['Renewal Date']} | {r['Subscription Code']} | SAR {r['Price (SAR)']:<4} | {r['Customer Name']:<15} | {r['Phone']:<14} | {r['Card Brand']} ...{r['Last 4']}")

premature = [r for r in rows if r['Action Bucket'] == 'RETRY_PREMATURE_EXPIRY']
print(f"\n=== 2. RETRY PREMATURE EXPIRY: {len(premature)} Expired Accounts with Tokens (Sample 10) ===")
for r in premature[:10]:
    print(f"{r['Plate']:<10} | {r['Renewal Date']} | {r['Subscription Code']} | SAR {r['Price (SAR)']:<4} | {r['Customer Name']:<15} | {r['Phone']:<14} | {r['Card Brand']} ...{r['Last 4']}")

no_token = [r for r in rows if r['Action Bucket'] == 'CAPTURE_CARD_SMS']
print(f"\n=== 3. CAPTURE CARD SMS: {len(no_token)} Accounts with No Token on File (Sample 10) ===")
for r in no_token[:10]:
    print(f"{r['Plate']:<10} | {r['Renewal Date']} | {r['Subscription Code']} | SAR {r['Price (SAR)']:<4} | {r['Customer Name']:<15} | {r['Phone']:<14} | {r['Current Status']}")
