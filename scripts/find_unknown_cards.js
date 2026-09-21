import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const targetCodes = ['CUS-02094', 'CUS-10940', 'CUS-10169', 'CUS-01815', 'CUS-02548'];
    for (const code of targetCodes) {
      const cust = await db.collection('rushwash_customers').findOne({ readableCode: code });
      console.log(`\n=== CUSTOMER ${code} (${cust?.name} / ${cust?.phone}) ===`);
      const allOrders = await db.collection('rushwash_sale_orders').find({ customerId: cust._id }).sort({ createdAt: 1 }).toArray();
      allOrders.forEach(o => {
        console.log(`- Order: ${o.readableCode} | Date: ${o.createdAt} | Status: ${o.status} | Payments:`, JSON.stringify(o.payments));
      });
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
