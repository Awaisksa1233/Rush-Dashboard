import sys
from pymongo import MongoClient
from bson import ObjectId

sys.stdout.reconfigure(encoding='utf-8')
client = MongoClient('mongodb://127.0.0.1:27017/rushwash')
db = client['rushwash']

cust_id = ObjectId('6a9436cf560b89eab2aa80f0')
cust = db['rushwash_customers'].find_one({'_id': cust_id})

print('=== CUSTOMER DETAILS ===')
print('Code:', cust.get('readableCode'))
print('Name:', cust.get('name'))
print('Phone:', cust.get('phone'))

print('\n=== CHECKING SIMILAR PHONE ACCOUNTS ===')
for c in db['rushwash_customers'].find({'phone': {'': '534142613'}}):
    print('Account:', c.get('readableCode'), c.get('name'), c.get('phone'))

print('\n=== ALL ORDERS FOR THIS CUSTOMER ===')
orders = list(db['rushwash_sale_orders'].find({'customerId': cust_id}).sort('createdAt', 1))
for o in orders:
    line_strs = []
    for l in o.get('lines', []):
        line_strs.append(str(l.get('catalogCode')) + ': ' + str(l.get('displayNameEn')) + ' (' + str(l.get('price')) + ' SAR)')
    pay_strs = []
    for p in o.get('payments', []):
        pay_strs.append(str(p.get('provider')) + ': ' + str(p.get('amount')) + ' SAR (' + str(p.get('status')) + ')')
    print(str(o.get('readableCode')) + ' | Status: ' + str(o.get('status')) + ' | Date: ' + str(o.get('createdAt')) + ' | Total: ' + str(o.get('postDiscountTotal')) + ' SAR')
    print('   Lines: ' + str(line_strs))
    print('   Payments: ' + str(pay_strs))

print('\n=== WALLET TRANSACTIONS ===')
w_txs = list(db['rushwash_wallet_transactions'].find({'customerId': cust_id}))
print('Total wallet transactions: ' + str(len(w_txs)))
for w in w_txs:
    print('  ', w)

print('\n=== GIFT CARD COLLECTIONS ===')
for col in db.list_collection_names():
    if 'gift' in col.lower():
        print('Collection: ' + col)
        matches = list(db[col].find({'customerId': cust_id}))
        print('  Matches for customer: ' + str(len(matches)))
