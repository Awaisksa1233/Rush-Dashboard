import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();

    for (const d of dbs.databases) {
      if (['admin', 'local', 'config'].includes(d.name)) continue;
      const db = client.db(d.name);
      const cols = await db.listCollections().toArray();
      for (const col of cols) {
        try {
          const match = await db.collection(col.name).findOne({
            $text: { $search: 'ZhTSb' }
          }).catch(() => null);
          if (match) {
            console.log(`Found text match in ${d.name}.${col.name}!`);
          }
        } catch (e) {}
      }
    }
    console.log('Finished text search across databases.');

  } finally {
    await client.close();
  }
}

main().catch(console.error);
