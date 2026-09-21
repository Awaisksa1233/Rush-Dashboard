import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const cust = await db.collection('rushwash_customers').findOne({ readableCode: 'CUS-00410' });
    console.log('Customer CUS-00410:');
    console.log(`Name: ${cust.name}`);
    console.log(`Phone: ${cust.phone}`);
    console.log(`Email: ${cust.email}`);
    console.log(`CreatedAt: ${cust.createdAt}`);
    console.log(`UpdatedAt: ${cust.updatedAt}`);
    console.log('Instruments:', JSON.stringify(cust.moyasarPaymentInstruments, null, 2));

    // Vehicles
    const vehs = await db.collection('rushwash_vehicles').find({ customerId: cust._id }).toArray();
    console.log(`\nVehicles (${vehs.length}):`);
    for (const v of vehs) {
      console.log(`- ${v.readableCode} | Plate: ${v.displayPlate || v.normalizedPlate} | Make/Model: ${v.make} ${v.model}`);
    }

    // Subscriptions
    const subs = await db.collection('rushwash_subscriptions').find({ customerId: cust._id }).toArray();
    console.log(`\nSubscriptions (${subs.length}):`);
    for (const s of subs) {
      console.log(`- ${s.readableCode} | Plan: ${s.packageName || s.packageReadableCode} | Status: ${s.status} | RenewalDate: ${s.renewalDate} | autoRenew: ${s.autoRenew}`);
    }

    // Recent orders
    const orders = await db.collection('rushwash_sale_orders').find({ customerId: cust._id }).sort({ createdAt: -1 }).limit(5).toArray();
    console.log(`\nRecent Orders (${orders.length}):`);
    for (const o of orders) {
      const pmt = (o.payments || [])[0] || {};
      console.log(`- ${o.readableCode} | Date: ${o.createdAt} | Status: ${o.status} | Total: ${o.postDiscountTotal} | Fail: ${pmt.failureReason || o.cancellationReason || 'N/A'}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
