import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    function toKSA(d) {
      if (!d) return '';
      const dt = new Date(d);
      const ksa = new Date(dt.getTime() + 3 * 3600 * 1000);
      return ksa.toISOString().replace('T', ' ').slice(0, 19);
    }

    for (const sc of ['SUB-30589', 'SUB-34124']) {
      console.log(`\n================== ${sc} ==================`);
      const sub = await db.collection('rushwash_subscriptions').findOne({ readableCode: sc });
      console.log(`Subscription: ${sc} | status=${sub?.status} | renewalDate=${toKSA(sub?.renewalDate)} KSA | price=${sub?.price} SAR`);
      console.log(`Customer: ${sub?.customerSnapshot?.name} (${sub?.customerSnapshot?.phone})`);

      const subOrders = await db.collection('rushwash_sale_orders').find({
        $or: [
          { subscriptionReadableCode: sc },
          { notes: { $regex: new RegExp(sc, 'i') } }
        ]
      }).sort({ createdAt: 1 }).toArray();

      for (const o of subOrders) {
        console.log(`Order ${o.readableCode} | Created: ${toKSA(o.createdAt)} KSA | Status: ${o.status} | Total: ${o.postDiscountTotal} SAR | isRenewal: ${o.isRenewal}`);
        console.log(`  Payments:`, o.payments?.map(p => ({ status: p.status, amount: p.amount, method: p.paymentMethodNameEn || p.provider, id: p.providerPaymentId })));
      }
    }

    // Also check why SUB-31220 had ORD-26674 on Sep 2 and ORD-27703 on Sep 12!
    console.log(`\n================== SUB-31220 HISTORY ==================`);
    const s31220 = await db.collection('rushwash_subscriptions').findOne({ readableCode: 'SUB-31220' });
    console.log('SUB-31220 doc:', JSON.stringify({
      status: s31220?.status,
      renewalDate: toKSA(s31220?.renewalDate),
      startsAt: toKSA(s31220?.startsAt),
      expiresAt: toKSA(s31220?.expiresAt),
      history: s31220?.history,
      transitions: s31220?.transitions,
      audit: s31220?.audit,
      notes: s31220?.notes
    }, null, 2));

  } finally {
    await client.close();
  }
}

main().catch(console.error);
