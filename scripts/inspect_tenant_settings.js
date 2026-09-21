import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');
    const settings = await db.collection('rushwash_tenant_settings').find().toArray();
    console.log('Tenant settings:', JSON.stringify(settings, null, 2));
  } finally {
    await client.close();
  }
}

main().catch(console.error);
