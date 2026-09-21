import os
import sys
import json
from datetime import datetime, timezone

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

backup_dir = os.path.join(os.path.dirname(__file__), '..', 'database', 'atlas_backup', 'latest', 'rushwash')

def load_collection(name):
    for ext in ['.json', '.jsonl']:
        fpath = os.path.join(backup_dir, f"{name}{ext}")
        if os.path.exists(fpath):
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read().strip()
                try:
                    return json.loads(content)
                except Exception:
                    docs = []
                    for line in content.split('\n'):
                        line = line.strip()
                        if line:
                            try:
                                docs.append(json.loads(line))
                            except Exception:
                                pass
                    return docs
    return []

def parse_dt(val):
    if not val:
        return None
    if isinstance(val, dict):
        val = val.get('$date')
    if not val:
        return None
    try:
        if isinstance(val, (int, float)):
            return datetime.fromtimestamp(val / 1000.0, tz=timezone.utc)
        s = str(val).replace('Z', '+00:00')
        return datetime.fromisoformat(s)
    except Exception:
        return None

orders = load_collection('rushwash_sale_orders')
subs = load_collection('rushwash_subscriptions')

test_plates = [
    '1603DER', '3565EED', '6349GLD', '7839SDS', '2602SVR', '353ANH', '2656DED',
    '8393ABR', '1561LER', '2465JKR', '8572BRD', '8202EKB', '4976XNR', '4878AKR',
    '7682TTR', '7403GBD', '4381EEJ', '6656RDB', '5279KJR', '10ZDL', '8416DED',
    '5751JHD', '4818EHR', '3240XGD', '4248RZD', '2103XXJ', '9840XKR', '5572UZD', 'C92098'
]

for plate in test_plates:
    p_subs = [s for s in subs if any(plate in (vl.get('snapshot', {}).get('normalizedPlate') or vl.get('snapshot', {}).get('displayPlate') or '') for vl in s.get('vehicleLinks', []))]
    p_orders = [o for o in orders if plate in (o.get('normalizedPlate') or '') or plate in (o.get('vehicleSnapshot', {}).get('displayPlate') or '')]
    recent_orders = [o for o in p_orders if parse_dt(o.get('createdAt')) and parse_dt(o.get('createdAt')) >= datetime(2026, 8, 22, tzinfo=timezone.utc)]
    
    print(f"\n=======================================================")
    print(f"Plate: {plate} | Total Subs in DB: {len(p_subs)} | Orders >= Aug 22: {len(recent_orders)}")
    for o in recent_orders:
        print(f"  Order: {o.get('readableCode')} | Date: {o.get('createdAt')} | Captured: {o.get('totalCaptured')} | isRenewal: {o.get('isRenewal')}")
    for s in p_subs:
        print(f"  Sub: {s.get('readableCode')} | Pkg: {s.get('packageNameEn')} | Created: {s.get('createdAt')} | Status: {s.get('status')} | Terminated: {s.get('terminatedAt')} ({s.get('terminatedReason')})")

