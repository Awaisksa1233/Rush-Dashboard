import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // Find all customers where moyasarPaymentInstruments has savedAt on 2026-09-10
    const custs = await db.collection('rushwash_customers').find({
      $or: [
        { 'moyasarPaymentInstruments.savedAt': { $regex: /^2026-09-10T14/ } },
        { 'moyasarPaymentInstrument.savedAt': { $regex: /^2026-09-10T14/ } },
        { 'moyasarPaymentInstruments.savedAt': { $gte: new Date('2026-09-10T14:00:00Z') } }
      ]
    }).toArray();

    console.log(`Found ${custs.length} customers with instrument saved at 14:xx UTC today:`);
    for (const c of custs) {
      console.log(`Customer: ${c.readableCode} | Name: ${c.name} | Phone: ${c.phone} | UpdatedAt: ${c.updatedAt}`);
      console.log(JSON.stringify(c.moyasarPaymentInstruments || c.moyasarPaymentInstrument, null, 2));
    }

    // Also search all audit events around 14:36:00 - 14:36:30 for customerId or CUS-
    const auditRange = await db.collection('rushwash_audit_events').find({
      occurredAt: {
        $gte: new Date('2026-09-10T14:36:00Z'),
        $lte: new Date('2026-09-10T14:36:30Z')
      }
    }).toArray();

    console.log(`\nAudit events between 14:36:00 and 14:36:30 (${auditRange.length}):`);
    for (const a of auditRange) {
      console.log(`${a.occurredAt?.toISOString()} | ${a.eventId} | ${a.eventType} | ${a.entityType} | ${a.entityReadableCode} | ${JSON.stringify(a.after || a.data || {})}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
