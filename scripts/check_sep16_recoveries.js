import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    function toKsa(d) {
      const ksa = new Date(d.getTime() + 3 * 3600 * 1000);
      return ksa.toISOString().replace('T', ' ').slice(0, 19);
    }

    const todayStart = new Date('2026-09-15T21:00:00.000Z');
    const orders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: todayStart },
      isRenewal: true,
      status: { $in: ['paid', 'completed'] }
    }).toArray();

    // Check which of these are attempt > 1
    const all = await db.collection('rushwash_sale_orders').find({
      isRenewal: true
    }).sort({ createdAt: 1 }).toArray();

    const subMap = new Map();
    for (const o of all) {
      let sc = o.subscriptionReadableCode;
      if (!sc && o.notes) {
        const m = o.notes.match(/SUB-\d+/i);
        if (m) sc = m[0].toUpperCase();
      }
      if (!sc) continue;
      if (!subMap.has(sc)) subMap.set(sc, []);
      subMap.get(sc).push(o);
    }

    console.log('Today (Sep 16) Paid Renewals:');
    for (const o of orders) {
      const list = subMap.get(o.subscriptionReadableCode) || [o];
      const attemptNum = list.findIndex(item => item._id.toString() === o._id.toString()) + 1;
      const amt = o.postDiscountTotal || o.netTotal || o.payments?.[0]?.amount;
      if (attemptNum > 1) {
        console.log(`RECOVERED ON RETRY: ${toKsa(o.createdAt)} | ${o.readableCode} | ${o.subscriptionReadableCode} | Plate: ${o.normalizedPlate} | Att #${attemptNum} | SAR ${amt}`);
      }
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
