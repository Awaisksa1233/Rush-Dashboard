import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // 1. Check distinct lastRenewalFailureReason in subscriptions
    const subReasons = await db.collection('rushwash_subscriptions').aggregate([
      { $group: { _id: '$lastRenewalFailureReason', count: { $sum: 1 } } }
    ]).toArray();
    console.log('--- Subscriptions lastRenewalFailureReason counts ---');
    console.log(JSON.stringify(subReasons, null, 2));

    // 2. Check failure reasons in renewal orders
    const orderReasons = await db.collection('rushwash_sale_orders').aggregate([
      {
        $match: {
          $or: [
            { isRenewal: true },
            { subscriptionTransitionKind: 'renewal' },
            { notes: { $regex: /subscription_renewal/i } }
          ]
        }
      },
      { $unwind: { path: '$payments', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$payments.failureReason', count: { $sum: 1 } } }
    ]).toArray();
    console.log('\n--- Renewal Orders payment.failureReason counts ---');
    console.log(JSON.stringify(orderReasons, null, 2));

    // 3. Check order notes or statuses when payment failed or no payment
    const notesSample = await db.collection('rushwash_sale_orders').aggregate([
      {
        $match: {
          $or: [
            { isRenewal: true },
            { subscriptionTransitionKind: 'renewal' },
            { notes: { $regex: /subscription_renewal/i } }
          ],
          status: { $in: ['failed', 'cancelled'] }
        }
      },
      { $group: { _id: { status: '$status', note: '$notes' }, count: { $sum: 1 } } },
      { $limit: 20 }
    ]).toArray();
    console.log('\n--- Failed/Cancelled Renewal Orders (status & notes) ---');
    console.log(JSON.stringify(notesSample, null, 2));

    // 4. Also check subscriptions that are expired or cancelled or failed with no saved card
    // How many subscriptions have status in ['expired', 'cancelled', 'active'] with autoRenew=true, and what is their token/card status?
    
  } finally {
    await client.close();
  }
}

main().catch(console.error);
