import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    for (const code of ['CUS-10940', 'CUS-10169', 'CUS-02094']) {
      const cust = await db.collection('rushwash_customers').findOne({ readableCode: code });
      console.log(`\n=== ${code} (${cust?.name} / ${cust?.phone}) ===`);
      const orders = await db.collection('rushwash_sale_orders').find({ customerId: cust._id }).toArray();
      orders.forEach(o => {
        console.log(`Order: ${o.readableCode} | Date: ${o.createdAt} | Status: ${o.status}`);
        console.log(`  Payments:`, JSON.stringify(o.payments, null, 2));
      });
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
