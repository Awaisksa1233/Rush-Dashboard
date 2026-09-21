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

    // Fetch all renewal orders from Sep 10 onwards
    const orders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: new Date('2026-09-10T00:00:00.000Z') },
      $or: [
        { isRenewal: true },
        { subscriptionTransitionKind: 'renewal' },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }).sort({ createdAt: 1 }).toArray();

    console.log(`Total renewal orders since Sep 10: ${orders.length}`);

    // Check all renewal orders historically to accurately calculate attempt number
    const allRenewalOrders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { isRenewal: true },
        { subscriptionTransitionKind: 'renewal' },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }).sort({ createdAt: 1 }).toArray();

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

    // Breakdown by KSA day from Sep 12 to Sep 16
    const dailyStats = {};
    for (const o of orders) {
      const kDate = toKsaDate(o.createdAt);
      if (!dailyStats[kDate]) {
        dailyStats[kDate] = {
          total: 0,
          initialAttempts: 0,
          initialPaid: 0,
          retries: 0,
          retriesPaid: 0,
          retriesFailed: 0,
          recoveredSar: 0,
          batchesHours: new Set()
        };
      }
      const s = dailyStats[kDate];
      s.total++;

      // Check attempt number in sub's cycle
      let sc = o.subscriptionReadableCode;
      if (!sc && o.notes) {
        const m = o.notes.match(/SUB-\d+/i);
        if (m) sc = m[0].toUpperCase();
      }
      if (!sc && o.customerSnapshot?.readableCode) {
        sc = 'CUST_' + o.customerSnapshot.readableCode;
      }

      const list = subOrders.get(sc) || [o];
      let cycleStart = null;
      let attemptInCycle = 1;
      for (const item of list) {
        if (!cycleStart || (item.createdAt - cycleStart) > 15 * 86400 * 1000) {
          cycleStart = item.createdAt;
          attemptInCycle = 1;
        } else {
          attemptInCycle++;
        }
        if (item._id.toString() === o._id.toString()) break;
      }

      const isPaid = o.status === 'paid' || o.status === 'completed' || (o.payments && o.payments.some(p => p.status === 'paid'));
      const amt = o.postDiscountTotal || o.netTotal || o.payments?.[0]?.amount || 0;
      const hour = toKsa(o.createdAt).slice(11, 13);
      s.batchesHours.add(hour);

      if (attemptInCycle === 1) {
        s.initialAttempts++;
        if (isPaid) s.initialPaid++;
      } else {
        s.retries++;
        if (isPaid) {
          s.retriesPaid++;
          s.recoveredSar += amt;
        } else {
          s.retriesFailed++;
        }
      }
    }

    const tableData = {};
    for (const [d, s] of Object.entries(dailyStats)) {
      tableData[d] = {
        totalOrders: s.total,
        att1Orders: s.initialAttempts,
        att1Paid: s.initialPaid,
        retriesAttempted: s.retries,
        retriesPaid: s.retriesPaid,
        retriesFailed: s.retriesFailed,
        recoveredSar: s.recoveredSar,
        activeHoursKSA: Array.from(s.batchesHours).sort().join(', ')
      };
    }

    console.log('\n--- DAILY BREAKDOWN (Sep 10 to Sep 16 KSA) ---');
    console.table(tableData);

    // Latest 15 renewal orders
    console.log('\n--- LATEST 15 RENEWAL ORDERS IN DB ---');
    const latest15 = allRenewalOrders.slice(-15);
    for (const o of latest15) {
      console.log(`${toKsa(o.createdAt)} KSA | ${o.readableCode} | ${o.subscriptionReadableCode} | Plate: ${o.normalizedPlate} | Status: ${o.status} | Reason: ${o.payments?.[0]?.failureReason || 'OK'}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
