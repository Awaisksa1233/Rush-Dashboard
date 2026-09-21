import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('=== AUG 27 AROUND 07:04 AM KSA (04:00 - 04:10 UTC) FOR 179 SAR ===');
    const aug27Orders = await db.collection('rushwash_sale_orders').find({
      createdAt: {
        $gte: new Date('2026-08-27T04:00:00.000Z'),
        $lte: new Date('2026-08-27T04:15:00.000Z')
      },
      postDiscountTotal: 179
    }).toArray();

    for (const o of aug27Orders) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: o.customerId });
      const ksaTime = new Date(new Date(o.createdAt).getTime() + 3 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      console.log(`Order: ${o.readableCode} | KSA Time: ${ksaTime} | Status: ${o.status} | Plate: ${o.normalizedPlate}`);
      console.log(`  Customer: ${cust?.name} | Phone: ${cust?.phone} | Code: ${cust?.readableCode} | Email: ${cust?.email}`);
      console.log(`  Instruments:`, JSON.stringify(cust?.moyasarPaymentInstruments || cust?.moyasarPaymentInstrument, null, 2));
      console.log(`  Payments:`, JSON.stringify(o.payments, null, 2));
      console.log('---');
    }

    console.log('\n=== SEP 3 AROUND 07:01 AM KSA (04:00 - 04:05 UTC) FOR 100 SAR ===');
    const sep3Orders = await db.collection('rushwash_sale_orders').find({
      createdAt: {
        $gte: new Date('2026-09-03T04:00:00.000Z'),
        $lte: new Date('2026-09-03T04:05:00.000Z')
      },
      postDiscountTotal: 100
    }).toArray();

    for (const o of sep3Orders) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: o.customerId });
      const ksaTime = new Date(new Date(o.createdAt).getTime() + 3 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      console.log(`Order: ${o.readableCode} | KSA Time: ${ksaTime} | Status: ${o.status} | Plate: ${o.normalizedPlate}`);
      console.log(`  Customer: ${cust?.name} | Phone: ${cust?.phone} | Code: ${cust?.readableCode} | Email: ${cust?.email}`);
      console.log(`  Instruments:`, JSON.stringify(cust?.moyasarPaymentInstruments || cust?.moyasarPaymentInstrument, null, 2));
      console.log(`  Payments:`, JSON.stringify(o.payments, null, 2));
      console.log('---');
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
