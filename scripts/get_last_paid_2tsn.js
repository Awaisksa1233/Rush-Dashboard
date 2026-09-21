import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const lastPaid = await db.collection('rushwash_sale_orders').findOne({
      normalizedPlate: { $regex: /2TSN/i },
      status: { $in: ['paid', 'active'] }
    }, { sort: { createdAt: -1 } });

    console.log('Last Paid Order for 2TSN:');
    console.log(JSON.stringify(lastPaid, null, 2));

  } finally {
    await client.close();
  }
}

main().catch(console.error);
