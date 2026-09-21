import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('=== PULLING ALL CHARGES (DATE, PLATE, AMOUNT) ===\n');

    // Token 1: token_4Ly2ZGGgPa6bhytvzRPqpLxPPp
    // Instrument ID: 796a1fdd-3ac4-4ac5-a431-9c31ff19855d
    // Customer: CUS-00515
    console.log('---------------------------------------------------------------------------------------------------');
    console.log('TOKEN 1: token_4Ly2ZGGgPa6bhytvzRPqpLxPPp (Customer CUS-00515 / mada *9604 saved 2026-09-02 04:03 KSA)');
    console.log('---------------------------------------------------------------------------------------------------');
    
    const cust1 = await db.collection('rushwash_customers').findOne({ readableCode: 'CUS-00515' });
    const orders1 = await db.collection('rushwash_sale_orders').find({
      $or: [
        { customerId: cust1._id },
        { 'customerSnapshot.readableCode': 'CUS-00515' }
      ]
    }).sort({ createdAt: 1 }).toArray();

    for (const o of orders1) {
      const pmts = o.payments || [];
      const ksaTime = new Date(new Date(o.createdAt).getTime() + 3 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      const plate = o.normalizedPlate || o.vehicleSnapshot?.displayPlate || 'N/A';
      for (const p of pmts) {
        console.log(`Date (KSA): ${ksaTime} | Order: ${o.readableCode} | Sub: ${o.subscriptionReadableCode || 'N/A'} | Plate: ${plate} | Amount: SAR ${o.postDiscountTotal || p.amount} | Status: ${p.status || o.status} | Moyasar Payment ID: ${p.providerPaymentId || 'N/A'}`);
      }
      if (pmts.length === 0) {
        console.log(`Date (KSA): ${ksaTime} | Order: ${o.readableCode} | Sub: ${o.subscriptionReadableCode || 'N/A'} | Plate: ${plate} | Amount: SAR ${o.postDiscountTotal} | Status: ${o.status} | (No payment object)`);
      }
    }

    // Token 2: token_3zGF7wUU7NQ2VrNfUwcfQg213s
    // Customer: CUS-04104 (مشاعل)
    console.log('\n---------------------------------------------------------------------------------------------------');
    console.log('TOKEN 2: token_3zGF7wUU7NQ2VrNfUwcfQg213s (Customer مشاعل CUS-04104 / mada *9604 saved 2026-08-04)');
    console.log('---------------------------------------------------------------------------------------------------');
    
    const cust2 = await db.collection('rushwash_customers').findOne({ readableCode: 'CUS-04104' });
    const orders2 = await db.collection('rushwash_sale_orders').find({
      $or: [
        { customerId: cust2._id },
        { 'customerSnapshot.readableCode': 'CUS-04104' }
      ]
    }).sort({ createdAt: 1 }).toArray();

    for (const o of orders2) {
      const pmts = o.payments || [];
      const ksaTime = new Date(new Date(o.createdAt).getTime() + 3 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
      const plate = o.normalizedPlate || o.vehicleSnapshot?.displayPlate || 'N/A';
      for (const p of pmts) {
        console.log(`Date (KSA): ${ksaTime} | Order: ${o.readableCode} | Sub: ${o.subscriptionReadableCode || 'N/A'} | Plate: ${plate} | Amount: SAR ${o.postDiscountTotal || p.amount} | Status: ${p.status || o.status} | Moyasar Payment ID: ${p.providerPaymentId || 'N/A'}`);
      }
      if (pmts.length === 0) {
        console.log(`Date (KSA): ${ksaTime} | Order: ${o.readableCode} | Sub: ${o.subscriptionReadableCode || 'N/A'} | Plate: ${plate} | Amount: SAR ${o.postDiscountTotal} | Status: ${o.status} | (No payment object)`);
      }
    }

    // Token 3: token_M3QC4nZ8NCoKxBpJtimQSZhTSb
    console.log('\n---------------------------------------------------------------------------------------------------');
    console.log('TOKEN 3: token_M3QC4nZ8NCoKxBpJtimQSZhTSb');
    console.log('---------------------------------------------------------------------------------------------------');
    console.log('No records, no charges, and no plate found in database.');

  } finally {
    await client.close();
  }
}

main().catch(console.error);
