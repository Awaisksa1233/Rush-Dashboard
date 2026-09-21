import os
import sys
from dotenv import load_dotenv
import pymongo
from bson import ObjectId

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

load_dotenv()
client = pymongo.MongoClient(os.getenv('MONGODB_URI'))
db = client['rushwash']

print("=== 1. CUSTOMER WITH CARD 3970 ===")
cust = db['rushwash_customers'].find_one({'_id': ObjectId('6a8a304326e5d7aeaaba2cdb')})
if cust:
    print(f"Customer Name: {cust.get('name')}")
    print(f"Customer Phone: {cust.get('phone')}")
    print(f"Customer Code: {cust.get('readableCode')}")
    print(f"Customer ID: {cust.get('_id')}")
    print("Moyasar Payment Instruments:")
    for inst in cust.get('moyasarPaymentInstruments', []):
        print(f"  ID: {inst.get('id')} | Brand: {inst.get('brand')} | Last4: {inst.get('lastFour') or inst.get('last4')} | Token: {inst.get('tokenId')} | Exp: {inst.get('expMonth')}/{inst.get('expYear')} | Primary: {inst.get('isPrimary')} | SavedAt: {inst.get('savedAt')}")
    if cust.get('moyasarPaymentInstrument'):
        inst = cust.get('moyasarPaymentInstrument')
        print(f"  Single Inst: {inst.get('id')} | Brand: {inst.get('brand')} | Last4: {inst.get('lastFour')} | Token: {inst.get('tokenId')}")

print("\n=== 2. ALL SUBSCRIPTIONS FOR THIS CUSTOMER ===")
subs = list(db['rushwash_subscriptions'].find({'customerId': cust['_id']}).sort('createdAt', -1))
for s in subs:
    print(f"Sub: {s.get('readableCode')} | Package: {s.get('packageNameEn')} | Status: {s.get('status')} | RenewalDate: {s.get('renewalDate')} | CreatedAt: {s.get('createdAt')}")
    for v in s.get('vehicleLinks', []):
        snap = v.get('snapshot', {})
        print(f"   Vehicle: {snap.get('readableCode')} | Plate: {snap.get('normalizedPlate')}")
    print(f"   PaymentMethodUsed: {s.get('paymentMethodUsed')}")

print("\n=== 3. ALL SALE ORDERS FOR THIS CUSTOMER ===")
orders = list(db['rushwash_sale_orders'].find({'customerId': cust['_id']}).sort('createdAt', -1))
for o in orders:
    print(f"Order: {o.get('readableCode')} | Status: {o.get('status')} | CreatedAt: {o.get('createdAt')} | Total: {o.get('postDiscountTotal')} SAR | Plate: {o.get('normalizedPlate')} | Sub: {o.get('subscriptionReadableCode')} | isRenewal: {o.get('isRenewal')}")
    lines = o.get('lines', []) or o.get('lineSnapshots', [])
    for l in lines:
        print(f"   Line: {l.get('displayNameEn')} (Qty: {l.get('quantity')}, Unit: {l.get('unitPrice')}, Total: {l.get('price')})")
    for p in o.get('payments', []):
        print(f"   Payment attempt {p.get('attemptNumber')}: Status={p.get('status')} | Amount={p.get('amount')} {p.get('currency')} | Provider={p.get('provider')} | Method={p.get('paymentMethodNameEn')} | ProviderPaymentId={p.get('providerPaymentId')} | Token={p.get('paymentToken')} | OccurredAt={p.get('occurredAt')} | Reason={p.get('failureReason')}")
    if o.get('refund'):
        print(f"   Refund: {o.get('refund')}")
    print("-" * 60)

print("\n=== 4. ANY OTHER CUSTOMERS WITH CARD 3970 ===")
other_custs = list(db['rushwash_customers'].find({
    '$or': [
        {'moyasarPaymentInstrument.lastFour': '3970'},
        {'moyasarPaymentInstruments.lastFour': '3970'},
        {'moyasarPaymentInstrument.last4': '3970'},
        {'moyasarPaymentInstruments.last4': '3970'}
    ]
}))
print(f"Total customers with 3970: {len(other_custs)}")
for c in other_custs:
    print(f"  {c.get('readableCode')} | {c.get('name')} | {c.get('phone')}")

print("\n=== 5. ANY ORDERS IN SYSTEM WITH 3970 IN PAYMENT METADATA ===")
orders_any_3970 = list(db['rushwash_sale_orders'].find({
    '$or': [
        {'payments.paymentMethodUsed.lastFour': '3970'},
        {'payments.paymentMethodUsed.last4': '3970'},
        {'payments.paymentToken': 'token_jJ8QCyhFUY1HXcK8X4d2VVoxzB'},
        {'payments.source.number': {'$regex': '3970$'}}
    ]
}))
print(f"Orders matching paymentMethodUsed 3970: {len(orders_any_3970)}")
for o in orders_any_3970:
    print(f"  {o.get('readableCode')} | Customer: {o.get('customerSnapshot', {}).get('name')} | Date: {o.get('createdAt')} | Total: {o.get('postDiscountTotal')}")
