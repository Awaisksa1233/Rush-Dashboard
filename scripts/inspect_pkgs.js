import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const pkgs = await db.collection('rushwash_service_packages').find().toArray();
    console.log('Packages:');
    for (const p of pkgs) {
      console.log(p.readableCode, p.name);
    }

    const c = await db.collection('rushwash_customers').findOne({ readableCode: 'CUS-04870' });
    console.log('CUS-04870 instruments:', JSON.stringify(c.moyasarPaymentInstruments || c.moyasarPaymentInstrument, null, 2));

  } finally {
    await client.close();
  }
}

main();
