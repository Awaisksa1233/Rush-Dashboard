import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('=== SEARCHING ALL COLLECTIONS FOR "3970" ===');

    // 1. Phone number with 3970
    const custByPhone = await db.collection('rushwash_customers').find({
      $or: [{ phone: /3970$/ }, { phone: /3970/ }, { mobile: /3970/ }]
    }).toArray();
    console.log(`\nCustomers with 3970 in phone (${custByPhone.length}):`);
    for (const c of custByPhone) {
      console.log(`- ${c.name} | Phone: ${c.phone} | Code: ${c.readableCode} | ID: ${c._id}`);
      const cOrders = await db.collection('rushwash_sale_orders').find({ customerId: c._id }).toArray();
      console.log(`  Orders: ${cOrders.map(o => `${o.readableCode} (${o.createdAt})`)}`);
    }

    // 2. Vehicle plates with 3970
    const vehByPlate = await db.collection('rushwash_vehicles').find({
      $or: [{ normalizedPlate: /3970/ }, { displayPlate: /3970/ }]
    }).toArray();
    console.log(`\nVehicles with 3970 in plate (${vehByPlate.length}):`);
    for (const v of vehByPlate) {
      console.log(`- Plate: ${v.displayPlate} (${v.normalizedPlate}) | Code: ${v.readableCode} | CustomerId: ${v.customerId}`);
    }

    // 3. Subscriptions with 3970
    const subsWith3970 = await db.collection('rushwash_subscriptions').find({
      $or: [
        { readableCode: /3970/ },
        { legacyId: 3970 },
        { legacySubscriptionId: 3970 }
      ]
    }).toArray();
    console.log(`\nSubscriptions matching 3970 (${subsWith3970.length}):`);
    for (const s of subsWith3970) {
      console.log(`- Sub: ${s.readableCode} (Legacy: ${s.legacyId}) | Status: ${s.status} | RenewalDate: ${s.renewalDate}`);
    }

    // 4. Orders with 3970
    const ordersWith3970 = await db.collection('rushwash_sale_orders').find({
      $or: [
        { readableCode: /3970/ },
        { legacyId: 3970 },
        { legacyOrderCode: /3970/ }
      ]
    }).toArray();
    console.log(`\nOrders matching 3970 (${ordersWith3970.length}):`);
    for (const o of ordersWith3970) {
      console.log(`- Order: ${o.readableCode} (Legacy: ${o.legacyId}) | Date: ${o.createdAt} | Status: ${o.status}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
