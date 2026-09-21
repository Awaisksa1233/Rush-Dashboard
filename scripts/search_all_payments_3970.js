import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // 1. Search all sale orders where string representation of payments includes 3970
    console.log('Searching all sale orders with 3970 in payments...');
    const allOrders = await db.collection('rushwash_sale_orders').find({}).project({ readableCode: 1, payments: 1, createdAt: 1, postDiscountTotal: 1, customerId: 1, normalizedPlate: 1, status: 1 }).toArray();

    const matchingOrders = [];
    for (const o of allOrders) {
      const pStr = JSON.stringify(o.payments || []);
      if (pStr.includes('3970')) {
        matchingOrders.push(o);
      }
    }
    console.log(`Orders matching 3970 in payments: ${matchingOrders.length}`);
    for (const mo of matchingOrders) {
      console.log(`Order ${mo.readableCode} (${mo.createdAt}) | Total: ${mo.postDiscountTotal} | Status: ${mo.status} | Plate: ${mo.normalizedPlate}`);
      console.log('  Payments:', JSON.stringify(mo.payments, null, 2));
    }

    // 2. Search all subscriptions where string representation includes 3970
    console.log('\nSearching all subscriptions with 3970...');
    const allSubs = await db.collection('rushwash_subscriptions').find({}).toArray();
    const matchingSubs = [];
    for (const s of allSubs) {
      const sStr = JSON.stringify(s);
      if (sStr.includes('3970')) {
        matchingSubs.push(s);
      }
    }
    console.log(`Subscriptions matching 3970: ${matchingSubs.length}`);
    for (const ms of matchingSubs) {
      console.log(`Sub ${ms.readableCode} | Status: ${ms.status} | Package: ${ms.packageNameEn} | Renewal: ${ms.renewalDate} | Cust: ${ms.customerId}`);
      console.log('  PaymentMethodUsed:', JSON.stringify(ms.paymentMethodUsed));
    }

    // 3. Search all customers with 3970
    console.log('\nSearching all customers with 3970...');
    const allCusts = await db.collection('rushwash_customers').find({}).toArray();
    const matchingCusts = [];
    for (const c of allCusts) {
      const cStr = JSON.stringify(c);
      if (cStr.includes('3970')) {
        matchingCusts.push(c);
      }
    }
    console.log(`Customers matching 3970: ${matchingCusts.length}`);
    for (const mc of matchingCusts) {
      console.log(`Cust ${mc.readableCode} (${mc.name}, ${mc.phone})`);
      console.log('  Instruments:', JSON.stringify(mc.moyasarPaymentInstruments || mc.moyasarPaymentInstrument));
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
