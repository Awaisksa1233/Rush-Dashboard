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
      return ksa.toISOString().slice(11, 16);
    }

    const start14 = new Date('2026-09-13T21:00:00.000Z');
    const end15 = new Date('2026-09-15T20:59:59.999Z');

    const orders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: start14, $lte: end15 },
      $or: [
        { isRenewal: true },
        { subscriptionTransitionKind: 'renewal' },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }).sort({ createdAt: 1 }).toArray();

    // All orders to calculate attempt number accurately
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

    for (const day of ['2026-09-14', '2026-09-15']) {
      const dStart = new Date(day === '2026-09-14' ? '2026-09-13T21:00:00.000Z' : '2026-09-14T21:00:00.000Z');
      const dEnd = new Date(day === '2026-09-14' ? '2026-09-14T20:59:59.999Z' : '2026-09-15T20:59:59.999Z');

      const dayOrders = orders.filter(o => o.createdAt >= dStart && o.createdAt <= dEnd);
      console.log(`\n====================================================`);
      console.log(`DATE: ${day} (Total Renewal Orders: ${dayOrders.length})`);
      console.log(`====================================================`);

      const att1 = [];
      const retries = [];

      for (const o of dayOrders) {
        const list = subMap.get(o.subscriptionReadableCode) || [o];
        const attNum = list.findIndex(item => item._id.toString() === o._id.toString()) + 1;
        const isPaid = o.status === 'paid' || o.status === 'completed' || (o.payments && o.payments.some(p => p.status === 'paid'));
        const amt = o.postDiscountTotal || o.netTotal || o.payments?.[0]?.amount || 0;
        const reason = !isPaid ? (o.payments?.[0]?.failureReason || o.notes) : 'OK';

        const row = {
          order: o.readableCode,
          time: toKsaTime(o.createdAt),
          sub: o.subscriptionReadableCode,
          plate: o.normalizedPlate,
          att: attNum,
          status: isPaid ? 'PAID' : 'FAILED',
          amt,
          reason
        };

        if (attNum === 1) att1.push(row);
        else retries.push(row);
      }

      console.log(`\n--- Attempt 1 (New Renewals Due on ${day}): ${att1.length} orders ---`);
      const att1Paid = att1.filter(r => r.status === 'PAID');
      const att1Failed = att1.filter(r => r.status === 'FAILED');
      const att1Rev = att1Paid.reduce((acc, r) => acc + r.amt, 0);
      console.log(`Paid: ${att1Paid.length} (SAR ${att1Rev.toFixed(2)}) | Failed: ${att1Failed.length}`);
      if (att1Failed.length > 0) {
        console.log('Attempt 1 Failures:');
        console.table(att1Failed);
      }

      console.log(`\n--- Retries (Attempt 2+ on ${day}): ${retries.length} orders ---`);
      console.table(retries);

      // Failure reason distribution for retries
      const reasonCounts = {};
      for (const r of retries) {
        reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1;
      }
      console.log('Retry Failure Reasons on ' + day + ':', reasonCounts);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
