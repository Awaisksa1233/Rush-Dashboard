import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const phonePattern = /555105886/;
    const custs = await db.collection('rushwash_customers').find({
      $or: [{ phone: phonePattern }, { mobile: phonePattern }]
    }).toArray();

    console.log('=== CUSTOMERS ===');
    console.log(JSON.stringify(custs, null, 2));

    const custIds = custs.map(c => c._id);

    const orders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { customerId: { $in: custIds } },
        { 'customerSnapshot.phone': phonePattern },
        { normalizedPlate: { $in: ['2008XBA', '3785UGB'] } }
      ]
    }).sort({ createdAt: 1 }).toArray();

    console.log(`\n=== ORDERS (${orders.length}) ===`);
    orders.forEach(o => {
      console.log(`- ${o.readableCode} (Legacy: ${o.legacyId}) | Date: ${JSON.stringify(o.createdAt)} | Status: ${o.status} | Plate: ${o.normalizedPlate}`);
      console.log(`  Total: ${o.postDiscountTotal} | Captured: ${o.totalCaptured} | isRenewal: ${o.isRenewal}`);
      console.log(`  Payments: ${JSON.stringify(o.payments, null, 2)}`);
    });

    const refunds = await db.collection('rushwash_refund_requests').find({
      $or: [
        { customerId: { $in: custIds } },
        { 'customerSnapshot.phone': phonePattern }
      ]
    }).toArray();

    console.log(`\n=== REFUNDS (${refunds.length}) ===`);
    console.log(JSON.stringify(refunds, null, 2));

    const audits = await db.collection('rushwash_audit_events').find({
      $or: [
        { customerId: { $in: custIds } },
        { 'target.id': { $in: custIds } }
      ]
    }).limit(20).toArray();
    console.log(`\n=== AUDITS (${audits.length}) ===`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
