import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const subs = await db.collection('rushwash_subscriptions').find({
      lastRenewalFailureReason: 'renewal_charge_unavailable'
    }).toArray();

    // Check sample of subs with tokens that got renewal_charge_unavailable
    for (const s of subs.slice(0, 10)) {
      const orders = await db.collection('rushwash_sale_orders').find({
        $or: [
          { subscriptionReadableCode: s.readableCode },
          { subCode: s.readableCode },
          { notes: { $regex: new RegExp(s.readableCode, 'i') } }
        ]
      }).sort({ createdAt: -1 }).toArray();

      console.log(`\nSub ${s.readableCode} | status: ${s.status} | autoRenew: ${s.autoRenew} | retryCount: ${s.retryCount} | firstFail: ${s.firstRenewalFailureAt} | renewalDate: ${s.renewalDate}`);
      console.log(`PMU:`, JSON.stringify(s.paymentMethodUsed));
      console.log(`Orders found: ${orders.length}`);
      for (const o of orders.slice(0, 2)) {
        console.log(`  Order ${o.readableCode} | status: ${o.status} | notes: ${o.notes}`);
        for (const p of o.payments || []) {
          console.log(`    Payment: status=${p.status}, reason=${p.failureReason}, method=${p.paymentMethodNameEn}, id=${p.providerPaymentId}`);
        }
      }
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
