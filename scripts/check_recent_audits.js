import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');
    
    // Find audit events from Sep 8 onwards
    const audits = await db.collection('rushwash_audit_events').find({
      occurredAt: { $gte: new Date('2026-09-08T00:00:00.000Z') }
    }).sort({ occurredAt: -1 }).limit(30).toArray();

    console.log(`Found ${audits.length} audit events since Sep 8:`);
    for (const a of audits) {
      console.log(`${a.occurredAt?.toISOString?.() || a.occurredAt} | ${a.eventType} | ${a.entityType} | ${a.entityReadableCode || a.readableCode || ''} | ${a.summary || a.action || ''}`);
    }

    // Check unique eventTypes since Sep 1
    const eventTypes = await db.collection('rushwash_audit_events').distinct('eventType', {
      occurredAt: { $gte: new Date('2026-09-01T00:00:00.000Z') }
    });
    console.log('\nEvent types since Sep 1:', eventTypes);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
