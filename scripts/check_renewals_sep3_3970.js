import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // Define search range for September 3, 2026
    const startOfDay = new Date('2026-09-03T00:00:00.000Z');
    const endOfDay = new Date('2026-09-03T23:59:59.999Z');

    console.log('--- SEARCHING SALE ORDERS ON 2026-09-03 ---');
    const orders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ createdAt: 1 }).toArray();

    console.log(`Found ${orders.length} orders on 2026-09-03.`);

    // Check all customers who have card 3970
    const customersWithCard3970 = await db.collection('rushwash_customers').find({
      $or: [
        { 'moyasarPaymentInstrument.lastFour': '3970' },
        { 'moyasarPaymentInstruments.lastFour': '3970' },
        { 'moyasarPaymentInstrument.last4': '3970' },
        { 'moyasarPaymentInstruments.last4': '3970' }
      ]
    }).toArray();

    console.log(`\nCustomers with card ending in 3970: ${customersWithCard3970.length}`);
    for (const c of customersWithCard3970) {
      console.log(`Customer: ${c.name} | Phone: ${c.phone} | Code: ${c.readableCode} | ID: ${c._id}`);
      console.log(`  Instruments:`, JSON.stringify(c.moyasarPaymentInstruments || c.moyasarPaymentInstrument, null, 2));
    }

    const custIds3970 = customersWithCard3970.map(c => c._id);

    // Let's filter orders around 07:00 (03:00 to 11:00 UTC to cover timezones)
    console.log('\n--- ORDERS AROUND 07:00 (UTC and Local KSA UTC+3) ---');
    for (const o of orders) {
      const d = new Date(o.createdAt);
      const iso = d.toISOString();
      const ksaHours = (d.getUTCHours() + 3) % 24;
      const ksaTime = `${String(ksaHours).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}`;
      
      const isCard3970 = JSON.stringify(o).includes('3970') || custIds3970.some(id => String(id) === String(o.customerId));
      
      console.log(`Order: ${o.readableCode} | UTC: ${iso} | KSA Time: ${ksaTime} | isRenewal: ${o.isRenewal} | Status: ${o.status} | Total: ${o.postDiscountTotal} | Card3970: ${isCard3970 ? 'YES' : 'NO'}`);
      if (isCard3970 || o.isRenewal) {
        console.log(`  Details: Customer: ${(o.customerSnapshot || {}).name || o.customerId} | Phone: ${(o.customerSnapshot || {}).phone} | Plate: ${o.normalizedPlate}`);
        console.log(`  Payments:`, JSON.stringify(o.payments, null, 2));
      }
    }

    // Also search subscriptions that renewed on 2026-09-03
    console.log('\n--- SUBSCRIPTIONS RENEWING ON 2026-09-03 ---');
    const subs = await db.collection('rushwash_subscriptions').find({
      $or: [
        { renewalDate: { $gte: startOfDay, $lte: endOfDay } },
        { updatedAt: { $gte: startOfDay, $lte: endOfDay } },
        { createdAt: { $gte: startOfDay, $lte: endOfDay } }
      ]
    }).toArray();
    console.log(`Found ${subs.length} matching subscriptions.`);

    for (const s of subs) {
      const matchCard = JSON.stringify(s).includes('3970') || custIds3970.some(id => String(id) === String(s.customerId));
      if (matchCard || (s.renewalDate && new Date(s.renewalDate) >= startOfDay && new Date(s.renewalDate) <= endOfDay)) {
        console.log(`Sub: ${s.readableCode} | CustomerId: ${s.customerId} | Status: ${s.status} | RenewalDate: ${s.renewalDate} | Card3970: ${matchCard ? 'YES' : 'NO'}`);
        console.log(`  Package: ${s.packageNameEn} | Plate: ${JSON.stringify(s.vehicleLinks)}`);
        console.log(`  Payment Method / Instrument:`, JSON.stringify(s.paymentMethodUsed || s.moyasarPaymentInstrument || s.moyasarPaymentInstruments, null, 2));
      }
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
