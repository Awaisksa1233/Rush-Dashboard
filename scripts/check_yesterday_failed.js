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

    // Yesterday KSA: 2026-09-11T21:00:00.000Z to 2026-09-12T20:59:59.999Z
    const yestStart = new Date('2026-09-11T21:00:00.000Z');
    const yestEnd = new Date('2026-09-12T20:59:59.999Z');

    const orders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { isRenewal: true },
        { subscriptionTransitionKind: 'renewal' },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }).sort({ createdAt: 1 }).toArray();

    // Map by subscription
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

    // Identify all subscriptions that had an attempt yesterday (Sep 12 KSA)
    const yestSubs = [];
    for (const [sc, list] of subOrders.entries()) {
      list.sort((a, b) => a.createdAt - b.createdAt);
      const ordersYesterday = list.filter(o => o.createdAt >= yestStart && o.createdAt <= yestEnd);
      if (ordersYesterday.length > 0) {
        // Did it fail yesterday?
        const lastOrderYest = ordersYesterday[ordersYesterday.length - 1];
        const isPaid = lastOrderYest.status === 'paid' || lastOrderYest.status === 'completed' || (lastOrderYest.payments && lastOrderYest.payments.some(p => p.status === 'paid'));
        
        // Orders today (Sep 13 KSA)
        const ordersToday = list.filter(o => o.createdAt > yestEnd);

        yestSubs.push({
          sub: sc,
          plate: lastOrderYest.normalizedPlate,
          ordersYesterdayCount: ordersYesterday.length,
          lastOrderYestCode: lastOrderYest.readableCode,
          lastOrderYestTime: toKsa(lastOrderYest.createdAt),
          lastOrderYestStatus: isPaid ? 'PAID' : 'FAILED',
          lastOrderYestReason: lastOrderYest.payments?.[0]?.failureReason || lastOrderYest.notes,
          retriedToday: ordersToday.length > 0 ? 'YES' : 'NO',
          todayOrderCodes: ordersToday.map(o => o.readableCode).join(', '),
          totalAttemptsInCycle: list.length
        });
      }
    }

    console.log(`Total subscriptions attempted yesterday (Sep 12): ${yestSubs.length}`);
    const yestFailed = yestSubs.filter(s => s.lastOrderYestStatus === 'FAILED');
    const yestPaid = yestSubs.filter(s => s.lastOrderYestStatus === 'PAID');
    console.log(`Of which Succeeded yesterday: ${yestPaid.length}`);
    console.log(`Of which FAILED yesterday: ${yestFailed.length}`);

    console.log('\n--- ALL SUBSCRIPTIONS THAT FAILED YESTERDAY (Sep 12) ---');
    console.table(yestFailed);

    const retriedTodayFromYest = yestFailed.filter(s => s.retriedToday === 'YES');
    console.log(`\nHow many of yesterday's failures were retried today so far? ${retriedTodayFromYest.length} / ${yestFailed.length}`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
