import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const phone = '+966534068608';
    const plainPhone = '534068608';

    // Find all customer records matching phone
    const custs = await db.collection('rushwash_customers').find({
      $or: [
        { phone: phone },
        { phone: plainPhone },
        { phone: `966${plainPhone}` },
        { phone: `0${plainPhone}` }
      ]
    }).toArray();

    console.log(`Found ${custs.length} customer records for phone ${phone}:`);
    for (const c of custs) {
      console.log(`- ID: ${c._id} (type: ${typeof c._id}) | Code: ${c.readableCode} | Name: ${c.name} | Phone: ${c.phone}`);
    }

    const allCustIds = custs.map(c => c._id);
    const allCustCodes = custs.map(c => c.readableCode);

    // Subscriptions
    const subs = await db.collection('rushwash_subscriptions').find({
      $or: [
        { customerId: { $in: allCustIds } },
        { customerId: { $in: allCustIds.map(id => id.toString()) } },
        { customerReadableCode: { $in: allCustCodes } }
      ]
    }).toArray();
    console.log(`\nSubscriptions found (${subs.length}):`);
    for (const s of subs) {
      console.log(`- ${s.readableCode} | Status: ${s.status} | Plan: ${s.packageName || s.packageReadableCode} | Renewal: ${s.renewalDate}`);
    }

    // Vehicles
    const vehs = await db.collection('rushwash_vehicles').find({
      $or: [
        { customerId: { $in: allCustIds } },
        { customerId: { $in: allCustIds.map(id => id.toString()) } },
        { customerReadableCode: { $in: allCustCodes } }
      ]
    }).toArray();
    console.log(`\nVehicles found (${vehs.length}):`);
    for (const v of vehs) {
      console.log(`- ${v.readableCode} | Plate: ${v.displayPlate || v.normalizedPlate} | Make: ${v.make}`);
    }

    // Orders
    const orders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { customerId: { $in: allCustIds } },
        { customerId: { $in: allCustIds.map(id => id.toString()) } },
        { 'customerSnapshot.readableCode': { $in: allCustCodes } }
      ]
    }).sort({ createdAt: -1 }).limit(10).toArray();
    console.log(`\nOrders found (${orders.length}):`);
    for (const o of orders) {
      console.log(`- ${o.readableCode} | Date: ${o.createdAt} | Status: ${o.status} | Total: ${o.postDiscountTotal} SAR | Sub: ${o.subscriptionReadableCode}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
