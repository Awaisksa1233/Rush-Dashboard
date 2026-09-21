import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // Search for payment_link.created on Sep 10
    const createdEvents = await db.collection('rushwash_audit_events').find({
      eventType: { $regex: /payment_link/ },
      occurredAt: { $gte: new Date('2026-09-10T00:00:00Z') }
    }).toArray();

    console.log(`Found ${createdEvents.length} payment_link events on Sep 10:`);
    for (const e of createdEvents) {
      console.log(JSON.stringify(e, null, 2));
    }

    // Also search for any audit event on Sep 10 that mentions "portal_save_card" or "PORTAL-SAVE"
    const portalEvents = await db.collection('rushwash_audit_events').find({
      $or: [
        { 'after.purpose': 'portal_save_card' },
        { 'after.orderReadableCode': 'PORTAL-SAVE' },
        { 'data.purpose': 'portal_save_card' }
      ]
    }).toArray();

    console.log(`\nFound ${portalEvents.length} portal_save_card events:`);
    for (const pe of portalEvents) {
      console.log(JSON.stringify(pe, null, 2));
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
