import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const ord27391 = await db.collection('rushwash_sale_orders').findOne({ readableCode: 'ORD-27391' });
    console.log('ORD-27391:', JSON.stringify(ord27391, null, 2));

    const ord27232 = await db.collection('rushwash_sale_orders').findOne({ readableCode: 'ORD-27232' });
    console.log('ORD-27232 (from Sep 9):', JSON.stringify(ord27232, null, 2));

  } finally {
    await client.close();
  }
}

main().catch(console.error);
