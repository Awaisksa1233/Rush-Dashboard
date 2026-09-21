import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const sample = await db.collection('rushwash_sale_orders').findOne({
      createdAt: { $gte: new Date('2026-09-10T00:00:00.000Z') },
      isRenewal: true
    });
    console.log('Sample renewal order keys:', Object.keys(sample));
    console.log('Sample order summary:', {
      readableCode: sample.readableCode,
      total: sample.total,
      totalAmount: sample.totalAmount,
      grandTotal: sample.grandTotal,
      subtotal: sample.subtotal,
      status: sample.status,
      payments: sample.payments,
      notes: sample.notes,
      subscriptionId: sample.subscriptionId,
      subscriptionReadableCode: sample.subscriptionReadableCode,
      createdAt: sample.createdAt
    });

    // Check audit events for retry / renewal jobs
    const auditEvents = await db.collection('rushwash_audit_events').find({
      occurredAt: { $gte: new Date('2026-09-05T00:00:00.000Z') }
    }).sort({ occurredAt: -1 }).limit(20).toArray();

    console.log('\nAudit event types since Sep 5:');
    const eventTypes = await db.collection('rushwash_audit_events').distinct('eventType', {
      occurredAt: { $gte: new Date('2026-09-05T00:00:00.000Z') }
    });
    console.log('Distinct eventTypes:', eventTypes);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
