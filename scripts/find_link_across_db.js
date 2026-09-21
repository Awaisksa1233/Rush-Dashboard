import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const target = '5a3490cb-d723-45ce-b4da-ab6ecb9aff6f';
    const cols = await db.listCollections().toArray();

    for (const c of cols) {
      const col = db.collection(c.name);
      const docs = await col.find({
        $or: [
          { _id: target },
          { id: target },
          { paymentLinkId: target },
          { readableCode: target },
          { entityReadableCode: target },
          { 'data.paymentLinkId': target }
        ]
      }).toArray();

      if (docs.length > 0) {
        console.log(`Found in ${c.name}: ${docs.length} docs`);
        for (const d of docs) {
          console.log(JSON.stringify(d, null, 2));
        }
      }
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
