import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const corrIds = ['eb6e9b28-f382-4111-92d8-8a8ea20250d7', 'e3fb937b-f5e1-414b-a115-4ec413ed52cf'];

    const allEventsWithCorr = await db.collection('rushwash_audit_events').find({
      correlationId: { $in: corrIds }
    }).toArray();

    console.log(`Found ${allEventsWithCorr.length} audit events with these correlationIds:`);
    for (const e of allEventsWithCorr) {
      console.log(JSON.stringify(e, null, 2));
    }

    // Also check what audit events happened between 14:35:00 and 14:37:00
    const nearbyEvents = await db.collection('rushwash_audit_events').find({
      occurredAt: {
        $gte: new Date('2026-09-10T14:35:20Z'),
        $lte: new Date('2026-09-10T14:37:00Z')
      }
    }).sort({ occurredAt: 1 }).toArray();

    console.log(`\nFound ${nearbyEvents.length} nearby audit events:`);
    for (const ne of nearbyEvents) {
      console.log(`${ne.occurredAt?.toISOString()} | ${ne.eventId} | ${ne.eventType} | ${ne.entityType} | ${ne.entityReadableCode} | ${JSON.stringify(ne.after || {})}`);
    }

    // Check all orders with ORD-27530 to ORD-27550
    const recentOrders = await db.collection('rushwash_sale_orders').find({
      readableCode: { $gte: 'ORD-27530' }
    }).sort({ readableCode: 1 }).toArray();

    console.log(`\nOrders from ORD-27530 onwards (${recentOrders.length}):`);
    for (const ro of recentOrders) {
      const pmt = (ro.payments || [])[0] || {};
      console.log(`${ro.readableCode} | ${ro.createdAt?.toISOString()} | ${ro.status} | Sub: ${ro.subscriptionReadableCode} | Plate: ${ro.normalizedPlate} | PmtId: ${pmt.providerPaymentId} | PmtStatus: ${pmt.status} | Amt: ${ro.postDiscountTotal}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
