import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('=== 1. CUSTOMER WITH CARD 3970 ===');
    const cust = await db.collection('rushwash_customers').findOne({
      _id: new ObjectId('6a8a304326e5d7aeaaba2cdb')
    });
    if (cust) {
      console.log(`Customer Name: ${cust.name}`);
      console.log(`Customer Phone: ${cust.phone}`);
      console.log(`Customer Code: ${cust.readableCode}`);
      console.log(`Customer ID: ${cust._id}`);
      console.log('Moyasar Payment Instruments:');
      const insts = cust.moyasarPaymentInstruments || (cust.moyasarPaymentInstrument ? [cust.moyasarPaymentInstrument] : []);
      for (const inst of insts) {
        console.log(`  ID: ${inst.id} | Brand: ${inst.brand} | Last4: ${inst.lastFour || inst.last4} | Token: ${inst.tokenId} | Exp: ${inst.expMonth}/${inst.expYear} | Primary: ${inst.isPrimary} | SavedAt: ${inst.savedAt}`);
      }
    }

    console.log('\n=== 2. ALL SUBSCRIPTIONS FOR THIS CUSTOMER ===');
    const subs = await db.collection('rushwash_subscriptions').find({
      $or: [
        { customerId: cust._id },
        { 'paymentMethodUsed.tokenId': 'token_jJ8QCyhFUY1HXcK8X4d2VVoxzB' },
        { 'paymentMethodUsed.lastFour': '3970' }
      ]
    }).sort({ createdAt: -1 }).toArray();
    for (const s of subs) {
      console.log(`Sub: ${s.readableCode} | Package: ${s.packageNameEn} | Status: ${s.status} | RenewalDate: ${s.renewalDate} | CreatedAt: ${s.createdAt} | UpdatedAt: ${s.updatedAt}`);
      for (const v of s.vehicleLinks || []) {
        const snap = v.snapshot || {};
        console.log(`   Vehicle: ${snap.readableCode} | Plate: ${snap.normalizedPlate}`);
      }
      console.log(`   PaymentMethodUsed:`, JSON.stringify(s.paymentMethodUsed));
      console.log(`   MoyasarInstrument:`, JSON.stringify(s.moyasarPaymentInstrument || s.moyasarPaymentInstruments));
      console.log('---');
    }

    console.log('\n=== 3. ALL SALE ORDERS FOR THIS CUSTOMER ===');
    const orders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { customerId: cust._id },
        { 'payments.paymentToken': 'token_jJ8QCyhFUY1HXcK8X4d2VVoxzB' },
        { 'payments.paymentMethodUsed.lastFour': '3970' },
        { 'payments.paymentMethodUsed.tokenId': 'token_jJ8QCyhFUY1HXcK8X4d2VVoxzB' }
      ]
    }).sort({ createdAt: -1 }).toArray();

    console.log(`Total Orders found: ${orders.length}`);
    for (const o of orders) {
      console.log(`\nOrder: ${o.readableCode} | Status: ${o.status} | CreatedAt: ${o.createdAt} | CompletedAt: ${o.completedAt} | Total: ${o.postDiscountTotal} SAR | Plate: ${o.normalizedPlate} | Sub: ${o.subscriptionReadableCode} | isRenewal: ${o.isRenewal}`);
      const lines = o.lines || o.lineSnapshots || [];
      for (const l of lines) {
        console.log(`   Line: ${l.displayNameEn} (Qty: ${l.quantity}, Unit: ${l.unitPrice}, Price: ${l.price})`);
      }
      for (const p of o.payments || []) {
        console.log(`   Payment #${p.attemptNumber}: Status=${p.status} | Amount=${p.amount} ${p.currency} | Provider=${p.provider} | Method=${p.paymentMethodNameEn} | MethodKey=${p.paymentMethodIdentityKey} | Token=${p.paymentToken} | ProviderPaymentId=${p.providerPaymentId} | OccurredAt=${p.occurredAt} | Reason=${p.failureReason}`);
        if (p.paymentMethodUsed) {
          console.log(`      PaymentMethodUsed:`, JSON.stringify(p.paymentMethodUsed));
        }
      }
      if (o.refund) {
        console.log(`   Refund:`, JSON.stringify(o.refund));
      }
    }

    console.log('\n=== 4. CHECK ANY OTHER CARD WITH 3970 ACROSS DATABASE ===');
    const allCusts3970 = await db.collection('rushwash_customers').find({
      $or: [
        { 'moyasarPaymentInstrument.lastFour': '3970' },
        { 'moyasarPaymentInstruments.lastFour': '3970' },
        { 'moyasarPaymentInstrument.last4': '3970' },
        { 'moyasarPaymentInstruments.last4': '3970' }
      ]
    }).toArray();
    console.log(`Customers with 3970 card: ${allCusts3970.length}`);
    for (const c of allCusts3970) {
      console.log(`- ${c.readableCode} | ${c.name} | ${c.phone}`);
    }

    // Check payment logs or webhook logs if collection exists
    const collections = await db.listCollections().toArray();
    const colNames = collections.map(c => c.name);
    console.log('\n=== 5. COLLECTIONS IN DB ===', colNames);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
