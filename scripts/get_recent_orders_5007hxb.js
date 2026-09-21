import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const cleanPlate = '5007HXB';

    console.log('=== MOST RECENT ORDERS FOR 5007HXB ===');
    const orders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { normalizedPlate: { $regex: cleanPlate, $options: 'i' } },
        { 'vehicleSnapshot.normalizedPlate': { $regex: cleanPlate, $options: 'i' } }
      ]
    }).sort({ createdAt: -1 }).limit(6).toArray();

    for (const o of orders) {
      console.log(`\n======================================================`);
      console.log(`Order Code: ${o.readableCode}`);
      console.log(`Status: ${o.status}`);
      console.log(`Created At: ${o.createdAt}`);
      console.log(`Completed At: ${o.completedAt}`);
      console.log(`Total: ${o.postDiscountTotal} SAR`);
      console.log(`Customer: ${(o.customerSnapshot || {}).name} | Phone: ${(o.customerSnapshot || {}).phone} | Code: ${(o.customerSnapshot || {}).readableCode}`);
      console.log(`Subscription: ${o.subscriptionReadableCode} | isRenewal: ${o.isRenewal}`);
      console.log(`Lines:`, JSON.stringify(o.lines || o.lineSnapshots, null, 2));
      console.log(`Payments:`, JSON.stringify(o.payments, null, 2));
      if (o.refund) console.log(`Refund:`, JSON.stringify(o.refund, null, 2));
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
