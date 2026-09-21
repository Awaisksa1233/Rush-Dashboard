import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    for (const code of ['ORD-27399', 'ORD-27404']) {
      const o = await db.collection('rushwash_sale_orders').findOne({ readableCode: code });
      console.log(`\n=================== ${code} ===================`);
      console.log(JSON.stringify(o, null, 2));

      // check subscriptions for this vehicle or customer
      const subs = await db.collection('rushwash_subscriptions').find({
        $or: [
          { 'vehicleLinks.snapshot.normalizedPlate': o.normalizedPlate },
          { customerId: o.customerId }
        ]
      }).toArray();
      console.log(`Subscriptions found (${subs.length}):`, JSON.stringify(subs.map(s => ({ code: s.readableCode, status: s.status, renewalDate: s.renewalDate, createdAt: s.createdAt })), null, 2));
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
