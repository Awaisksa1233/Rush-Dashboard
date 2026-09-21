import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('=== AUG 27 ORDERS BETWEEN 04:03:30 AND 04:06:00 UTC (07:03:30 - 07:06:00 KSA) ===');
    const aug27Orders = await db.collection('rushwash_sale_orders').find({
      createdAt: {
        $gte: new Date('2026-08-27T04:03:30.000Z'),
        $lte: new Date('2026-08-27T04:06:00.000Z')
      }
    }).sort({ createdAt: 1 }).toArray();

    console.log(`Found ${aug27Orders.length} orders on Aug 27.`);
    for (const o of aug27Orders) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: o.customerId });
      const ksaTime = new Date(new Date(o.createdAt).getTime() + 3 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      console.log(`Order: ${o.readableCode} | KSA: ${ksaTime} | Status: ${o.status} | Total: ${o.postDiscountTotal} | Plate: ${o.normalizedPlate}`);
      console.log(`  Cust: ${cust?.name} (${cust?.phone}) | Code: ${cust?.readableCode} | Email: ${cust?.email}`);
      const insts = cust?.moyasarPaymentInstruments || (cust?.moyasarPaymentInstrument ? [cust.moyasarPaymentInstrument] : []);
      console.log(`  Cards: ${insts.map(i => `${i.brand} *${i.lastFour || i.last4} (${i.tokenId})`).join(', ')}`);
      for (const p of o.payments || []) {
        console.log(`    Payment: status=${p.status} amt=${p.amount} providerId=${p.providerPaymentId} token=${p.paymentToken}`);
      }
    }

    console.log('\n=== SEP 3 ORDERS BETWEEN 04:00:50 AND 04:03:00 UTC (07:00:50 - 07:03:00 KSA) ===');
    const sep3Orders = await db.collection('rushwash_sale_orders').find({
      createdAt: {
        $gte: new Date('2026-09-03T04:00:50.000Z'),
        $lte: new Date('2026-09-03T04:03:00.000Z')
      }
    }).sort({ createdAt: 1 }).toArray();

    console.log(`Found ${sep3Orders.length} orders on Sep 3.`);
    for (const o of sep3Orders) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: o.customerId });
      const ksaTime = new Date(new Date(o.createdAt).getTime() + 3 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      console.log(`Order: ${o.readableCode} | KSA: ${ksaTime} | Status: ${o.status} | Total: ${o.postDiscountTotal} | Plate: ${o.normalizedPlate}`);
      console.log(`  Cust: ${cust?.name} (${cust?.phone}) | Code: ${cust?.readableCode} | Email: ${cust?.email}`);
      const insts = cust?.moyasarPaymentInstruments || (cust?.moyasarPaymentInstrument ? [cust.moyasarPaymentInstrument] : []);
      console.log(`  Cards: ${insts.map(i => `${i.brand} *${i.lastFour || i.last4} (${i.tokenId})`).join(', ')}`);
      for (const p of o.payments || []) {
        console.log(`    Payment: status=${p.status} amt=${p.amount} providerId=${p.providerPaymentId} token=${p.paymentToken}`);
      }
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
