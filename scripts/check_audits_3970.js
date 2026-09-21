import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const custId = new ObjectId('6a8a304326e5d7aeaaba2cdb');

    console.log('=== AUDIT EVENTS FOR CUSTOMER OR CARD 3970 ===');
    const audits = await db.collection('rushwash_audit_events').find({
      $or: [
        { customerId: custId },
        { 'payload.customerId': custId },
        { 'payload.lastFour': '3970' },
        { 'payload.tokenId': 'token_jJ8QCyhFUY1HXcK8X4d2VVoxzB' }
      ]
    }).sort({ createdAt: -1 }).toArray();

    console.log(`Audit events found: ${audits.length}`);
    for (const a of audits) {
      console.log(`- ${a.createdAt} | Action: ${a.action || a.event} | Type: ${a.entityType || a.type}`);
      console.log(`  Payload:`, JSON.stringify(a.payload || a.details));
    }

    console.log('\n=== CHECK ALL ORDERS FOR CUS-04428 DETAILS ===');
    const orders = await db.collection('rushwash_sale_orders').find({ customerId: custId }).sort({ createdAt: 1 }).toArray();
    for (const o of orders) {
      console.log(`\n--- Order: ${o.readableCode} ---`);
      console.log(`Date: ${o.createdAt}`);
      console.log(`Status: ${o.status}`);
      console.log(`Total: ${o.postDiscountTotal} SAR`);
      console.log(`Normalized Plate: ${o.normalizedPlate}`);
      console.log(`Lines:`, JSON.stringify(o.lines || o.lineSnapshots));
      console.log(`Payments:`, JSON.stringify(o.payments, null, 2));
      console.log(`Refund:`, JSON.stringify(o.refund));
      console.log(`Notes: ${o.notes}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
