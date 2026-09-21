import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // 1. Check the 4 audit events with entityReadableCode: '3b35d496-b866-42bb-9774-1ae2ebf74212'
    const paymentId = '3b35d496-b866-42bb-9774-1ae2ebf74212';
    const audits = await db.collection('rushwash_audit_events').find({
      entityReadableCode: paymentId
    }).toArray();

    console.log('=== AUDIT EVENTS FOR PAYMENT ID ===');
    console.log(JSON.stringify(audits, null, 2));

    // 2. Look at orders created between 14:36:10 and 14:36:25 UTC
    const ordersAround = await db.collection('rushwash_sale_orders').find({
      createdAt: {
        $gte: new Date('2026-09-10T14:36:10Z'),
        $lte: new Date('2026-09-10T14:36:25Z')
      }
    }).toArray();

    console.log(`\n=== SALE ORDERS CREATED AT 14:36:10 - 14:36:25 UTC (${ordersAround.length} orders) ===`);
    for (const o of ordersAround) {
      console.log(JSON.stringify(o, null, 2));
    }

    // 3. Search the entire database for this paymentId string in ANY field
    console.log('\n=== DEEP SEARCH FOR paymentId ACROSS ALL COLLECTIONS ===');
    const cols = await db.listCollections().toArray();
    for (const c of cols) {
      const col = db.collection(c.name);
      // Search with regex or exact match
      const doc = await col.findOne({
        $or: [
          { paymentId: paymentId },
          { id: paymentId },
          { providerPaymentId: paymentId },
          { reference: paymentId },
          { entityReadableCode: paymentId },
          { 'payments.providerPaymentId': paymentId }
        ]
      });
      if (doc) {
        console.log(`Found match in collection: ${c.name}, _id: ${doc._id}`);
      }
    }

    // 4. What was the highest order number created today?
    const highestOrder = await db.collection('rushwash_sale_orders').find().sort({ createdAt: -1 }).limit(1).toArray();
    console.log('\nLatest order in DB:', highestOrder[0]?.readableCode, highestOrder[0]?.createdAt);

    // 5. Total orders created today during the batch (14:27 to 14:40 UTC)
    const batchOrdersCount = await db.collection('rushwash_sale_orders').countDocuments({
      createdAt: { $gte: new Date('2026-09-10T14:27:00Z') }
    });
    console.log(`Total orders in the 14:27+ UTC batch: ${batchOrdersCount}`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
