import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rushwash');
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log("=== 1. SEARCHING CUSTOMERS FOR LAST 4: 5265 ===");
    const custs = await db.collection('rushwash_customers').find({
      $or: [
        { 'moyasarPaymentInstrument.lastFour': '5265' },
        { 'moyasarPaymentInstruments.lastFour': '5265' },
        { 'moyasarPaymentInstrument.last4': '5265' },
        { 'moyasarPaymentInstruments.last4': '5265' },
        { 'moyasarPaymentInstrument.lastFour': 5265 },
        { 'moyasarPaymentInstruments.lastFour': 5265 },
        { 'phone': { $regex: '5265$' } },
        { 'normalizedPhone': { $regex: '5265$' } }
      ]
    }).toArray();

    console.log(`Found ${custs.length} customers matching 5265:`);
    for (const c of custs) {
      console.log(`Customer: ${c.name} | Phone: ${c.phone} | Code: ${c.readableCode} | ID: ${c._id}`);
      console.log('Cards:', JSON.stringify(c.moyasarPaymentInstruments || c.moyasarPaymentInstrument, null, 2));
    }

    console.log("\n=== 2. SEARCHING SUBSCRIPTIONS FOR LAST 4: 5265 ===");
    const subs = await db.collection('rushwash_subscriptions').find({
      $or: [
        { 'paymentMethodUsed.lastFour': '5265' },
        { 'paymentMethodUsed.last4': '5265' },
        { 'paymentMethodUsed.lastFour': 5265 },
        { 'moyasarPaymentInstrument.lastFour': '5265' },
        { 'customerSnapshot.phone': { $regex: '5265$' } },
        { 'vehicleLinks.snapshot.normalizedPlate': { $regex: '5265' } },
        { 'vehicleLinks.snapshot.displayPlate': { $regex: '5265' } },
        { 'readableCode': 'SUB-05265' }
      ]
    }).toArray();

    console.log(`Found ${subs.length} subscriptions:`);
    for (const s of subs) {
      console.log(`Sub: ${s.readableCode} | Status: ${s.status} | Cust: ${s.customerSnapshot?.name} (${s.customerSnapshot?.phone}) | Plan: ${s.packageNameEn} | Plate: ${s.vehicleLinks?.[0]?.snapshot?.displayPlate}`);
      if (s.paymentMethodUsed) console.log('  PaymentMethodUsed:', s.paymentMethodUsed);
    }

    console.log("\n=== 3. SEARCHING SALE ORDERS FOR LAST 4: 5265 ===");
    const orders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { 'payments.paymentMethodUsed.lastFour': '5265' },
        { 'payments.paymentMethodUsed.last4': '5265' },
        { 'payments.lastFour': '5265' },
        { 'payments.last4': '5265' },
        { 'payments.cardLastFour': '5265' },
        { 'payments.source.number': { $regex: '5265$' } },
        { 'customerSnapshot.phone': { $regex: '5265$' } },
        { 'normalizedPlate': { $regex: '5265' } },
        { 'vehicleSnapshot.displayPlate': { $regex: '5265' } }
      ]
    }).toArray();

    console.log(`Found ${orders.length} orders:`);
    for (const o of orders) {
      console.log(`Order: ${o.readableCode} | Date: ${o.createdAt} | Status: ${o.status} | Total: ${o.postDiscountTotal} SAR | Plate: ${o.normalizedPlate} | Cust: ${o.customerSnapshot?.name} (${o.customerSnapshot?.phone})`);
      for (const p of o.payments || []) {
        console.log(`  Payment: status=${p.status} amt=${p.amount} method=${p.paymentMethodNameEn} token=${p.paymentToken} card=${JSON.stringify(p.paymentMethodUsed || p.source || p.card || '')}`);
      }
    }

    console.log("\n=== 4. SEARCHING AUDIT EVENTS FOR 5265 ===");
    const audits = await db.collection('rushwash_audit_events').find({
      $or: [
        { 'payload.lastFour': '5265' },
        { 'payload.last4': '5265' },
        { 'data.lastFour': '5265' },
        { 'data.last4': '5265' }
      ]
    }).toArray();
    console.log(`Found ${audits.length} audit events matching 5265.`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
