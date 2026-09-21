import os
import sys
import csv
import dns.resolver
from dotenv import load_dotenv
from pymongo import MongoClient
from collections import Counter
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()

# Atlas SRV DNS workaround
resolver = dns.resolver.Resolver(configure=False)
resolver.nameservers = ['8.8.8.8', '1.1.1.1']
dns.resolver.default_resolver = resolver

WORKSPACE_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ALL_CSV_PATH = os.path.join(WORKSPACE_ROOT, 'all_subscriptions_expiry_over_2_months.csv')
ACTIVE_CSV_PATH = os.path.join(WORKSPACE_ROOT, 'active_subscriptions_expiry_over_2_months.csv')

def parse_dt(val):
    if not val:
        return None
    if isinstance(val, dict):
        val = val.get('$date')
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    try:
        if isinstance(val, (int, float)):
            return datetime.fromtimestamp(val / 1000.0, tz=timezone.utc)
        return datetime.fromisoformat(str(val).replace('Z', '+00:00'))
    except Exception:
        return None

def main():
    uri = os.environ.get('MONGODB_URI')
    if not uri:
        print("ERROR: MONGODB_URI not found in environment!")
        sys.exit(1)

    print("Connecting to MongoDB Atlas...")
    client = MongoClient(uri, serverSelectionTimeoutMS=10000)
    db = client['rushwash']
    subs_col = db['rushwash_subscriptions']

    total_subs = subs_col.count_documents({})
    print(f"Connected successfully. Total subscriptions in database: {total_subs}")

    projection = {
        "readableCode": 1,
        "status": 1,
        "createdAt": 1,
        "renewalDate": 1,
        "packageNameEn": 1,
        "packageNameAr": 1,
        "packageReadableCode": 1,
        "price": 1,
        "autoRenew": 1,
        "dataSource": 1,
        "vehicleLinks": 1,
        "customerSnapshot": 1,
        "lastRenewalFailureReason": 1,
        "retryCount": 1,
        "visitsLimit": 1
    }

    cursor = subs_col.find(
        {"createdAt": {"$ne": None}, "renewalDate": {"$ne": None}},
        projection
    )

    all_matched = []
    active_matched = []

    status_counts = Counter()
    duration_buckets = Counter()
    package_counts = Counter()

    for s in cursor:
        c_at = parse_dt(s.get('createdAt'))
        r_at = parse_dt(s.get('renewalDate'))
        if not c_at or not r_at:
            continue

        # Calendar check: expiry > start date + 2 calendar months
        two_months_mark = c_at + relativedelta(months=2)
        diff_days = (r_at - c_at).days

        if r_at > two_months_mark:
            months_approx = round(diff_days / 30.4375, 1)

            cust_snap = s.get('customerSnapshot') or {}
            cust_code = cust_snap.get('readableCode', '')
            cust_name = cust_snap.get('name', '')
            cust_phone = cust_snap.get('phone', '')

            vehicle_links = s.get('vehicleLinks') or []
            v_snap = vehicle_links[0].get('snapshot', {}) if vehicle_links else {}
            veh_code = v_snap.get('readableCode', '')
            plate = v_snap.get('displayPlate') or v_snap.get('normalizedPlate') or ''

            row = {
                'subscription_code': s.get('readableCode', ''),
                'status': s.get('status', ''),
                'customer_code': cust_code,
                'customer_name': cust_name,
                'customer_phone': cust_phone,
                'vehicle_code': veh_code,
                'vehicle_plate': plate,
                'package_code': s.get('packageReadableCode', ''),
                'package_name_en': s.get('packageNameEn', ''),
                'package_name_ar': s.get('packageNameAr', ''),
                'start_date': c_at.strftime('%Y-%m-%d %H:%M:%S'),
                'expiry_date': r_at.strftime('%Y-%m-%d %H:%M:%S'),
                'duration_days': diff_days,
                'duration_months_approx': months_approx,
                'price': s.get('price', 0),
                'auto_renew': s.get('autoRenew', False),
                'data_source': s.get('dataSource', ''),
                'visits_limit': s.get('visitsLimit', ''),
                'retry_count': s.get('retryCount', 0),
                'last_failure_reason': s.get('lastRenewalFailureReason', '')
            }

            all_matched.append(row)
            status_counts[row['status']] += 1
            package_counts[row['package_name_en']] += 1

            if diff_days <= 93:
                duration_buckets['~3 months (63-93 days)'] += 1
            elif diff_days <= 186:
                duration_buckets['~4-6 months (94-186 days)'] += 1
            elif diff_days <= 370:
                duration_buckets['~7-12 months (187-370 days)'] += 1
            else:
                duration_buckets['> 1 year (>370 days)'] += 1

            if row['status'] == 'active':
                active_matched.append(row)

    # Sort descending by duration
    all_matched.sort(key=lambda x: x['duration_days'], reverse=True)
    active_matched.sort(key=lambda x: x['duration_days'], reverse=True)

    fieldnames = [
        'subscription_code', 'status', 'customer_code', 'customer_name', 'customer_phone',
        'vehicle_code', 'vehicle_plate', 'package_code', 'package_name_en', 'package_name_ar',
        'start_date', 'expiry_date', 'duration_days', 'duration_months_approx',
        'price', 'auto_renew', 'data_source', 'visits_limit', 'retry_count', 'last_failure_reason'
    ]

    with open(ALL_CSV_PATH, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_matched)

    with open(ACTIVE_CSV_PATH, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(active_matched)

    print("\n" + "="*70)
    print("ANALYSIS RESULTS: SUBSCRIPTIONS WITH EXPIRY > 2 MONTHS FROM START DATE")
    print("="*70)
    print(f"Total Matches (All Statuses): {len(all_matched)}")
    print(f"Active Subscriptions:         {len(active_matched)}")
    print(f"Inactive / Expired / Other:   {len(all_matched) - len(active_matched)}")
    print("\n--- Status Breakdown ---")
    for st, count in status_counts.most_common():
        pct = (count / len(all_matched)) * 100
        print(f"  {st:<22}: {count:>5} ({pct:>5.1f}%)")

    print("\n--- Duration Breakdown ---")
    for dur, count in duration_buckets.items():
        pct = (count / len(all_matched)) * 100
        print(f"  {dur:<26}: {count:>5} ({pct:>5.1f}%)")

    print("\n--- Package Breakdown (Top 10) ---")
    for pkg, count in package_counts.most_common(10):
        pct = (count / len(all_matched)) * 100
        print(f"  {pkg:<25}: {count:>5} ({pct:>5.1f}%)")

    print("\n--- Top 10 Longest Active Subscriptions ---")
    print(f"{'Sub Code':<12} | {'Status':<8} | {'Package':<15} | {'Plate':<10} | {'Start':<10} | {'Expiry':<10} | {'Days':>5} | {'Months':>6}")
    print("-" * 90)
    for r in active_matched[:10]:
        print(f"{r['subscription_code']:<12} | {r['status']:<8} | {r['package_name_en']:<15} | {r['vehicle_plate']:<10} | {r['start_date'][:10]:<10} | {r['expiry_date'][:10]:<10} | {r['duration_days']:>5} | {r['duration_months_approx']:>6}")

    print("\n" + "="*70)
    print(f"Exported all records to:    {ALL_CSV_PATH}")
    print(f"Exported active records to: {ACTIVE_CSV_PATH}")
    print("="*70)

if __name__ == '__main__':
    main()

