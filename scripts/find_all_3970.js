import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('=== SEARCHING FOR "3970" ACROSS ALL COLLECTIONS ===');

    // 1. Customers with 3970
    const custs = await db.collection('rushwash_customers').find({
      $or: [
        { 'moyasarPaymentInstrument.lastFour': '3970' },
        { 'moyasarPaymentInstruments.lastFour': '3970' },
        { 'moyasarPaymentInstrument.last4': '3970' },
        { 'moyasarPaymentInstruments.last4': '3970' },
        { phone: /3970/ },
        { mobile: /3970/ }
      ]
    }).toArray();

    console.log(`\n1. Customers matching 3970 (${custs.length}):`);
    for (const c of custs) {
      console.log(`- ${c.name} | Phone: ${c.phone} | Code: ${c.readableCode} | ID: ${c._id}`);
      console.log(`  Saved cards:`, JSON.stringify(c.moyasarPaymentInstruments || c.moyasarPaymentInstrument));
    }

    // 2. Subscriptions with 3970 in paymentMethodUsed or instruments
    const subs = await db.collection('rushwash_subscriptions').find({
      $or: [
        { 'paymentMethodUsed.lastFour': '3970' },
        { 'paymentMethodUsed.last4': '3970' },
        { 'moyasarPaymentInstrument.lastFour': '3970' },
        { 'moyasarPaymentInstruments.lastFour': '3970' },
        { 'paymentMethodUsed.tokenId': /3970/ },
        { customerId: { $in: custs.map(c => c._id) } }
      ]
    }).toArray();

    console.log(`\n2. Subscriptions matching 3970 (${subs.length}):`);
    for (const s of subs) {
      console.log(`- Sub: ${s.readableCode} | Status: ${s.status} | Package: ${s.packageNameEn} | CustomerId: ${s.customerId}`);
      console.log(`  Renewal Date: ${s.renewalDate} | Updated: ${s.updatedAt} | Created: ${s.createdAt}`);
      console.log(`  Vehicle Links:`, JSON.stringify(s.vehicleLinks));
      console.log(`  Payment Method:`, JSON.stringify(s.paymentMethodUsed || s.moyasarPaymentInstrument));
    }

    // 3. Orders with 3970 anywhere
    const orders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { 'payments.paymentToken': /3970/ },
        { 'payments.paymentMethodUsed.lastFour': '3970' },
        { 'payments.paymentMethodUsed.last4': '3970' },
        { 'payments.providerPaymentId': /3970/ },
        { 'customerSnapshot.phone': /3970/ },
        { customerId: { $in: custs.map(c => c._id) } }
      ]
    }).toArray();

    console.log(`\n3. Orders matching 3970 (${orders.length}):`);
    for (const o of orders) {
      console.log(`- Order: ${o.readableCode} | Date: ${o.createdAt} | Status: ${o.status} | Total: ${o.postDiscountTotal} | Plate: ${o.normalizedPlate}`);
      console.log(`  Customer: ${(o.customerSnapshot || {}).name} (${(o.customerSnapshot || {}).phone})`);
      console.log(`  Payments:`, JSON.stringify(o.payments, null, 2));
    }

    // 4. Also check ALL orders created on Sep 3 between 03:00 and 09:00 UTC (06:00 to 12:00 KSA)
    const sep3Orders = await db.collection('rushwash_sale_orders').find({
      createdAt: {
        $gte: new Date('2026-09-03T03:00:00.000Z'),
        $lte: new Date('2026-09-03T09:00:00.000Z')
      }
    }).sort({ createdAt: 1 }).toArray();

    console.log(`\n4. ALL Orders on Sep 3 between 03:00 UTC and 09:00 UTC (${sep3Orders.length} orders):`);
    for (const o of sep3Orders) {
      console.log(`- Order: ${o.readableCode} (Legacy: ${o.legacyId}) | Time UTC: ${o.createdAt?.toISOString ? o.createdAt.toISOString() : o.createdAt} | Status: ${o.status} | Total: ${o.postDiscountTotal} | isRenewal: ${o.isRenewal} | Plate: ${o.normalizedPlate}`);
      console.log(`  Customer: ${(o.customerSnapshot || {}).name} | ${(o.customerSnapshot || {}).phone}`);
      console.log(`  Payments:`, JSON.stringify(o.payments));
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
