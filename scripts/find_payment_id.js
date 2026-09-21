import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const targetId = '3b35d496-b866-42bb-9774-1ae2ebf74212';
  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    console.log(`Connected to Atlas. Searching for payment ID: ${targetId}...`);

    const dbs = ['rushwash', 'rush_control'];

    for (const dbName of dbs) {
      const db = client.db(dbName);
      const cols = await db.listCollections().toArray();

      for (const colInfo of cols) {
        const col = db.collection(colInfo.name);

        // Search in common fields or regex search in document string
        // Check sale_orders payments specifically
        if (colInfo.name === 'rushwash_sale_orders') {
          const orders = await col.find({
            $or: [
              { 'payments.providerPaymentId': targetId },
              { 'payments.id': targetId },
              { 'payments.paymentId': targetId },
              { 'payments._id': targetId },
              { 'payments.reference': targetId },
              { _id: targetId },
              { readableCode: targetId }
            ]
          }).toArray();

          if (orders.length > 0) {
            console.log(`\n>>> FOUND in ${dbName}.${colInfo.name} (targeted): ${orders.length} matches!`);
            for (const o of orders) {
              console.log(JSON.stringify(o, null, 2));
            }
          }
        }

        // Check audit events
        if (colInfo.name === 'rushwash_audit_events') {
          const audits = await col.find({
            $or: [
              { entityReadableCode: targetId },
              { 'data.paymentId': targetId },
              { 'data.providerPaymentId': targetId },
              { 'data.id': targetId },
              { 'payload.paymentId': targetId }
            ]
          }).toArray();

          if (audits.length > 0) {
            console.log(`\n>>> FOUND in ${dbName}.${colInfo.name} (targeted): ${audits.length} matches!`);
            for (const a of audits) {
              console.log(JSON.stringify(a, null, 2));
            }
          }
        }

        // Broad regex check on collections that might contain it
        const regexMatches = await col.find({
          $or: [
            { id: targetId },
            { providerPaymentId: targetId },
            { paymentId: targetId },
            { reference: targetId },
            { 'moyasarPaymentInstruments.id': targetId }
          ]
        }).toArray();

        if (regexMatches.length > 0 && colInfo.name !== 'rushwash_sale_orders' && colInfo.name !== 'rushwash_audit_events') {
          console.log(`\n>>> FOUND in ${dbName}.${colInfo.name}: ${regexMatches.length} matches!`);
          for (const m of regexMatches) {
            console.log(JSON.stringify(m, null, 2));
          }
        }
      }
    }

    // Also check if any order was created recently (today after 12:00 UTC)
    console.log('\n--- Checking orders created after 12:00 UTC today ---');
    const recentOrders = await client.db('rushwash').collection('rushwash_sale_orders').find({
      createdAt: { $gte: new Date('2026-09-10T09:00:00.000Z') }
    }).sort({ createdAt: -1 }).toArray();

    console.log(`Found ${recentOrders.length} orders created after 09:00 UTC today:`);
    for (const ro of recentOrders) {
      const pmts = (ro.payments || []).map(p => `${p.providerPaymentId} (${p.status}, ${p.amount} SAR)`).join(', ');
      console.log(`${ro.readableCode} | ${ro.createdAt?.toISOString()} | ${ro.status} | Sub: ${ro.subscriptionReadableCode} | Plate: ${ro.normalizedPlate} | Payments: ${pmts}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
