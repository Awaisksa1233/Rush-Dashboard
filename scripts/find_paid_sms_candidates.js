import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('=== ALL PAID 179 SAR ORDERS ON 27 AUG 2026 (04:00 - 04:05 UTC) ===');
    const augPaid179 = await db.collection('rushwash_sale_orders').find({
      createdAt: {
        $gte: new Date('2026-08-27T04:00:00.000Z'),
        $lte: new Date('2026-08-27T04:05:00.000Z')
      },
      postDiscountTotal: 179,
      status: { $in: ['paid', 'active'] }
    }).toArray();

    for (const o of augPaid179) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: o.customerId });
      const ksaTime = new Date(new Date(o.createdAt).getTime() + 3 * 3600 * 1000).toISOString().replace('T', ' ').slice(11, 19);
      console.log(`Order: ${o.readableCode} | Time KSA: ${ksaTime} | Plate: ${o.normalizedPlate} | Sub: ${o.subscriptionReadableCode}`);
      console.log(`  Customer: ${cust?.name} | Phone: ${cust?.phone} | Code: ${cust?.readableCode}`);
      console.log(`  Payments:`, JSON.stringify(o.payments));
      console.log(`  Customer Cards:`, JSON.stringify(cust?.moyasarPaymentInstruments || cust?.moyasarPaymentInstrument));
      console.log('---');
    }

    console.log('\n=== ALL PAID 100 SAR ORDERS ON 03 SEP 2026 (04:00 - 04:05 UTC) ===');
    const sepPaid100 = await db.collection('rushwash_sale_orders').find({
      createdAt: {
        $gte: new Date('2026-09-03T04:00:00.000Z'),
        $lte: new Date('2026-09-03T04:05:00.000Z')
      },
      postDiscountTotal: 100,
      status: { $in: ['paid', 'active'] }
    }).toArray();

    for (const o of sepPaid100) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: o.customerId });
      const ksaTime = new Date(new Date(o.createdAt).getTime() + 3 * 3600 * 1000).toISOString().replace('T', ' ').slice(11, 19);
      console.log(`Order: ${o.readableCode} | Time KSA: ${ksaTime} | Plate: ${o.normalizedPlate} | Sub: ${o.subscriptionReadableCode}`);
      console.log(`  Customer: ${cust?.name} | Phone: ${cust?.phone} | Code: ${cust?.readableCode}`);
      console.log(`  Payments:`, JSON.stringify(o.payments));
      console.log(`  Customer Cards:`, JSON.stringify(cust?.moyasarPaymentInstruments || cust?.moyasarPaymentInstrument));
      console.log('---');
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
