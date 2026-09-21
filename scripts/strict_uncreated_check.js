import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const orders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: new Date('2026-08-22T00:00:00.000Z') },
      dataSource: { $ne: 'legacy' },
      $or: [
        { 'lines.catalogCode': { $regex: '^SPK-' } },
        { 'lineSnapshots.catalogCode': { $regex: '^SPK-' } }
      ],
      status: { $in: ['paid', 'active'] },
      $or: [
        { totalCaptured: { $gt: 0 } },
        { 'payments.status': 'paid' }
      ]
    }).toArray();

    console.log(`Found ${orders.length} paid SPK orders since Aug 22.`);

    const issues = [];

    for (const o of orders) {
      const oDt = new Date(o.createdAt);
      const plate = (o.normalizedPlate || '').replace(/\s+/g, '').toUpperCase();
      const subCode = o.subscriptionReadableCode;

      let subResolved = false;
      let reason = '';

      if (subCode) {
        const sub = await db.collection('rushwash_subscriptions').findOne({ readableCode: subCode });
        if (sub) {
          const rDt = sub.renewalDate ? new Date(sub.renewalDate) : null;
          if (rDt && rDt.getTime() > oDt.getTime()) {
            subResolved = true;
          } else {
            reason = `Order linked to ${subCode} but sub renewalDate (${sub.renewalDate}) is not after order date (${o.createdAt}), status=${sub.status}`;
          }
        } else {
          reason = `Order has subCode ${subCode} but no subscription document found`;
        }
      } else {
        // Look by plate
        const subs = await db.collection('rushwash_subscriptions').find({
          'vehicleLinks.snapshot.normalizedPlate': plate
        }).toArray();

        const createdAfter = subs.filter(s => s.createdAt && new Date(s.createdAt).getTime() >= oDt.getTime() - 60000);
        const renewedAfter = subs.filter(s => s.renewalDate && new Date(s.renewalDate).getTime() > oDt.getTime());

        if (createdAfter.length > 0 || renewedAfter.length > 0) {
          subResolved = true;
        } else {
          reason = `No subscription created or renewed for plate ${plate} after order date`;
        }
      }

      if (!subResolved) {
        const cust = await db.collection('rushwash_customers').findOne({ _id: o.customerId });
        const payment = (o.payments || []).find(p => p.status === 'paid') || (o.payments || [])[0] || {};
        issues.push({
          order_id: o.readableCode,
          plate: plate,
          createdAt: o.createdAt,
          amount: o.postDiscountTotal,
          status: o.status,
          providerPaymentId: payment.providerPaymentId || '',
          method: payment.paymentMethodNameEn || payment.paymentMethodCode || 'Saved card',
          customer_name: cust?.name || o.customerSnapshot?.name,
          customer_phone: cust?.phone || o.customerSnapshot?.phone,
          subCode: subCode || 'None',
          reason: reason
        });
      }
    }

    console.log(`\n======================================================`);
    console.log(`Total unresolved issues found: ${issues.length}`);
    console.log(`======================================================`);
    for (const i of issues) {
      console.log(JSON.stringify(i, null, 2));
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
