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

    // Yesterday KSA is 2026-09-12
    const yestStart = new Date('2026-09-11T21:00:00.000Z');
    const yestEnd = new Date('2026-09-12T20:59:59.999Z');

    // Find all orders created yesterday
    const yestOrders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: yestStart, $lte: yestEnd },
      $or: [
        { isRenewal: true },
        { subscriptionTransitionKind: 'renewal' },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }).sort({ createdAt: 1 }).toArray();

    console.log(`Total renewal orders yesterday (Sep 12): ${yestOrders.length}`);

    // All orders overall to check attempts
    const allOrders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { isRenewal: true },
        { subscriptionTransitionKind: 'renewal' },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }).sort({ createdAt: 1 }).toArray();

    const subMap = new Map();
    for (const o of allOrders) {
      let sc = o.subscriptionReadableCode;
      if (!sc && o.notes) {
        const m = o.notes.match(/SUB-\d+/i);
        if (m) sc = m[0].toUpperCase();
      }
      if (!sc && o.customerSnapshot?.readableCode) {
        sc = 'CUST_' + o.customerSnapshot.readableCode;
      }
      if (!sc) continue;
      if (!subMap.has(sc)) subMap.set(sc, []);
      subMap.get(sc).push(o);
    }

    // Let's inspect each renewal order from yesterday
    const att1Yesterday = [];
    for (const o of yestOrders) {
      let sc = o.subscriptionReadableCode;
      if (!sc && o.notes) {
        const m = o.notes.match(/SUB-\d+/i);
        if (m) sc = m[0].toUpperCase();
      }
      if (!sc && o.customerSnapshot?.readableCode) {
        sc = 'CUST_' + o.customerSnapshot.readableCode;
      }

      const list = subMap.get(sc) || [o];
      list.sort((a, b) => a.createdAt - b.createdAt);
      const isFirst = list[0]._id.toString() === o._id.toString() || (o.createdAt - list[0].createdAt) < 3600000;
      
      const isPaid = o.status === 'paid' || o.status === 'completed' || (o.payments && o.payments.some(p => p.status === 'paid'));
      
      // Check if this sub had ANY order today (Sep 13)
      const todayOrders = list.filter(item => item.createdAt > yestEnd);

      if (isFirst) {
        att1Yesterday.push({
          orderCode: o.readableCode,
          sub: sc,
          plate: o.normalizedPlate,
          time: toKsa(o.createdAt),
          status: isPaid ? 'PAID' : 'FAILED',
          amount: o.postDiscountTotal || o.netTotal || o.payments?.[0]?.amount,
          failureReason: !isPaid ? (o.payments?.[0]?.failureReason || o.notes) : null,
          retriedToday: todayOrders.length > 0 ? 'YES' : 'NO',
          todayOrderDetails: todayOrders.map(t => `${t.readableCode} (${t.status})`).join(', ')
        });
      }
    }

    console.log(`\n--- RENEWALS FIRST ATTEMPTED YESTERDAY (Sep 12 Cohort: Attempt 1) ---`);
    console.log(`Total Attempt 1 renewals yesterday: ${att1Yesterday.length}`);
    const att1Paid = att1Yesterday.filter(x => x.status === 'PAID');
    const att1Failed = att1Yesterday.filter(x => x.status === 'FAILED');
    console.log(`Paid on Attempt 1: ${att1Paid.length}`);
    console.log(`Failed on Attempt 1: ${att1Failed.length}`);

    console.log('\nList of renewals that FAILED on Attempt 1 yesterday:');
    console.table(att1Failed);

    // Also check subscriptions due on Sep 12 from rushwash_subscriptions
    const subsDueSep12 = await db.collection('rushwash_subscriptions').find({
      renewalDate: { $gte: yestStart, $lte: yestEnd }
    }).toArray();
    console.log(`\nTotal subscriptions in rushwash_subscriptions with renewalDate on Sep 12: ${subsDueSep12.length}`);
    for (const s of subsDueSep12) {
      console.log(`${s.readableCode} | status: ${s.status} | autoRenew: ${s.autoRenew} | retryCount: ${s.retryCount} | nextAttempt: ${s.nextRenewalAttemptDate || s.nextRetryDate}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
