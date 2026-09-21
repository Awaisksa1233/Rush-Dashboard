import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const custs = await db.collection('rushwash_customers').find({
      $or: [
        { 'moyasarPaymentInstruments.lastFour': '1624' },
        { 'moyasarPaymentInstrument.lastFour': '1624' }
      ]
    }).toArray();

    console.log(`Total customers with card 1624: ${custs.length}`);
    for (const c of custs) {
      console.log(`- ${c.name} | Phone: ${c.phone} | Code: ${c.readableCode} | ID: ${c._id}`);
      const insts = c.moyasarPaymentInstruments || [c.moyasarPaymentInstrument];
      const inst1624 = insts.filter(i => i?.lastFour === '1624');
      console.log('  1624 Card Details:', JSON.stringify(inst1624));
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
