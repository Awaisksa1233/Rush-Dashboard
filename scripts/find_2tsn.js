import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const searchRegex = /2.*T.*S.*N/i;
    const directRegex = /2TSN/i;

    console.log('=== SEARCHING VEHICLES FOR 2TSN ===');
    const vehicles = await db.collection('rushwash_vehicles').find({
      $or: [
        { normalizedPlate: { $regex: directRegex } },
        { displayPlate: { $regex: directRegex } },
        { normalizedPlate: { $regex: searchRegex } },
        { displayPlate: { $regex: searchRegex } }
      ]
    }).toArray();
    console.log(`Vehicles found: ${vehicles.length}`);
    for (const v of vehicles) {
      console.log(JSON.stringify(v, null, 2));
    }

    console.log('\n=== SEARCHING ORDERS FOR 2TSN ===');
    const orders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { normalizedPlate: { $regex: directRegex } },
        { normalizedPlate: { $regex: searchRegex } },
        { 'vehicleSnapshot.normalizedPlate': { $regex: directRegex } },
        { 'vehicleSnapshot.displayPlate': { $regex: directRegex } },
        { vehicleId: { $in: vehicles.map(v => v._id) } }
      ]
    }).sort({ createdAt: -1 }).toArray();
    console.log(`Orders found: ${orders.length}`);
    for (const o of orders) {
      console.log(`\nOrder: ${o.readableCode} | Status: ${o.status} | CreatedAt: ${o.createdAt} | Total: ${o.postDiscountTotal} SAR | Plate: ${o.normalizedPlate}`);
      console.log(`Customer: ${(o.customerSnapshot || {}).name} (${(o.customerSnapshot || {}).phone})`);
      console.log(`Subscription: ${o.subscriptionReadableCode} | isRenewal: ${o.isRenewal}`);
      console.log(`Payments:`, JSON.stringify(o.payments, null, 2));
    }

    console.log('\n=== SEARCHING SUBSCRIPTIONS FOR 2TSN ===');
    const subs = await db.collection('rushwash_subscriptions').find({
      $or: [
        { 'vehicleLinks.snapshot.normalizedPlate': { $regex: directRegex } },
        { 'vehicleLinks.snapshot.displayPlate': { $regex: directRegex } },
        { 'vehicleLinks.vehicleId': { $in: vehicles.map(v => v._id) } }
      ]
    }).sort({ createdAt: -1 }).toArray();
    console.log(`Subscriptions found: ${subs.length}`);
    for (const s of subs) {
      console.log(`Sub: ${s.readableCode} | Status: ${s.status} | Package: ${s.packageNameEn} | RenewalDate: ${s.renewalDate}`);
      console.log(`PaymentMethodUsed:`, JSON.stringify(s.paymentMethodUsed));
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
