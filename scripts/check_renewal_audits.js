import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const renewalEvents = await db.collection('rushwash_audit_events').find({
      eventType: { $in: ['subscription.renewed', 'payment.charge_failed', 'payment.charge_succeeded'] },
      occurredAt: { $gte: new Date('2026-09-08T00:00:00.000Z') }
    }).sort({ occurredAt: -1 }).toArray();

    console.log(`Found ${renewalEvents.length} payment/renewal audit events since Sep 8:`);
    for (const e of renewalEvents) {
      console.log(`${e.occurredAt?.toISOString()} | ${e.eventType} | ${e.entityType} | ${e.entityReadableCode} | Actor: ${e.actorReadableCode || e.actorType || 'system'} | Details: ${JSON.stringify(e.data || e.payload || {}).slice(0, 150)}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
