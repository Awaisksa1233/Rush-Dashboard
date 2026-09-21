import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('=== 1. SEARCH EMAIL Xyz1431677@gmail.com ===');
    const custByEmail = await db.collection('rushwash_customers').find({
      $or: [
        { email: /xyz1431677/i },
        { 'customerSnapshot.email': /xyz1431677/i }
      ]
    }).toArray();
    console.log(`Customers with email: ${custByEmail.length}`);
    for (const c of custByEmail) {
      console.log(JSON.stringify(c, null, 2));
    }

    console.log('\n=== 2. SEARCH ORDERS ON 2026-08-27 AROUND 07:04 KSA (04:04 UTC) ===');
    const aug27Start = new Date('2026-08-27T04:00:00.000Z');
    const aug27End = new Date('2026-08-27T04:15:00.000Z');
    const ordersAug27 = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: aug27Start, $lte: aug27End }
    }).toArray();
    console.log(`Orders on Aug 27 04:00-04:15 UTC (${ordersAug27.length}):`);
    for (const o of ordersAug27) {
      console.log(`Order: ${o.readableCode} | Time UTC: ${o.createdAt.toISOString()} | Total: ${o.postDiscountTotal} | Plate: ${o.normalizedPlate} | Cust: ${o.customerId}`);
      console.log('  Cust Snapshot:', JSON.stringify(o.customerSnapshot));
      console.log('  Payments:', JSON.stringify(o.payments, null, 2));
      console.log('  Lines:', JSON.stringify(o.lines || o.lineSnapshots));
    }

    console.log('\n=== 3. SEARCH ORDERS ON 2026-09-03 AROUND 07:01 KSA (04:01 UTC) ===');
    const sep3Start = new Date('2026-09-03T04:00:00.000Z');
    const sep3End = new Date('2026-09-03T04:05:00.000Z');
    const ordersSep3 = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: sep3Start, $lte: sep3End }
    }).toArray();
    console.log(`Orders on Sep 3 04:00-04:05 UTC (${ordersSep3.length}):`);
    for (const o of ordersSep3) {
      console.log(`Order: ${o.readableCode} | Time UTC: ${o.createdAt.toISOString()} | Total: ${o.postDiscountTotal} | Status: ${o.status} | Plate: ${o.normalizedPlate} | Cust: ${o.customerId}`);
      console.log('  Cust Snapshot:', JSON.stringify(o.customerSnapshot));
      console.log('  Payments:', JSON.stringify(o.payments, null, 2));
      console.log('  Lines:', JSON.stringify(o.lines || o.lineSnapshots));
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
