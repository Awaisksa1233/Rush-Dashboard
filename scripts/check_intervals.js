import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    function toKsa(d) {
      if (!d) return '';
      const ksa = new Date(d.getTime() + 3 * 3600 * 1000);
      return ksa.toISOString().replace('T', ' ').slice(0, 19);
    }

    // Let's check subscriptions whose Attempt 1 failed on Sep 10, Sep 11, or Sep 12, and see when Attempt 2 happened
    const orders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: new Date('2026-09-08T00:00:00.000Z') },
      $or: [
        { isRenewal: true },
        { subscriptionTransitionKind: 'renewal' },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }).sort({ createdAt: 1 }).toArray();

    const subOrders = new Map();
    for (const o of orders) {
      let sc = o.subscriptionReadableCode;
      if (!sc && o.notes) {
        const m = o.notes.match(/SUB-\d+/i);
        if (m) sc = m[0].toUpperCase();
      }
      if (!sc && o.customerSnapshot?.readableCode) {
        sc = 'CUST_' + o.customerSnapshot.readableCode;
      }
      if (!sc) continue;
      if (!subOrders.has(sc)) subOrders.set(sc, []);
      subOrders.get(sc).push(o);
    }

    console.log('Sample intervals between Attempt 1 and Attempt 2:');
    for (const [sc, list] of subOrders.entries()) {
      if (list.length >= 2) {
        const a1 = list[0];
        const a2 = list[1];
        const hours = (a2.createdAt - a1.createdAt) / (3600 * 1000);
        console.log(`${sc} | Att 1: ${toKsa(a1.createdAt)} (${a1.status}) -> Att 2: ${toKsa(a2.createdAt)} (${a2.status}) | Delta: ${hours.toFixed(1)} hrs`);
      }
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
