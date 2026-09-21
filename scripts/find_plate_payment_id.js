import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const plateRegex = /5007.*HXB/i;
    const cleanPlate = '5007HXB';

    console.log('=== 1. VEHICLES MATCHING 5007HXB ===');
    const vehicles = await db.collection('rushwash_vehicles').find({
      $or: [
        { normalizedPlate: { $regex: cleanPlate, $options: 'i' } },
        { displayPlate: { $regex: cleanPlate, $options: 'i' } },
        { normalizedPlate: plateRegex },
        { displayPlate: plateRegex }
      ]
    }).toArray();

    console.log(`Vehicles found: ${vehicles.length}`);
    for (const v of vehicles) {
      console.log(JSON.stringify(v, null, 2));
    }

    console.log('\n=== 2. ORDERS MATCHING 5007HXB ===');
    const orders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { normalizedPlate: { $regex: cleanPlate, $options: 'i' } },
        { 'vehicleSnapshot.normalizedPlate': { $regex: cleanPlate, $options: 'i' } },
        { 'vehicleSnapshot.displayPlate': { $regex: cleanPlate, $options: 'i' } },
        { vehicleId: { $in: vehicles.map(v => v._id) } }
      ]
    }).sort({ createdAt: -1 }).toArray();

    console.log(`Orders found: ${orders.length}`);
    for (const o of orders) {
      console.log(`\nOrder: ${o.readableCode} | Status: ${o.status} | CreatedAt: ${o.createdAt} | Total: ${o.postDiscountTotal} SAR | Plate: ${o.normalizedPlate}`);
      console.log(`Customer: ${(o.customerSnapshot || {}).name} (${(o.customerSnapshot || {}).phone})`);
      console.log(`Subscription: ${o.subscriptionReadableCode} | isRenewal: ${o.isRenewal}`);
      console.log(`Lines:`, JSON.stringify(o.lines || o.lineSnapshots));
      console.log(`Payments:`, JSON.stringify(o.payments, null, 2));
      if (o.refund) console.log(`Refund:`, JSON.stringify(o.refund));
    }

    console.log('\n=== 3. SUBSCRIPTIONS MATCHING 5007HXB ===');
    const subs = await db.collection('rushwash_subscriptions').find({
      $or: [
        { 'vehicleLinks.snapshot.normalizedPlate': { $regex: cleanPlate, $options: 'i' } },
        { 'vehicleLinks.snapshot.displayPlate': { $regex: cleanPlate, $options: 'i' } },
        { 'vehicleLinks.vehicleId': { $in: vehicles.map(v => v._id) } }
      ]
    }).sort({ createdAt: -1 }).toArray();

    console.log(`Subscriptions found: ${subs.length}`);
    for (const s of subs) {
      console.log(`Sub: ${s.readableCode} | Status: ${s.status} | Package: ${s.packageNameEn} | RenewalDate: ${s.renewalDate} | CreatedAt: ${s.createdAt}`);
      console.log(`PaymentMethodUsed:`, JSON.stringify(s.paymentMethodUsed));
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
