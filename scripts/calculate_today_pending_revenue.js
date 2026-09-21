import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const sep10Start = new Date('2026-09-09T21:00:00.000Z');
    const sep10End = new Date('2026-09-10T20:59:59.999Z');

    const subs = await db.collection('rushwash_subscriptions').find({
      renewalDate: { $gte: sep10Start, $lte: sep10End },
      status: 'active'
    }).toArray();

    let totalWithToken = 0;
    let revWithToken = 0;
    let totalWithoutToken = 0;
    let revWithoutToken = 0;

    for (const s of subs) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: s.customerId });
      const insts = cust?.moyasarPaymentInstruments || (cust?.moyasarPaymentInstrument ? [cust.moyasarPaymentInstrument] : []);
      const hasToken = insts.length > 0 && insts.some(i => i.token || i.id);
      const price = s.price || s.recurringPrice || s.packageSnapshot?.price || 0;

      if (hasToken) {
        totalWithToken++;
        revWithToken += price;
      } else {
        totalWithoutToken++;
        revWithoutToken += price;
      }
    }

    console.log(`Active subs due today with token: ${totalWithToken} (SAR ${revWithToken.toFixed(2)})`);
    console.log(`Active subs due today without token: ${totalWithoutToken} (SAR ${revWithoutToken.toFixed(2)})`);
    console.log(`Total active pending renewal today: ${subs.length} (SAR ${(revWithToken + revWithoutToken).toFixed(2)})`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
