import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const orders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: new Date('2026-09-01T00:00:00.000Z') }
    }).sort({ createdAt: 1 }).toArray();

    console.log(`Total orders from Sep 1 onwards: ${orders.length}`);

    const renewals = orders.filter(o => o.isRenewal || o.subscriptionTransitionKind === 'renewal' || (o.notes && o.notes.includes('renewal')));
    console.log(`Total renewal orders from Sep 1 onwards: ${renewals.length}`);

    const byDay = {};
    for (const o of renewals) {
      const ksaDate = new Date(o.createdAt.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
      if (!byDay[ksaDate]) byDay[ksaDate] = { total: 0, paid: 0, failed: 0, cancelled: 0, other: 0, paidAmount: 0 };
      byDay[ksaDate].total++;
      const isPaid = o.status === 'paid' || o.status === 'completed' || (o.payments && o.payments.some(p => p.status === 'paid'));
      if (isPaid) {
        byDay[ksaDate].paid++;
        byDay[ksaDate].paidAmount += (o.totalAmount || o.amount || 0);
      } else if (o.status === 'cancelled') {
        byDay[ksaDate].cancelled++;
      } else if (o.status === 'failed') {
        byDay[ksaDate].failed++;
      } else {
        byDay[ksaDate].other++;
      }
    }
    console.log('\nRenewal orders breakdown by KSA date:');
    console.table(byDay);

    console.log('\nRenewal orders by KSA date & hour (Sep 5 to Sep 13):');
    const byDayHour = {};
    for (const o of renewals) {
      const ksaIso = new Date(o.createdAt.getTime() + 3 * 3600 * 1000).toISOString();
      const ksaDate = ksaIso.slice(0, 10);
      if (ksaDate >= '2026-09-05' && ksaDate <= '2026-09-13') {
        const hour = ksaIso.slice(11, 13);
        const key = `${ksaDate} ${hour}:00`;
        byDayHour[key] = (byDayHour[key] || 0) + 1;
      }
    }
    console.table(byDayHour);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
