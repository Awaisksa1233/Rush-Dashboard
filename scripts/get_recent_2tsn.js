import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const orders = await db.collection('rushwash_sale_orders').find({
      normalizedPlate: { $regex: /2TSN/i }
    }).sort({ createdAt: -1 }).limit(3).toArray();

    console.log(`Found ${orders.length} recent orders:`);
    for (const o of orders) {
      console.log(`\n======================================================`);
      console.log(`Order Code: ${o.readableCode}`);
      console.log(`Status: ${o.status}`);
      console.log(`Created At: ${o.createdAt}`);
      console.log(`Completed At: ${o.completedAt}`);
      console.log(`Total: ${o.postDiscountTotal} SAR`);
      console.log(`Customer: ${(o.customerSnapshot || {}).name} | Phone: ${(o.customerSnapshot || {}).phone} | Code: ${(o.customerSnapshot || {}).readableCode}`);
      console.log(`Subscription: ${o.subscriptionReadableCode} | isRenewal: ${o.isRenewal}`);
      console.log(`Payments:`, JSON.stringify(o.payments, null, 2));
      if (o.refund) console.log(`Refund:`, JSON.stringify(o.refund, null, 2));
    }

    // Also get customer details
    if (orders.length > 0) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: orders[0].customerId });
      console.log('\nCustomer Profile:');
      console.log(`Name: ${cust?.name} | Phone: ${cust?.phone} | Code: ${cust?.readableCode}`);
      console.log('Cards:', JSON.stringify(cust?.moyasarPaymentInstruments || cust?.moyasarPaymentInstrument, null, 2));
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
