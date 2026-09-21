import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // Fetch all renewal orders on 2026-09-03
    const start = new Date('2026-09-03T00:00:00.000Z');
    const end = new Date('2026-09-03T23:59:59.999Z');

    const orders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: start, $lte: end },
      $or: [
        { isRenewal: true },
        { 'payments.paymentMethodNameEn': 'Saved card' },
        { 'payments.paymentMethodIdentityKey': 'platform:moyasar_token' }
      ]
    }).sort({ createdAt: 1 }).toArray();

    console.log(`\n=== FOUND ${orders.length} RENEWAL ORDERS ON 2026-09-03 ===\n`);

    for (const o of orders) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: o.customerId });
      const subs = await db.collection('rushwash_subscriptions').find({
        $or: [
          { orderId: o._id },
          { customerId: o.customerId }
        ]
      }).toArray();

      const ksaDate = new Date(o.createdAt);
      ksaDate.setHours(ksaDate.getHours() + 3);

      console.log('--------------------------------------------------------------------------------');
      console.log(`Order: ${o.readableCode}`);
      console.log(`  UTC Time: ${o.createdAt?.toISOString ? o.createdAt.toISOString() : o.createdAt}`);
      console.log(`  KSA Time (Local): ${ksaDate.toISOString().replace('T', ' ').slice(0, 19)}`);
      console.log(`  Plate: ${o.normalizedPlate}`);
      console.log(`  Total: ${o.postDiscountTotal} SAR | Status: ${o.status}`);
      console.log(`  Customer: ${cust?.name} | Phone: ${cust?.phone} | Code: ${cust?.readableCode}`);
      
      console.log(`  Saved Instruments on Customer Profile:`);
      const insts = cust?.moyasarPaymentInstruments || (cust?.moyasarPaymentInstrument ? [cust.moyasarPaymentInstrument] : []);
      if (insts.length === 0) {
        console.log(`    (None found in customer profile)`);
      } else {
        insts.forEach((inst, idx) => {
          console.log(`    [#${idx+1}] Brand: ${inst.brand} | Last4: ${inst.lastFour || inst.last4} | Token: ${inst.tokenId} | Primary: ${inst.isPrimary} | ID: ${inst.id || inst._id}`);
        });
      }

      console.log(`  Order Payments Array:`);
      (o.payments || []).forEach((p, idx) => {
        console.log(`    Payment #${idx+1}: Amount: ${p.amount} SAR | Status: ${p.status} | Method: ${p.paymentMethodNameEn} | ProviderPaymentId: ${p.providerPaymentId} | Token: ${p.paymentToken} | Failure: ${p.failureReason || 'None'}`);
      });
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
