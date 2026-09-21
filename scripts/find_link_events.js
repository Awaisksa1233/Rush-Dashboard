import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const linkId = '5a3490cb-d723-45ce-b4da-ab6ecb9aff6f';
    const events = await db.collection('rushwash_audit_events').find({
      entityReadableCode: linkId
    }).sort({ occurredAt: 1 }).toArray();

    console.log(`Events for PaymentLink ${linkId}:`);
    for (const e of events) {
      console.log(JSON.stringify(e, null, 2));
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
