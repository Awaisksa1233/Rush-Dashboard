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
    function toKsaDate(d) {
      if (!d) return '';
      const ksa = new Date(d.getTime() + 3 * 3600 * 1000);
      return ksa.toISOString().slice(0, 10);
    }

    const orders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { isRenewal: true },
        { subscriptionTransitionKind: 'renewal' },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }).sort({ createdAt: 1 }).toArray();

    // Map by sub
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

    // Inspect all retry orders (attempt 2+) executed between Sep 5 and Sep 12 (KSA)
    const windowStart = new Date('2026-09-04T21:00:00.000Z');
    const windowEnd = new Date('2026-09-12T20:59:59.999Z');

    const retriesInWindow = [];
    for (const [sc, list] of subOrders.entries()) {
      list.sort((a, b) => a.createdAt - b.createdAt);
      let cycleStart = null;
      let attemptInCycle = 0;
      let firstAttemptOrder = null;

      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        if (!cycleStart || (o.createdAt - cycleStart) > 15 * 86400 * 1000) {
          cycleStart = o.createdAt;
          attemptInCycle = 1;
          firstAttemptOrder = o;
        } else {
          attemptInCycle++;
        }

        if (o.createdAt >= windowStart && o.createdAt <= windowEnd && attemptInCycle > 1) {
          const isPaid = o.status === 'paid' || o.status === 'completed' || (o.payments && o.payments.some(p => p.status === 'paid'));
          const amt = o.postDiscountTotal || o.netTotal || o.payments?.[0]?.amount || 0;
          retriesInWindow.push({
            orderCode: o.readableCode,
            sub: sc,
            executedAt: toKsa(o.createdAt),
            attemptNum: attemptInCycle,
            isPaid: isPaid ? 'PAID' : 'FAILED',
            amount: amt,
            originalFailDate: toKsaDate(firstAttemptOrder.createdAt),
            originalFailReason: firstAttemptOrder.payments?.[0]?.failureReason || firstAttemptOrder.notes
          });
        }
      }
    }

    console.log(`Total retry attempts executed between Sep 5 and Sep 12: ${retriesInWindow.length}`);
    const paidRetries = retriesInWindow.filter(r => r.isPaid === 'PAID');
    console.log(`Of which SUCCEEDED (RECOVERED): ${paidRetries.length}`);
    let totalSar = 0;
    for (const r of paidRetries) totalSar += r.amount;
    console.log(`Total SAR Recovered: SAR ${totalSar.toFixed(2)}`);

    console.log('\nAll Successful Recoveries on Retry between Sep 5 and Sep 12:');
    console.table(paidRetries);

    // Group retry attempts by original failure date cohort
    const originCohort = {};
    for (const r of retriesInWindow) {
      const orig = r.originalFailDate;
      if (!originCohort[orig]) originCohort[orig] = { totalRetries: 0, recovered: 0, recoveredSar: 0 };
      originCohort[orig].totalRetries++;
      if (r.isPaid === 'PAID') {
        originCohort[orig].recovered++;
        originCohort[orig].recoveredSar += r.amount;
      }
    }
    console.log('\nRetries executed in Sep 5-12 grouped by their original failure date cohort:');
    console.table(originCohort);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
