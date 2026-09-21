import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const collections = await db.listCollections().toArray();
    console.log('Searching all collections for 3970 and Xyz1431677...');

    for (const col of collections) {
      const colName = col.name;
      const count3970 = await db.collection(colName).countDocuments({
        $or: [
          { $text: { $search: '3970' } }
        ]
      }).catch(() => null);

      // Search by regex on common fields
      const docs = await db.collection(colName).find({
        $or: [
          { readableCode: /3970/ },
          { phone: /3970/ },
          { mobile: /3970/ },
          { normalizedPlate: /3970/ },
          { displayPlate: /3970/ },
          { email: /xyz/i },
          { email: /1431677/ },
          { 'moyasarPaymentInstruments.lastFour': '3970' },
          { 'moyasarPaymentInstrument.lastFour': '3970' },
          { 'payments.paymentToken': 'token_jJ8QCyhFUY1HXcK8X4d2VVoxzB' }
        ]
      }).toArray().catch(() => []);

      if (docs.length > 0) {
        console.log(`Collection [${colName}] matched ${docs.length} docs:`);
        for (const d of docs) {
          console.log(`  _id: ${d._id}, readableCode: ${d.readableCode}, phone: ${d.phone}, name: ${d.name}, plate: ${d.normalizedPlate || d.displayPlate}`);
        }
      }
    }

    console.log('\n=== CHECKING IF ANY ORDER ON AUG 27 AT 07:04:xx EXISTED ===');
    const aug27Orders = await db.collection('rushwash_sale_orders').find({
      createdAt: {
        $gte: new Date('2026-08-27T04:03:00.000Z'),
        $lte: new Date('2026-08-27T04:05:30.000Z')
      }
    }).toArray();
    console.log(`Aug 27 orders between 07:03 and 07:05:30 KSA: ${aug27Orders.length}`);
    for (const o of aug27Orders) {
      console.log(`- ${o.readableCode} | ${o.createdAt.toISOString()} | ${o.postDiscountTotal} SAR | ${o.status} | Plate: ${o.normalizedPlate} | Cust: ${o.customerId}`);
    }

    console.log('\n=== CHECKING IF ANY ORDER ON SEP 3 AT 07:01:xx EXISTED ===');
    const sep3Orders = await db.collection('rushwash_sale_orders').find({
      createdAt: {
        $gte: new Date('2026-09-03T04:00:50.000Z'),
        $lte: new Date('2026-09-03T04:02:00.000Z')
      }
    }).toArray();
    console.log(`Sep 3 orders between 07:00:50 and 07:02:00 KSA: ${sep3Orders.length}`);
    for (const o of sep3Orders) {
      console.log(`- ${o.readableCode} | ${o.createdAt.toISOString()} | ${o.postDiscountTotal} SAR | ${o.status} | Plate: ${o.normalizedPlate} | Cust: ${o.customerId}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
