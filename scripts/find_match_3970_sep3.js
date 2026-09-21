import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const start = new Date('2026-09-03T00:00:00.000Z');
    const end = new Date('2026-09-03T23:59:59.999Z');

    const orders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: start, $lte: end }
    }).sort({ createdAt: 1 }).toArray();

    console.log(`Analyzing ${orders.length} orders on Sep 3...`);

    for (const o of orders) {
      const cust = await db.collection('rushwash_customers').findOne({ _id: o.customerId });
      const insts = cust?.moyasarPaymentInstruments || (cust?.moyasarPaymentInstrument ? [cust.moyasarPaymentInstrument] : []);
      
      const has3970 = insts.some(i => (i.lastFour === '3970' || i.last4 === '3970')) ||
                      JSON.stringify(o).includes('3970') ||
                      JSON.stringify(cust).includes('3970');

      const ksaDate = new Date(o.createdAt);
      ksaDate.setHours(ksaDate.getHours() + 3);
      const ksaTime = ksaDate.toISOString().replace('T', ' ').slice(0, 19);

      if (has3970) {
        console.log('>>> MATCH FOUND! <<<');
        console.log(`Order Code: ${o.readableCode}`);
        console.log(`Time: UTC ${o.createdAt?.toISOString ? o.createdAt.toISOString() : o.createdAt} | KSA Time: ${ksaTime}`);
        console.log(`Plate: ${o.normalizedPlate}`);
        console.log(`Customer: ${cust?.name} | Phone: ${cust?.phone} | Code: ${cust?.readableCode}`);
        console.log(`Order Status: ${o.status} | Total: ${o.postDiscountTotal} SAR | isRenewal: ${o.isRenewal}`);
        console.log(`Instruments on Customer:`, JSON.stringify(insts, null, 2));
        console.log(`Payments:`, JSON.stringify(o.payments, null, 2));
        console.log('----------------------------------------------------');
      }
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
