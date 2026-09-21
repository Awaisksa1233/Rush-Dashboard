import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const linkEvents = await db.collection('rushwash_audit_events').find({
      eventType: { $in: ['payment_link.created', 'payment_link.paid', 'payment_link.failed'] },
      occurredAt: { $gte: new Date('2026-09-04T21:00:00.000Z'), $lte: new Date('2026-09-12T21:00:00.000Z') }
    }).toArray();

    console.log(`Payment link audit events between Sep 5 and Sep 12: ${linkEvents.length}`);
    for (const e of linkEvents) {
      console.log(`${e.occurredAt.toISOString()} | ${e.eventType} | ${e.entityReadableCode} | ${JSON.stringify(e.data || e.payload || {})}`);
    }

    // Also check if any orders have provider: 'moyasar' with paymentMethodIdentityKey: 'payment_link'
    const linkOrders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: new Date('2026-09-04T21:00:00.000Z'), $lte: new Date('2026-09-12T21:00:00.000Z') },
      'payments.paymentMethodIdentityKey': { $regex: /link|portal/i }
    }).toArray();
    console.log(`Orders with link/portal payment between Sep 5 and Sep 12: ${linkOrders.length}`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
