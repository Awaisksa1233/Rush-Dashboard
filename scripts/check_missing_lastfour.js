import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const custs = await db.collection('rushwash_customers').find({
      $or: [
        { 'moyasarPaymentInstruments': { $exists: true, $ne: [] } },
        { 'moyasarPaymentInstrument': { $exists: true, $ne: null } }
      ]
    }).toArray();

    console.log(`Total customers with cards/tokens: ${custs.length}`);
    let missingLastFour = 0;
    let hasLastFour = 0;
    const tokensMissingLastFour = [];

    for (const c of custs) {
      const insts = c.moyasarPaymentInstruments || (c.moyasarPaymentInstrument ? [c.moyasarPaymentInstrument] : []);
      for (const i of insts) {
        if (!i.lastFour && !i.last4) {
          missingLastFour++;
          tokensMissingLastFour.push({ custCode: c.readableCode, custName: c.name, phone: c.phone, token: i.tokenId, savedAt: i.savedAt });
        } else {
          hasLastFour++;
        }
      }
    }

    console.log(`Cards with lastFour: ${hasLastFour}`);
    console.log(`Cards MISSING lastFour: ${missingLastFour}`);
    console.log(`Sample cards missing lastFour (first 10):`, JSON.stringify(tokensMissingLastFour.slice(0, 10), null, 2));

  } finally {
    await client.close();
  }
}

main().catch(console.error);
