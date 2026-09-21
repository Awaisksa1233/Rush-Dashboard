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
    function toKsaTime(d) {
      if (!d) return '';
      const ksa = new Date(d.getTime() + 3 * 3600 * 1000);
      return ksa.toISOString().slice(11, 19);
    }

    // Today in KSA: 2026-09-12T21:00:00.000Z onwards
    const todayStart = new Date('2026-09-12T21:00:00.000Z');

    // Fetch all renewal orders in DB to accurately calculate attempt numbers
    const allRenewalOrders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { isRenewal: true },
        { subscriptionTransitionKind: 'renewal' },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }).sort({ createdAt: 1 }).toArray();

    // Map by subscription
    const subOrders = new Map();
    for (const o of allRenewalOrders) {
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

    // Find orders created today
    const todayOrders = allRenewalOrders.filter(o => o.createdAt >= todayStart);
    console.log(`Total renewal orders created today (Sep 13 KSA): ${todayOrders.length}`);

    // Categorize today's renewal orders into Initial Attempts (Att 1) vs Retries (Att 2+)
    const initialAttempts = [];
    const retries = [];

    for (const o of todayOrders) {
      let sc = o.subscriptionReadableCode;
      if (!sc && o.notes) {
        const m = o.notes.match(/SUB-\d+/i);
        if (m) sc = m[0].toUpperCase();
      }
      if (!sc && o.customerSnapshot?.readableCode) {
        sc = 'CUST_' + o.customerSnapshot.readableCode;
      }

      const list = subOrders.get(sc) || [o];
      list.sort((a, b) => a.createdAt - b.createdAt);

      // Find which attempt this is in the cycle
      let cycleStart = null;
      let attemptInCycle = 1;
      let firstOrderInCycle = null;

      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!cycleStart || (item.createdAt - cycleStart) > 15 * 86400 * 1000) {
          cycleStart = item.createdAt;
          attemptInCycle = 1;
          firstOrderInCycle = item;
        } else {
          attemptInCycle++;
        }
        if (item._id.toString() === o._id.toString()) {
          break;
        }
      }

      const isPaid = o.status === 'paid' || o.status === 'completed' || (o.payments && o.payments.some(p => p.status === 'paid'));
      const amt = o.postDiscountTotal || o.netTotal || o.payments?.[0]?.amount || 0;
      const failureReason = !isPaid ? (o.payments?.[0]?.failureReason || o.notes || 'FAILED') : null;

      const info = {
        orderCode: o.readableCode,
        sub: sc,
        plate: o.normalizedPlate,
        timeKsa: toKsaTime(o.createdAt),
        attemptNum: attemptInCycle,
        status: isPaid ? 'PAID' : 'FAILED',
        amount: amt,
        failureReason: failureReason,
        firstAttemptDate: firstOrderInCycle ? toKsa(firstOrderInCycle.createdAt) : 'Today'
      };

      if (attemptInCycle === 1) {
        initialAttempts.push(info);
      } else {
        retries.push(info);
      }
    }

    console.log(`Initial Attempts (Attempt 1): ${initialAttempts.length}`);
    console.log(`Retries (Attempt 2+): ${retries.length}`);

    console.log('\n--- RETRIES BREAKDOWN FOR TODAY (Sep 13) ---');
    console.table(retries);

    const paidRetries = retries.filter(r => r.status === 'PAID');
    const failedRetries = retries.filter(r => r.status === 'FAILED');
    console.log(`Retries Succeeded (Recovered Today): ${paidRetries.length}`);
    console.log(`Retries Failed Today: ${failedRetries.length}`);

    let totalRecoveredToday = 0;
    for (const r of paidRetries) totalRecoveredToday += r.amount;
    console.log(`Total SAR Recovered Today via Retries: SAR ${totalRecoveredToday.toFixed(2)}`);

    console.log('\n--- INITIAL ATTEMPTS (ATTEMPT 1) FOR TODAY ---');
    console.table(initialAttempts);

    // Also check hourly batches today
    const batches = {};
    for (const o of todayOrders) {
      const h = toKsa(o.createdAt).slice(11, 16);
      batches[h] = (batches[h] || 0) + 1;
    }
    console.log('\nOrder execution times today:');
    console.table(batches);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
