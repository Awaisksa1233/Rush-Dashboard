import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('--- Connected to Atlas DB rushwash ---');

    // 1. Orders created today (2026-09-10 UTC & KSA)
    // 2026-09-10 00:00:00 KSA is 2026-09-09 21:00:00 UTC
    const startOfTodayUtc = new Date('2026-09-09T21:00:00.000Z');
    const endOfTodayUtc = new Date('2026-09-10T21:00:00.000Z');

    const todayOrders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: startOfTodayUtc }
    }).sort({ createdAt: -1 }).toArray();

    console.log(`\nOrders created since start of today (2026-09-10 KSA): ${todayOrders.length}`);
    for (const o of todayOrders.slice(0, 10)) {
      console.log(`Order ${o.readableCode} | Created: ${o.createdAt?.toISOString?.() || o.createdAt} | Status: ${o.status} | Total: ${o.postDiscountTotal} | isRenewal: ${o.isRenewal}`);
    }

    // 2. Subscriptions with renewalDate on 2026-09-10
    // Check range around 2026-09-10
    const startOfDay = new Date('2026-09-10T00:00:00.000Z');
    const endOfDay = new Date('2026-09-10T23:59:59.999Z');

    // Also check previous days (e.g. 2026-09-08, 2026-09-09, 2026-09-10)
    const dueSubscriptions = await db.collection('rushwash_subscriptions').find({
      renewalDate: {
        $gte: new Date('2026-09-09T00:00:00.000Z'),
        $lte: new Date('2026-09-11T00:00:00.000Z')
      }
    }).toArray();

    console.log(`\nSubscriptions with renewalDate between Sep 9 and Sep 11: ${dueSubscriptions.length}`);
    for (const s of dueSubscriptions) {
      console.log(`Sub ${s.readableCode} | Status: ${s.status} | autoRenew: ${s.autoRenew} | renewalDate: ${s.renewalDate?.toISOString?.() || s.renewalDate} | nextRenewalDate: ${s.nextRenewalDate?.toISOString?.() || s.nextRenewalDate}`);
    }

    // 3. Subscriptions that are expired or active with renewalDate <= now
    const now = new Date('2026-09-10T12:26:00.000Z');
    const overdueActive = await db.collection('rushwash_subscriptions').find({
      status: 'active',
      renewalDate: { $lte: now }
    }).count();
    console.log(`\nActive subscriptions with renewalDate <= now: ${overdueActive}`);

    // 4. Check the latest renewal orders in sale_orders
    console.log('\n--- Checking latest renewal orders (isRenewal: true or renewal in lines) ---');
    const latestRenewals = await db.collection('rushwash_sale_orders').find({
      $or: [
        { isRenewal: true },
        { isRenewal: 1 },
        { 'lines.isRenewal': true },
        { 'lines.type': 'renewal' },
        { orderType: 'renewal' }
      ]
    }).sort({ createdAt: -1 }).limit(10).toArray();

    console.log(`Found ${latestRenewals.length} latest renewal orders:`);
    for (const r of latestRenewals) {
      console.log(`Order ${r.readableCode} | Created: ${r.createdAt?.toISOString?.() || r.createdAt} | Status: ${r.status} | Customer: ${r.customerId} | Plate: ${r.normalizedPlate}`);
    }

    // 5. Let's check audit events or system logs for today
    const auditCollections = ['rushwash_audit_events', 'rushwash_api_configs'];
    for (const colName of auditCollections) {
      const count = await db.collection(colName).countDocuments();
      console.log(`\nCollection ${colName} count: ${count}`);
    }

    const latestAudits = await db.collection('rushwash_audit_events').find().sort({ createdAt: -1 }).limit(5).toArray();
    console.log('\nLatest audit events:');
    for (const a of latestAudits) {
      console.log(JSON.stringify(a).slice(0, 200));
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

main();
