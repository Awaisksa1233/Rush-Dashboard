import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    
    // Check databases
    const admin = client.db().admin();
    const dbs = await admin.listDatabases();
    console.log('Databases:', dbs.databases.map(d => d.name));

    const db = client.db('rushwash');
    const cols = await db.listCollections().toArray();
    console.log('rushwash collections:', cols.map(c => c.name).sort());

    const rushControl = client.db('rush_control');
    const rcCols = await rushControl.listCollections().toArray();
    console.log('rush_control collections:', rcCols.map(c => c.name).sort());

  } finally {
    await client.close();
  }
}

main().catch(console.error);
