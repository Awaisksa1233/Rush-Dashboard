import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const orders = await db.collection('rushwash_sale_orders').find({
      readableCode: { $in: ['ORD-27806', 'ORD-27807', 'ORD-27808', 'ORD-27809', 'ORD-27810', 'ORD-27811', 'ORD-27812', 'ORD-27813', 'ORD-27814'] }
    }).toArray();

    for (const o of orders) {
      console.log(`${o.readableCode} | ${o.subscriptionReadableCode} | ${o.normalizedPlate} | ${o.status} | Reason: ${o.payments?.[0]?.failureReason}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
