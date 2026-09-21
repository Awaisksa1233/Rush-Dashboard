import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const checkCodes = ['ORD-25776', 'ORD-25900', 'ORD-25912', 'ORD-25933', 'ORD-26096', 'ORD-26099', 'ORD-26113', 'ORD-26144', 'ORD-26260', 'ORD-26262', 'ORD-26280', 'ORD-26330', 'ORD-26642', 'ORD-26646', 'ORD-26892'];

    for (const code of checkCodes) {
      const o = await db.collection('rushwash_sale_orders').findOne({ readableCode: code });
      const subs = await db.collection('rushwash_subscriptions').find({
        $or: [
          { orderId: o._id },
          { saleOrderId: o._id },
          { 'vehicleLinks.snapshot.normalizedPlate': o.normalizedPlate }
        ]
      }).toArray();

      console.log(`Order ${code} (${o.normalizedPlate}, ${o.createdAt}): Sub count: ${subs.length}`);
      for (const s of subs) {
        console.log(`  -> Sub: ${s.readableCode} | Created: ${s.createdAt} | Status: ${s.status} | Renewal: ${s.renewalDate}`);
      }
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
