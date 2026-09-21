import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // Get all orders from 04:00:00 UTC to 04:05:00 UTC on 2026-09-03 (07:00 AM KSA)
    const start = new Date('2026-09-03T04:00:00.000Z');
    const end = new Date('2026-09-03T04:05:00.000Z');

    const orders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: start, $lte: end }
    }).sort({ createdAt: 1 }).toArray();

    console.log(`\n================================================================================`);
    console.log(`RENEWAL BATCH ON 3 SEP 2026 AT 07:00 AM KSA (04:00 UTC) - TOTAL: ${orders.length} ORDERS`);
    console.log(`================================================================================\n`);

    const table = [];

    for (const o of orders) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: o.customerId });
      const insts = cust?.moyasarPaymentInstruments || (cust?.moyasarPaymentInstrument ? [cust.moyasarPaymentInstrument] : []);
      
      const primaryInst = insts.find(i => i.isPrimary) || insts[0] || {};
      const allCards = insts.map(i => `${i.brand || 'card'} (*${i.lastFour || i.last4 || '????'})`).join(', ');

      const payment = (o.payments || [])[0] || {};
      const status = o.status;
      const ksaTime = new Date(new Date(o.createdAt).getTime() + 3 * 3600 * 1000).toISOString().slice(11, 19);

      table.push({
        orderCode: o.readableCode,
        timeKSA: ksaTime,
        customer: cust?.name || 'Unknown',
        phone: cust?.phone || 'Unknown',
        plate: o.normalizedPlate || 'Unknown',
        amount: `${o.postDiscountTotal} SAR`,
        status: status,
        paymentStatus: payment.status || 'None',
        failureReason: payment.failureReason || '-',
        primaryCard: `${primaryInst.brand || 'card'} (*${primaryInst.lastFour || primaryInst.last4 || '????'})`,
        allSavedCards: allCards || 'No saved card',
        usedCard3970: allCards.includes('3970') || JSON.stringify(o).includes('3970') || JSON.stringify(cust).includes('3970') ? 'YES' : 'NO'
      });
    }

    console.log(JSON.stringify(table, null, 2));

    // Also check if any card 3970 exists in the whole database
    console.log('\n--- ALL CUSTOMERS WITH CARD 3970 IN DB ---');
    const all3970Custs = await db.collection('rushwash_customers').find({
      $or: [
        { 'moyasarPaymentInstrument.lastFour': '3970' },
        { 'moyasarPaymentInstruments.lastFour': '3970' },
        { 'moyasarPaymentInstrument.last4': '3970' },
        { 'moyasarPaymentInstruments.last4': '3970' }
      ]
    }).toArray();
    console.log(`Found ${all3970Custs.length} customers with card 3970 in entire DB.`);
    for (const c of all3970Custs) {
      console.log(`- ${c.name} (${c.phone}) | ${c.readableCode} | ID: ${c._id}`);
      console.log(`  Cards:`, JSON.stringify(c.moyasarPaymentInstruments || c.moyasarPaymentInstrument));
      // check their orders
      const custOrders = await db.collection('rushwash_sale_orders').find({ customerId: c._id }).toArray();
      console.log(`  Total Orders: ${custOrders.length}`);
      custOrders.forEach(co => {
        console.log(`    Order ${co.readableCode} | Date: ${co.createdAt} | Status: ${co.status} | Total: ${co.postDiscountTotal}`);
      });
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
