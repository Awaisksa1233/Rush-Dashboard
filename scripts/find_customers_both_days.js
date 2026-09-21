import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('Finding customers who had an order on Aug 27 AND an order on Sep 3...');

    // Get all orders on Aug 27 (full day)
    const aug27Orders = await db.collection('rushwash_sale_orders').find({
      createdAt: {
        $gte: new Date('2026-08-27T00:00:00.000Z'),
        $lte: new Date('2026-08-27T23:59:59.999Z')
      }
    }).toArray();

    // Get all orders on Sep 3 (full day)
    const sep3Orders = await db.collection('rushwash_sale_orders').find({
      createdAt: {
        $gte: new Date('2026-09-03T00:00:00.000Z'),
        $lte: new Date('2026-09-03T23:59:59.999Z')
      }
    }).toArray();

    console.log(`Aug 27 orders: ${aug27Orders.length}`);
    console.log(`Sep 3 orders: ${sep3Orders.length}`);

    // Map customer IDs on Aug 27
    const aug27ByCust = new Map();
    for (const o of aug27Orders) {
      const cid = String(o.customerId);
      if (!aug27ByCust.has(cid)) aug27ByCust.set(cid, []);
      aug27ByCust.get(cid).push(o);
    }

    const matchedCids = new Set();
    for (const o of sep3Orders) {
      const cid = String(o.customerId);
      if (aug27ByCust.has(cid)) {
        matchedCids.add(cid);
      }
    }

    console.log(`\nCustomers with orders on BOTH Aug 27 and Sep 3: ${matchedCids.size}`);
    for (const cid of matchedCids) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: new (await import('mongodb')).ObjectId(cid) });
      console.log(`\n--- Customer: ${cust?.name} (${cust?.phone}) | Code: ${cust?.readableCode} | Email: ${cust?.email} ---`);
      console.log('Cards on Customer:', JSON.stringify(cust?.moyasarPaymentInstruments || cust?.moyasarPaymentInstrument));

      console.log('Aug 27 Orders:');
      for (const o of aug27ByCust.get(cid)) {
        console.log(`  Order ${o.readableCode} | Status: ${o.status} | Total: ${o.postDiscountTotal} | Plate: ${o.normalizedPlate} | Time: ${o.createdAt}`);
        console.log(`    Payments:`, JSON.stringify(o.payments));
      }

      console.log('Sep 3 Orders:');
      const sepOrdersForCust = sep3Orders.filter(o => String(o.customerId) === cid);
      for (const o of sepOrdersForCust) {
        console.log(`  Order ${o.readableCode} | Status: ${o.status} | Total: ${o.postDiscountTotal} | Plate: ${o.normalizedPlate} | Time: ${o.createdAt}`);
        console.log(`    Payments:`, JSON.stringify(o.payments));
      }
    }

    // Also check if any customer had 179 on Aug 27 and 100 on Sep 3 specifically
    console.log('\n--- Checking specific 179 on Aug 27 and 100 on Sep 3 ---');
    for (const cid of matchedCids) {
      const has179OnAug27 = aug27ByCust.get(cid).some(o => o.postDiscountTotal === 179);
      const has100OnSep3 = sep3Orders.filter(o => String(o.customerId) === cid).some(o => o.postDiscountTotal === 100);
      if (has179OnAug27 && has100OnSep3) {
        console.log(`>>> EXACT MATCH FOUND for customer ${cid}! <<<`);
      }
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
