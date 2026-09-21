import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const subs = await db.collection('rushwash_subscriptions').find({
      readableCode: { $in: ['SUB-33411', 'SUB-33415', 'SUB-33421', 'SUB-33423', 'SUB-33426'] }
    }).toArray();

    for (const s of subs) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: s.customerId });
      const inst = cust?.moyasarPaymentInstruments || (cust?.moyasarPaymentInstrument ? [cust.moyasarPaymentInstrument] : []);
      const token = inst[0]?.tokenId || inst[0]?.token || inst[0]?.id;
      console.log(`${s.readableCode} | status: ${s.status} | price: ${s.price} | token: ${token || 'NONE'}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
