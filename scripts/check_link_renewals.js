import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const linkOrders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: new Date('2026-09-04T21:00:00.000Z'), $lte: new Date('2026-09-12T20:59:59.999Z') },
      'payments.paymentMethodIdentityKey': { $regex: /link|portal/i }
    }).toArray();

    const renewals = linkOrders.filter(o => o.isRenewal || o.subscriptionTransitionKind === 'renewal' || (o.notes && o.notes.includes('renewal')));
    console.log(`Of the 143 link orders, how many are renewals? ${renewals.length}`);
    for (const ro of renewals) {
      console.log(`${ro.createdAt.toISOString()} | ${ro.readableCode} | ${ro.status} | notes: ${ro.notes} | ${ro.subscriptionReadableCode}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
