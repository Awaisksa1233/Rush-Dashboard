import os
import sys
import json
from datetime import datetime, timezone, timedelta
import dns.resolver
import pymongo
from dotenv import load_dotenv

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

load_dotenv()
resolver = dns.resolver.Resolver()
resolver.nameservers = ['8.8.8.8', '1.1.1.1']
dns.resolver.default_resolver = resolver

client = pymongo.MongoClient(os.getenv('MONGODB_URI'), serverSelectionTimeoutMS=10000)
db = client.get_database('rushwash')

def show_campaign(catalog_code, name):
    print(f"\n==========================================")
    print(f"=== {name} ({catalog_code}) ===")
    print(f"==========================================")
    orders = list(db['rushwash_sale_orders'].find({'lines.catalogCode': catalog_code, 'status': {'$in': ['paid', 'active', 'completed']}}))
    for o in orders:
        c_snap = o.get('customerSnapshot') or {}
        dt = o.get('createdAt')
        dt_local = (dt + timedelta(hours=3)).strftime('%Y-%m-%d %H:%M:%S') if dt else 'N/A'
        channel = o.get('channel') or o.get('origin') or 'pos'
        lines = [l.get('titleEn') or l.get('titleAr') for l in o.get('lines', []) if l.get('lineKind') == 'package']
        payment = (o.get('payments') or [{}])[0].get('method', 'N/A') if o.get('payments') else 'N/A'
        print(f"Order: {o.get('readableCode')} | Customer: {c_snap.get('readableCode')} ({c_snap.get('name')}) | Phone: {c_snap.get('phone')} | Package: {lines} | Payment: {payment} | Time: {dt_local} | Channel: {channel}")

show_campaign('DSC-00078', 'WATAN96 (20 Redemptions)')
show_campaign('DSC-00079', 'WATAN223 (4 Redemptions)')
