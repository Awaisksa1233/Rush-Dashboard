import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const paymentId = '3b35d496-b866-42bb-9774-1ae2ebf74212';
    const corrIds = ['eb6e9b28-f382-4111-92d8-8a8ea20250d7', 'e3fb937b-f5e1-414b-a115-4ec413ed52cf'];

    console.log('--- Checking Audit Events for paymentId and correlationIds ---');
    const audits = await db.collection('rushwash_audit_events').find({
      $or: [
        { entityReadableCode: paymentId },
        { correlationId: { $in: corrIds } },
        { occurredAt: { $gte: new Date('2026-09-10T14:35:00Z'), $lte: new Date('2026-09-10T14:38:00Z') } }
      ]
    }).sort({ occurredAt: 1 }).toArray();

    console.log(`Found ${audits.length} audit events around 14:36 UTC:`);
    for (const a of audits) {
      console.log(`${a.occurredAt?.toISOString()} | ${a.eventId} | ${a.eventType} | ${a.entityType} | ${a.entityReadableCode} | corr: ${a.correlationId}`);
      if (a.before || a.after || a.details) {
        console.log(`   data: before=${JSON.stringify(a.before)}, after=${JSON.stringify(a.after)}, details=${JSON.stringify(a.details)}`);
      }
    }

    console.log('\n--- Checking Sale Orders created between 14:30 and 14:40 UTC ---');
    const orders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: new Date('2026-09-10T14:30:00Z'), $lte: new Date('2026-09-10T14:40:00Z') }
    }).sort({ createdAt: 1 }).toArray();

    console.log(`Found ${orders.length} sale orders:`);
    for (const o of orders) {
      console.log(JSON.stringify(o, null, 2));
    }

    // Also check if any order has payments matching paymentId in providerPaymentId
    const orderWithPayment = await db.collection('rushwash_sale_orders').findOne({
      'payments.providerPaymentId': paymentId
    });
    console.log('\nOrder with payments.providerPaymentId = paymentId:', orderWithPayment ? JSON.stringify(orderWithPayment, null, 2) : 'NONE FOUND');

    // Check all orders with paymentId anywhere in the doc
    const regexOrders = await db.collection('rushwash_sale_orders').find({
      $text: { $search: paymentId }
    }).toArray().catch(() => []);
    console.log(`Text search matches in orders: ${regexOrders.length}`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
