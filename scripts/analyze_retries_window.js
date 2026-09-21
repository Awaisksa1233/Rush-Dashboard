import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // 1. Fetch all orders with isRenewal: true or renewal transition
    console.log('Fetching all renewal orders...');
    const renewalOrders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { isRenewal: true },
        { subscriptionTransitionKind: 'renewal' },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }).sort({ createdAt: 1 }).toArray();

    console.log(`Total renewal orders found in history: ${renewalOrders.length}`);

    // Map by subscription code
    const subOrders = new Map();
    for (const o of renewalOrders) {
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

    console.log(`Total unique subscriptions with renewal orders: ${subOrders.size}`);

    // Let's examine orders specifically in the window Sep 1 to Sep 13
    // Also let's check KSA time conversion
    function toKsaDate(d) {
      const ksa = new Date(d.getTime() + 3 * 3600 * 1000);
      return ksa.toISOString().slice(0, 10);
    }
    function toKsaDateTime(d) {
      const ksa = new Date(d.getTime() + 3 * 3600 * 1000);
      return ksa.toISOString().replace('T', ' ').slice(0, 19);
    }

    // Let's check attempts per subscription
    // Specifically looking at Sep 5 to Sep 12
    const windowStart = new Date('2026-09-04T21:00:00.000Z'); // 2026-09-05 00:00 KSA
    const windowEnd = new Date('2026-09-12T20:59:59.999Z');   // 2026-09-12 23:59:59 KSA
    const sep13End = new Date('2026-09-13T20:59:59.999Z');

    // Subscriptions with at least one renewal order between Sep 5 and Sep 12 (KSA)
    const windowSubs = new Set();
    for (const [sc, orders] of subOrders.entries()) {
      if (orders.some(o => o.createdAt >= windowStart && o.createdAt <= windowEnd)) {
        windowSubs.add(sc);
      }
    }

    console.log(`Subscriptions with renewal activity between Sep 5 and Sep 12: ${windowSubs.size}`);

    // Let's inspect each of these subscriptions:
    // How many attempts did they have?
    // What was attempt 1? Did attempt 1 fail? Did they get retried (attempt 2+)?
    // Did they recover (eventually succeed)?
    let firstAttemptSuccess = 0;
    let firstAttemptFailed = 0;
    let failedAndRetried = 0;
    let failedAndNeverRetried = 0;
    let recoveredOnRetry = 0;
    let stillFailingAfterRetry = 0;
    let totalRecoveredSar = 0;

    const retryBreakdown = [];

    for (const sc of windowSubs) {
      const allOrders = subOrders.get(sc).sort((a, b) => a.createdAt - b.createdAt);
      
      // Let's find the first attempt in or relevant to this renewal cycle
      // Cycle: let's look at attempts from Sep 1 onwards or from the first attempt >= windowStart
      const cycleOrders = allOrders.filter(o => o.createdAt >= new Date('2026-09-01T00:00:00.000Z'));
      
      const firstOrder = cycleOrders[0];
      const isFirstPaid = firstOrder.status === 'paid' || firstOrder.status === 'completed' || (firstOrder.payments && firstOrder.payments.some(p => p.status === 'paid'));

      if (isFirstPaid) {
        firstAttemptSuccess++;
      } else {
        firstAttemptFailed++;
        const retryOrders = cycleOrders.slice(1);
        if (retryOrders.length > 0) {
          failedAndRetried++;
          // Did any retry succeed?
          const paidRetry = retryOrders.find(o => o.status === 'paid' || o.status === 'completed' || (o.payments && o.payments.some(p => p.status === 'paid')));
          if (paidRetry) {
            recoveredOnRetry++;
            const amount = paidRetry.postDiscountTotal || paidRetry.netTotal || (paidRetry.payments && paidRetry.payments[0]?.amount) || 0;
            totalRecoveredSar += amount;
            retryBreakdown.push({
              sub: sc,
              plate: paidRetry.normalizedPlate,
              attemptsCount: cycleOrders.length,
              recoveredAt: toKsaDateTime(paidRetry.createdAt),
              recoveredAmount: amount,
              orderCode: paidRetry.readableCode,
              initialFailReason: firstOrder.payments?.[0]?.failureReason || firstOrder.notes,
              status: 'RECOVERED'
            });
          } else {
            stillFailingAfterRetry++;
          }
        } else {
          failedAndNeverRetried++;
        }
      }
    }

    console.log('\n--- COHORT ANALYSIS (Subs with attempts Sep 5 - Sep 12) ---');
    console.log(`Total subscriptions in cycle: ${windowSubs.size}`);
    console.log(`Initial Attempt 1 Succeeded: ${firstAttemptSuccess}`);
    console.log(`Initial Attempt 1 Failed: ${firstAttemptFailed}`);
    console.log(`Failed and Retried (Attempt 2+ made): ${failedAndRetried}`);
    console.log(`Failed and NEVER Retried (Only 1 attempt made): ${failedAndNeverRetried}`);
    console.log(`Recovered on Retry: ${recoveredOnRetry}`);
    console.log(`Still Failing after Retry: ${stillFailingAfterRetry}`);
    console.log(`Total Recovered Amount: SAR ${totalRecoveredSar.toFixed(2)}`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
