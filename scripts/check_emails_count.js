import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const totalCusts = await db.collection('rushwash_customers').countDocuments();
    const withEmail = await db.collection('rushwash_customers').countDocuments({
      email: { $exists: true, $ne: null, $nin: ['', 'null', 'undefined'] }
    });
    console.log(`Total customers: ${totalCusts} | Customers with email in DB: ${withEmail}`);

    const sampleEmails = await db.collection('rushwash_customers').find({
      email: { $exists: true, $ne: null, $nin: ['', 'null', 'undefined'] }
    }).limit(10).project({ readableCode: 1, name: 1, phone: 1, email: 1 }).toArray();
    console.log('Sample emails:', sampleEmails);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
