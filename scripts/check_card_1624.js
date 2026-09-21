import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('=== 1. ALL CUSTOMERS WITH CARD 1624 ===');
    const custs1624 = await db.collection('rushwash_customers').find({
      $or: [
        { 'moyasarPaymentInstrument.lastFour': '1624' },
        { 'moyasarPaymentInstruments.lastFour': '1624' },
        { 'moyasarPaymentInstrument.last4': '1624' },
        { 'moyasarPaymentInstruments.last4': '1624' }
      ]
    }).toArray();

    console.log(`Found ${custs1624.length} customers with card 1624:`);
    for (const c of custs1624) {
      console.log(`\nCustomer: ${c.name} | Phone: ${c.phone} | Code: ${c.readableCode} | ID: ${c._id}`);
      console.log('Cards:', JSON.stringify(c.moyasarPaymentInstruments || c.moyasarPaymentInstrument, null, 2));

      // Check subscriptions
      const subs = await db.collection('rushwash_subscriptions').find({ customerId: c._id }).toArray();
      console.log(`  Subscriptions (${subs.length}):`);
      for (const s of subs) {
        console.log(`    - Sub: ${s.readableCode} | Status: ${s.status} | Package: ${s.packageNameEn} | RenewalDate: ${s.renewalDate}`);
        console.log(`      Vehicle:`, JSON.stringify(s.vehicleLinks));
        console.log(`      PaymentMethodUsed:`, JSON.stringify(s.paymentMethodUsed));
      }

      // Check orders
      const orders = await db.collection('rushwash_sale_orders').find({ customerId: c._id }).sort({ createdAt: -1 }).limit(10).toArray();
      console.log(`  Recent Orders (${orders.length}):`);
      for (const o of orders) {
        const ksaTime = new Date(new Date(o.createdAt).getTime() + 3 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
        console.log(`    - Order: ${o.readableCode} | KSA: ${ksaTime} | Status: ${o.status} | Total: ${o.postDiscountTotal} SAR | Plate: ${o.normalizedPlate} | Sub: ${o.subscriptionReadableCode}`);
        for (const p of o.payments || []) {
          console.log(`      Payment: status=${p.status} amt=${p.amount} providerId=${p.providerPaymentId} reason=${p.failureReason}`);
        }
      }
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
