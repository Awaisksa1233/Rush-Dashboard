import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // 1. Inspect the 236 subscriptions with lastRenewalFailureReason: 'renewal_charge_unavailable'
    const unavailSubs = await db.collection('rushwash_subscriptions').find({
      lastRenewalFailureReason: 'renewal_charge_unavailable'
    }).toArray();

    console.log(`Found ${unavailSubs.length} subscriptions with lastRenewalFailureReason = 'renewal_charge_unavailable'`);

    // Check status distribution
    const statusDist = {};
    for (const s of unavailSubs) {
      statusDist[s.status] = (statusDist[s.status] || 0) + 1;
    }
    console.log('Status distribution:', statusDist);

    // Check how many of them actually have or do not have a saved card / token
    let hasTokenCount = 0;
    let noTokenCount = 0;
    const custIds = unavailSubs.map(s => s.customerId).filter(Boolean);
    const custs = await db.collection('rushwash_customers').find({ _id: { $in: custIds } }).toArray();
    const custMap = new Map(custs.map(c => [c._id.toString(), c]));

    for (const s of unavailSubs) {
      const c = custMap.get(s.customerId?.toString());
      const pmu = s.paymentMethodUsed || {};
      const subToken = pmu.tokenId || pmu.token;
      
      const insts = c?.moyasarPaymentInstruments || (c?.moyasarPaymentInstrument ? [c.moyasarPaymentInstrument] : []);
      const custToken = insts.find(i => i.tokenId || i.token);

      if (subToken || custToken) {
        hasTokenCount++;
      } else {
        noTokenCount++;
      }
    }
    console.log(`Of the 236: Has token/card: ${hasTokenCount}, No token/card: ${noTokenCount}`);

    // Sample a few noToken ones
    const sampleNoToken = unavailSubs.filter(s => {
      const c = custMap.get(s.customerId?.toString());
      const pmu = s.paymentMethodUsed || {};
      const subToken = pmu.tokenId || pmu.token;
      const insts = c?.moyasarPaymentInstruments || (c?.moyasarPaymentInstrument ? [c.moyasarPaymentInstrument] : []);
      return !subToken && !insts.some(i => i.tokenId || i.token);
    }).slice(0, 5);

    console.log('\nSample subscriptions with NO token/card:');
    for (const s of sampleNoToken) {
      const c = custMap.get(s.customerId?.toString());
      console.log({
        readableCode: s.readableCode,
        status: s.status,
        autoRenew: s.autoRenew,
        renewalDate: s.renewalDate,
        customer: c?.name,
        phone: c?.phone,
        pmu: s.paymentMethodUsed,
        custInstsCount: (c?.moyasarPaymentInstruments || []).length,
        retryCount: s.retryCount
      });
    }

    // 2. Check the 5 orders with failureReason == 'NO CARD RECORD'
    const noCardOrders = await db.collection('rushwash_sale_orders').find({
      'payments.failureReason': 'NO CARD RECORD'
    }).toArray();
    console.log(`\nFound ${noCardOrders.length} orders with failureReason == 'NO CARD RECORD'`);
    for (const o of noCardOrders) {
      console.log({
        readableCode: o.readableCode,
        createdAt: o.createdAt,
        status: o.status,
        sub: o.subscriptionReadableCode,
        payments: o.payments
      });
    }

    // 3. Are there subscriptions that failed renewal or expired with no saved card overall?
    // Let's check all subscriptions with firstRenewalFailureAt or lastRenewalFailureReason or renewalDate in past
    const failedSubs = await db.collection('rushwash_subscriptions').find({
      $or: [
        { lastRenewalFailureReason: { $exists: true, $ne: null } },
        { firstRenewalFailureAt: { $exists: true, $ne: null } }
      ]
    }).toArray();
    console.log(`\nTotal subscriptions with any failure flag in rushwash_subscriptions: ${failedSubs.length}`);
    const failureReasonsAll = {};
    for (const s of failedSubs) {
      const r = s.lastRenewalFailureReason || 'NO_REASON_SPECIFIED';
      failureReasonsAll[r] = (failureReasonsAll[r] || 0) + 1;
    }
    console.log('All failure reasons on subscriptions:', failureReasonsAll);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
