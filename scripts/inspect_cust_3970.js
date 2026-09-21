import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // Inspect Customer CUS-04428 (صالح)
    const cust = await db.collection('rushwash_customers').findOne({ readableCode: 'CUS-04428' });
    console.log('=== CUSTOMER DETAILS FOR CUS-04428 ===');
    console.log(JSON.stringify(cust, null, 2));

    const orders = await db.collection('rushwash_sale_orders').find({ customerId: cust._id }).sort({ createdAt: 1 }).toArray();
    console.log(`\n=== ORDERS FOR CUS-04428 (${orders.length}) ===`);
    orders.forEach(o => {
      console.log(`Order: ${o.readableCode} (Legacy: ${o.legacyId}) | Date: ${o.createdAt} | Status: ${o.status} | Total: ${o.postDiscountTotal} | isRenewal: ${o.isRenewal}`);
      console.log(`  Payments:`, JSON.stringify(o.payments, null, 2));
    });

    const subs = await db.collection('rushwash_subscriptions').find({ customerId: cust._id }).toArray();
    console.log(`\n=== SUBSCRIPTIONS FOR CUS-04428 (${subs.length}) ===`);
    subs.forEach(s => {
      console.log(`Sub: ${s.readableCode} | Status: ${s.status} | Package: ${s.packageNameEn} | RenewalDate: ${s.renewalDate} | Updated: ${s.updatedAt}`);
      console.log(`  Payment Method Used:`, JSON.stringify(s.paymentMethodUsed || s.moyasarPaymentInstrument, null, 2));
    });

    // Also check if any payment across ALL orders in the entire system ever had last4 == '3970' or card ending in 3970
    console.log('\n=== ANY PAYMENT LOGS OR AUDITS WITH 3970 ===');
    const audits = await db.collection('rushwash_audit_events').find({
      $or: [
        { 'data.lastFour': '3970' },
        { 'data.last4': '3970' },
        { 'data.cardNumber': /3970/ },
        { description: /3970/ }
      ]
    }).toArray();
    console.log(`Found ${audits.length} audit events matching 3970.`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
