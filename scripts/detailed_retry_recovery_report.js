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

    // Group by subscription
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

    console.log('====================================================');
    console.log('1. CALENDAR-DAY RECOVERIES (Payments collected on Attempt 2+ between Sep 5 and Sep 12)');
    console.log('====================================================');

    const calendarRecoveryByDay = {};
    for (let d = 5; d <= 12; d++) {
      const dayStr = `2026-09-${d < 10 ? '0' + d : d}`;
      calendarRecoveryByDay[dayStr] = {
        totalRenewalOrders: 0,
        paidRenewalOrders: 0,
        initialSuccessOrders: 0,
        recoveredRetryOrders: 0,
        recoveredSar: 0,
        totalRenewalRevenueSar: 0
      };
    }

    // Inspect each order and determine if it was attempt 1 or attempt 2+ in its cycle
    for (const [sc, subOrderList] of subOrders.entries()) {
      subOrderList.sort((a, b) => a.createdAt - b.createdAt);
      
      // Track attempt number within cycle
      let cycleStart = null;
      let attemptInCycle = 0;

      for (let i = 0; i < subOrderList.length; i++) {
        const o = subOrderList[i];
        if (!cycleStart || (o.createdAt - cycleStart) > 15 * 86400 * 1000) {
          cycleStart = o.createdAt;
          attemptInCycle = 1;
        } else {
          attemptInCycle++;
        }

        const kDate = toKsaDate(o.createdAt);
        if (calendarRecoveryByDay[kDate]) {
          const stats = calendarRecoveryByDay[kDate];
          stats.totalRenewalOrders++;
          const isPaid = o.status === 'paid' || o.status === 'completed' || (o.payments && o.payments.some(p => p.status === 'paid'));
          const amt = o.postDiscountTotal || o.netTotal || o.payments?.[0]?.amount || 0;
          if (isPaid) {
            stats.paidRenewalOrders++;
            stats.totalRenewalRevenueSar += amt;
            if (attemptInCycle === 1) {
              stats.initialSuccessOrders++;
            } else {
              stats.recoveredRetryOrders++;
              stats.recoveredSar += amt;
            }
          }
        }
      }
    }

    console.table(calendarRecoveryByDay);

    let totRecOrders = 0;
    let totRecSar = 0;
    let totRev = 0;
    for (const k in calendarRecoveryByDay) {
      totRecOrders += calendarRecoveryByDay[k].recoveredRetryOrders;
      totRecSar += calendarRecoveryByDay[k].recoveredSar;
      totRev += calendarRecoveryByDay[k].totalRenewalRevenueSar;
    }
    console.log(`TOTAL CALENDAR RECOVERY (Sep 5 - Sep 12): ${totRecOrders} renewals recovered | SAR ${totRecSar.toFixed(2)} (out of total renewal revenue SAR ${totRev.toFixed(2)})`);

    console.log('\n====================================================');
    console.log('2. COHORT RECOVERY (Subscriptions attempted Sep 5 - Sep 12)');
    console.log('====================================================');

    // For subscriptions whose FIRST attempt in this cycle occurred between Sep 5 and Sep 12
    const cohortByDay = {};
    for (let d = 5; d <= 12; d++) {
      const dayStr = `2026-09-${d < 10 ? '0' + d : d}`;
      cohortByDay[dayStr] = {
        subsDueAttempted: 0,
        initialSuccess: 0,
        initialFailed: 0,
        retried: 0,
        recovered: 0,
        recoveryRateOnFailed: '0%',
        recoveredSar: 0
      };
    }

    const recoveredDetails = [];
    const unretriedDetails = [];
    const retryFrequency = {};

    for (const [sc, subOrderList] of subOrders.entries()) {
      subOrderList.sort((a, b) => a.createdAt - b.createdAt);
      
      // Find orders belonging to September 2026 cycle
      const sepOrders = subOrderList.filter(o => o.createdAt >= new Date('2026-09-01T00:00:00.000Z'));
      if (sepOrders.length === 0) continue;

      const firstOrder = sepOrders[0];
      const kFirstDate = toKsaDate(firstOrder.createdAt);

      if (kFirstDate >= '2026-09-05' && kFirstDate <= '2026-09-12') {
        const stats = cohortByDay[kFirstDate];
        if (stats) {
          stats.subsDueAttempted++;
          const isFirstPaid = firstOrder.status === 'paid' || firstOrder.status === 'completed' || (firstOrder.payments && firstOrder.payments.some(p => p.status === 'paid'));
          if (isFirstPaid) {
            stats.initialSuccess++;
          } else {
            stats.initialFailed++;
            const retries = sepOrders.slice(1);
            if (retries.length > 0) {
              stats.retried++;
              // Check if any retry succeeded
              const paidRetry = retries.find(o => o.status === 'paid' || o.status === 'completed' || (o.payments && o.payments.some(p => p.status === 'paid')));
              if (paidRetry) {
                stats.recovered++;
                const amt = paidRetry.postDiscountTotal || paidRetry.netTotal || paidRetry.payments?.[0]?.amount || 0;
                stats.recoveredSar += amt;
                recoveredDetails.push({
                  sub: sc,
                  customer: paidRetry.customerSnapshot?.name || paidRetry.customerId,
                  plate: paidRetry.normalizedPlate,
                  initialAttempt: toKsa(firstOrder.createdAt),
                  initialReason: firstOrder.payments?.[0]?.failureReason || 'FAILED',
                  recoveredAt: toKsa(paidRetry.createdAt),
                  recoveredAttemptNum: sepOrders.indexOf(paidRetry) + 1,
                  totalAttempts: sepOrders.length,
                  amount: amt,
                  orderCode: paidRetry.readableCode
                });
              }
            } else {
              unretriedDetails.push({
                sub: sc,
                date: toKsa(firstOrder.createdAt),
                plate: firstOrder.normalizedPlate,
                reason: firstOrder.payments?.[0]?.failureReason || firstOrder.notes || 'N/A'
              });
            }
          }
        }
      }
    }

    for (const d in cohortByDay) {
      const s = cohortByDay[d];
      if (s.initialFailed > 0) {
        s.recoveryRateOnFailed = ((s.recovered / s.initialFailed) * 100).toFixed(1) + '%';
      }
    }
    console.table(cohortByDay);

    console.log('\n====================================================');
    console.log('3. ARE RETRIES STILL RUNNING / COMPLETED? (Latest Retry Activity)');
    console.log('====================================================');
    const recentOrders = await db.collection('rushwash_sale_orders').find({
      isRenewal: true
    }).sort({ createdAt: -1 }).limit(10).toArray();

    console.log('Last 10 renewal orders in database:');
    for (const ro of recentOrders) {
      console.log(`${toKsa(ro.createdAt)} KSA | ${ro.readableCode} | ${ro.subscriptionReadableCode} | ${ro.normalizedPlate} | Status: ${ro.status} | Notes: ${ro.notes} | Reason: ${ro.payments?.[0]?.failureReason || 'OK'}`);
    }

    console.log('\nTotal Recovered Subscriptions Details:');
    console.table(recoveredDetails);

    console.log('\nUnretried Subscriptions (Only 1 attempt, failed, never retried):');
    console.table(unretriedDetails);

    // Distribution of attempts on retried subs
    const attemptCounts = {};
    for (const [sc, subOrderList] of subOrders.entries()) {
      const sepOrders = subOrderList.filter(o => o.createdAt >= new Date('2026-09-01T00:00:00.000Z'));
      if (sepOrders.length > 0) {
        const kFirst = toKsaDate(sepOrders[0].createdAt);
        if (kFirst >= '2026-09-05' && kFirst <= '2026-09-12') {
          const cnt = sepOrders.length;
          attemptCounts[cnt] = (attemptCounts[cnt] || 0) + 1;
        }
      }
    }
    console.log('\nDistribution of total attempts per subscription:');
    console.table(attemptCounts);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
