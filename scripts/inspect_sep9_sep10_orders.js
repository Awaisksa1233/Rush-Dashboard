import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // Find orders from ORD-27280 onwards
    const orders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: new Date('2026-09-09T00:00:00.000Z') }
    }).sort({ createdAt: 1 }).toArray();

    console.log(`Total orders since 2026-09-09 00:00 UTC: ${orders.length}`);
    const renewalOrders = orders.filter(o => o.isRenewal || o.notes?.includes('subscription_renewal'));
    console.log(`Of which renewal orders: ${renewalOrders.length}`);

    // Group renewal orders by hour
    const hourMap = {};
    for (const ro of renewalOrders) {
      const h = ro.createdAt.toISOString().slice(0, 13);
      hourMap[h] = (hourMap[h] || 0) + 1;
    }
    console.log('Renewal orders by hour (UTC):', hourMap);

    // Check ORD-27389 to ORD-27399
    console.log('\nLast 15 orders in rushwash_sale_orders:');
    const last15 = await db.collection('rushwash_sale_orders').find().sort({ createdAt: -1 }).limit(15).toArray();
    for (const o of last15.reverse()) {
      console.log(`${o.readableCode} | ${o.createdAt?.toISOString()} | ${o.status} | isRenewal: ${o.isRenewal} | notes: ${o.notes} | plate: ${o.normalizedPlate}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
