import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const tokenId = 'token_jJ8QCyhFUY1HXcK8X4d2VVoxzB';
    const custId = new ObjectId('6a8a304326e5d7aeaaba2cdb');
    const startDate = new Date('2026-08-20T00:00:00.000Z');
    const endDate = new Date('2026-09-09T23:59:59.999Z');

    console.log(`Checking charges/orders from ${startDate.toISOString()} to ${endDate.toISOString()}...`);

    // 1. Check orders matching customer ID or token
    const orders = await db.collection('rushwash_sale_orders').find({
      $and: [
        { createdAt: { $gte: startDate, $lte: endDate } },
        {
          $or: [
            { customerId: custId },
            { 'payments.paymentToken': tokenId },
            { 'payments.paymentMethodUsed.tokenId': tokenId },
            { 'payments.paymentMethodUsed.lastFour': '3970' },
            { 'customerSnapshot.phone': /555100674/ }
          ]
        }
      ]
    }).toArray();

    console.log(`\n1. Orders found for customer / token from Aug 20 till today: ${orders.length}`);
    for (const o of orders) {
      console.log(JSON.stringify(o, null, 2));
    }

    // 2. Check if ANY order in that entire period has this token
    const anyOrderWithToken = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: startDate, $lte: endDate },
      $or: [
        { 'payments.paymentToken': tokenId },
        { 'payments.paymentMethodUsed.tokenId': tokenId }
      ]
    }).toArray();
    console.log(`\n2. Any order in DB with token ${tokenId} since Aug 20: ${anyOrderWithToken.length}`);

    // 3. Check wallet transactions since Aug 20
    const walletTx = await db.collection('rushwash_wallet_transactions').find({
      customerId: custId,
      createdAt: { $gte: startDate, $lte: endDate }
    }).toArray();
    console.log(`\n3. Wallet transactions since Aug 20: ${walletTx.length}`);

    // 4. Check car check-ins / visits since Aug 20
    const checkins = await db.collection('rushwash_car_check_ins').find({
      $or: [
        { customerId: custId },
        { normalizedPlate: { $in: ['9916DVJ', '8828GNJ'] } }
      ],
      createdAt: { $gte: startDate, $lte: endDate }
    }).toArray();
    console.log(`\n4. Visits / check-ins since Aug 20: ${checkins.length}`);
    for (const ch of checkins) {
      console.log(`- CheckIn: ${ch.readableCode} | Plate: ${ch.normalizedPlate} | Date: ${ch.createdAt} | Status: ${ch.status}`);
    }

    // 5. Check subscription state changes
    const subs = await db.collection('rushwash_subscriptions').find({
      customerId: custId
    }).toArray();
    console.log(`\n5. Current status of all subscriptions for this customer:`);
    for (const s of subs) {
      console.log(`- ${s.readableCode} | Package: ${s.packageNameEn} | Status: ${s.status} | Renewal: ${s.renewalDate} | UpdatedAt: ${s.updatedAt}`);
    }

    // 6. Check last order ever created for this customer
    const lastOrder = await db.collection('rushwash_sale_orders').find({
      customerId: custId
    }).sort({ createdAt: -1 }).limit(1).toArray();
    console.log(`\n6. Most recent order ever for this customer:`);
    if (lastOrder.length > 0) {
      console.log(`- ${lastOrder[0].readableCode} | Date: ${lastOrder[0].createdAt} | Status: ${lastOrder[0].status} | Total: ${lastOrder[0].postDiscountTotal}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
