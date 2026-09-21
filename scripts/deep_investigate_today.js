import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('================================================================');
    console.log('INVESTIGATION: TODAY (2026-09-10) RENEWAL EXECUTION & PAST DAYS');
    console.log('================================================================');

    // 1. Inspect orders created today (Sep 10 UTC)
    const todayOrders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: new Date('2026-09-09T21:00:00.000Z') }
    }).sort({ createdAt: 1 }).toArray();

    console.log(`\nTotal orders created today (since 2026-09-09 21:00 UTC / 00:00 KSA): ${todayOrders.length}`);
    for (const o of todayOrders) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: o.customerId });
      const payments = o.payments || [];
      const p = payments[0] || {};
      console.log(`Order ${o.readableCode} | Time UTC: ${o.createdAt?.toISOString?.()} | Status: ${o.status} | Total: ${o.postDiscountTotal} SAR | Sub: ${o.subscriptionReadableCode || o.subCode || 'None'} | Customer: ${cust?.name} (${cust?.phone}) | FailReason: ${p.failureReason || o.cancellationReason || 'N/A'}`);
      if (payments.length > 0) {
        console.log(`   Payment details: status=${p.status}, gateway=${p.gateway || p.provider}, message=${p.gatewayMessage || p.message || p.gatewayResponse?.message || p.statusDescription || p.failureReason}`);
      }
    }

    // 2. Breakdown of daily renewal orders from Sep 1 to Sep 10
    console.log('\n--- Daily Renewal Batch Counts (Sep 1 to Sep 10, 2026) ---');
    const startSep1 = new Date('2026-09-01T00:00:00.000Z');
    const allRenewals = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: startSep1 },
      $or: [
        { isRenewal: true },
        { isRenewal: 1 },
        { orderType: 'renewal' }
      ]
    }).sort({ createdAt: 1 }).toArray();

    const dailyGroups = {};
    for (const r of allRenewals) {
      // Group by KSA date (UTC + 3 hours)
      const ksaDate = new Date(r.createdAt.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10);
      if (!dailyGroups[ksaDate]) {
        dailyGroups[ksaDate] = { total: 0, paid: 0, cancelled: 0, other: 0, timesUTC: [] };
      }
      dailyGroups[ksaDate].total++;
      if (r.status === 'paid' || r.status === 'completed') dailyGroups[ksaDate].paid++;
      else if (r.status === 'cancelled') dailyGroups[ksaDate].cancelled++;
      else dailyGroups[ksaDate].other++;
      dailyGroups[ksaDate].timesUTC.push(r.createdAt.toISOString().slice(11, 19));
    }

    for (const [date, data] of Object.entries(dailyGroups)) {
      const uniqueHours = [...new Set(data.timesUTC.map(t => t.slice(0, 2)))].join(', ');
      console.log(`Date: ${date} | Total: ${data.total} | Paid: ${data.paid} | Cancelled: ${data.cancelled} | Other: ${data.other} | Run UTC Hours: ${uniqueHours}`);
    }

    // 3. Subscriptions eligible for renewal today (Sep 10)
    // What subscriptions have renewalDate on 2026-09-10 (or past due and still active)?
    console.log('\n--- Subscriptions with renewalDate on Sep 10, 2026 ---');
    const sep10Start = new Date('2026-09-09T21:00:00.000Z'); // KSA start
    const sep10End = new Date('2026-09-10T20:59:59.999Z');   // KSA end

    const dueTodaySubs = await db.collection('rushwash_subscriptions').find({
      renewalDate: { $gte: sep10Start, $lte: sep10End }
    }).sort({ renewalDate: 1 }).toArray();

    console.log(`Total subscriptions with renewalDate on Sep 10 (KSA): ${dueTodaySubs.length}`);
    const statusCounts = {};
    let withTokenCount = 0;
    let withoutTokenCount = 0;

    for (const s of dueTodaySubs) {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
      const cust = await db.collection('rushwash_customers').findOne({ _id: s.customerId });
      const insts = cust?.moyasarPaymentInstruments || (cust?.moyasarPaymentInstrument ? [cust.moyasarPaymentInstrument] : []);
      const hasToken = insts.length > 0 && insts.some(i => i.token || i.id);
      if (hasToken) withTokenCount++;
      else withoutTokenCount++;
    }

    console.log('Status breakdown of subscriptions due today:', statusCounts);
    console.log(`Token breakdown of subscriptions due today: With Token = ${withTokenCount}, Without Token = ${withoutTokenCount}`);

    // Print details of active ones due today
    console.log('\nActive subscriptions due today:');
    for (const s of dueTodaySubs.filter(s => s.status === 'active')) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: s.customerId });
      const insts = cust?.moyasarPaymentInstruments || (cust?.moyasarPaymentInstrument ? [cust.moyasarPaymentInstrument] : []);
      const token = insts[0]?.token || insts[0]?.id || 'NO_TOKEN';
      // Check if order was created for this sub today
      const order = todayOrders.find(o => (o.subscriptionReadableCode === s.readableCode || o.subCode === s.readableCode));
      console.log(`- Sub: ${s.readableCode} | Customer: ${cust?.name} (${cust?.phone}) | Plan: ${s.planReadableCode || s.packageReadableCode || s.planName} | RenewalDate: ${s.renewalDate?.toISOString()} | Token: ${token.slice(0, 10)}... | OrderCreated: ${order ? order.readableCode + ' (' + order.status + ')' : 'NONE'}`);
    }

    // 4. Overdue active subscriptions (renewalDate < Sep 10 start)
    const overdueActive = await db.collection('rushwash_subscriptions').find({
      status: 'active',
      renewalDate: { $lt: sep10Start }
    }).sort({ renewalDate: 1 }).toArray();

    console.log(`\nActive subscriptions with renewalDate BEFORE Sep 10 (Overdue Active): ${overdueActive.length}`);
    const overdueByDate = {};
    for (const s of overdueActive) {
      const d = s.renewalDate?.toISOString().slice(0, 10) || 'None';
      overdueByDate[d] = (overdueByDate[d] || 0) + 1;
    }
    console.log('Overdue by renewal date:', overdueByDate);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
