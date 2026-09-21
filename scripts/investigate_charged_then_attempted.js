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

    const projection = {
      readableCode: 1,
      createdAt: 1,
      status: 1,
      postDiscountTotal: 1,
      lineSubtotal: 1,
      netTotal: 1,
      payments: 1,
      subscriptionReadableCode: 1,
      subCode: 1,
      notes: 1,
      normalizedPlate: 1,
      'vehicleSnapshot.normalizedPlate': 1,
      'vehicleSnapshot.displayPlate': 1,
      'customerSnapshot.name': 1,
      'customerSnapshot.phone': 1,
      'customerSnapshot.readableCode': 1,
      customerId: 1,
      isRenewal: 1,
      subscriptionTransitionKind: 1
    };

    const orders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { isRenewal: true },
        { isRenewal: 1 },
        { orderType: 'renewal' },
        { subscriptionTransitionKind: { $in: ['renewal', 'renew'] } },
        { subscriptionReadableCode: { $exists: true, $nin: [null, ''] } },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }, { projection }).toArray();

    orders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    function isOrderPaid(o) {
      if (['paid', 'completed'].includes(o.status)) return true;
      if (o.payments && o.payments.some(p => ['paid', 'completed', 'success', 'succeeded', 'captured'].includes(p.status))) {
        return true;
      }
      return false;
    }

    function getSubCode(o) {
      if (o.subscriptionReadableCode) return o.subscriptionReadableCode;
      if (o.subCode) return o.subCode;
      if (o.notes) {
        const m = o.notes.match(/SUB-\d+/i);
        if (m) return m[0].toUpperCase();
      }
      return null;
    }

    function getPlate(o) {
      return o.normalizedPlate || o.vehicleSnapshot?.normalizedPlate || o.vehicleSnapshot?.displayPlate || null;
    }

    // Group by subscription
    const bySub = new Map();
    for (const o of orders) {
      const sc = getSubCode(o);
      if (!sc) continue;
      if (!bySub.has(sc)) bySub.set(sc, []);
      bySub.get(sc).push(o);
    }

    console.log('================================================================');
    console.log('PART 1: INVESTIGATING ALL "CHARGED THEN ATTEMPTED AGAIN" CASES');
    console.log('================================================================');

    const chargedThenAttemptedSubs = new Map();
    const doubleChargedSubs = new Map();

    for (const [sc, list] of bySub.entries()) {
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      for (let i = 0; i < list.length; i++) {
        const o1 = list[i];
        if (!isOrderPaid(o1)) continue;

        const d1 = new Date(o1.createdAt);

        for (let j = i + 1; j < list.length; j++) {
          const o2 = list[j];
          const d2 = new Date(o2.createdAt);
          const diffDays = (d2 - d1) / (86400 * 1000);

          // If within 27 days (meaning same renewal cycle)
          if (diffDays <= 27) {
            const isO2Paid = isOrderPaid(o2);
            const targetMap = isO2Paid ? doubleChargedSubs : chargedThenAttemptedSubs;
            if (!targetMap.has(sc)) {
              targetMap.set(sc, {
                subCode: sc,
                paidOrder: o1,
                subsequentOrders: []
              });
            }
            targetMap.get(sc).subsequentOrders.push({
              order: o2,
              gapDays: Math.round(diffDays * 10) / 10,
              paid: isO2Paid
            });
          }
        }
      }
    }

    console.log(`\nFound ${doubleChargedSubs.size} subscriptions that were DOUBLE CHARGED within 27 days!`);
    for (const [sc, data] of doubleChargedSubs.entries()) {
      const o1 = data.paidOrder;
      const subDoc = await db.collection('rushwash_subscriptions').findOne({ readableCode: sc });
      console.log(`\n[DOUBLE CHARGED] Subscription: ${sc} | Plate: ${getPlate(o1)}`);
      console.log(`  Customer: ${o1.customerSnapshot?.name} (${o1.customerSnapshot?.phone})`);
      console.log(`  Sub Status in DB: ${subDoc?.status} | renewalDate: ${toKSA(subDoc?.renewalDate)} KSA | nextBillingDate: ${toKSA(subDoc?.nextBillingDate)} KSA`);
      console.log(`  Initial Paid Order: ${o1.readableCode} | Date: ${toKSA(o1.createdAt)} KSA | Status: ${o1.status} | Total: ${o1.postDiscountTotal} SAR`);
      for (const so of data.subsequentOrders) {
        const o2 = so.order;
        console.log(`    -> Double Charged Order: ${o2.readableCode} | Date: ${toKSA(o2.createdAt)} KSA (${so.gapDays} days later) | Status: ${o2.status} | Total: ${o2.postDiscountTotal} SAR | ProviderId: ${o2.payments?.[0]?.providerPaymentId}`);
      }
    }

    console.log(`\n================================================================`);
    console.log(`PART 2: ALL SUBSCRIPTIONS CHARGED, THEN ATTEMPTED AGAIN (FAILED/CANCELLED)`);
    console.log(`Found ${chargedThenAttemptedSubs.size} subscriptions with attempts AFTER a successful charge!`);
    console.log(`================================================================`);

    for (const [sc, data] of chargedThenAttemptedSubs.entries()) {
      const o1 = data.paidOrder;
      const subDoc = await db.collection('rushwash_subscriptions').findOne({ readableCode: sc });
      console.log(`\n----------------------------------------------------------------`);
      console.log(`Subscription: ${sc} | Plate: ${getPlate(o1)} | Customer: ${o1.customerSnapshot?.name} (${o1.customerSnapshot?.phone})`);
      console.log(`  Current Sub State: status=${subDoc?.status}, renewalDate=${toKSA(subDoc?.renewalDate)} KSA, package=${subDoc?.packageReadableCode || subDoc?.planReadableCode}`);
      console.log(`  INITIAL CHARGED ORDER: ${o1.readableCode} | Date: ${toKSA(o1.createdAt)} KSA | Total: ${o1.postDiscountTotal} SAR | Status: ${o1.status}`);
      console.log(`  SUBSEQUENT ATTEMPTS (${data.subsequentOrders.length}):`);
      for (const so of data.subsequentOrders) {
        const o2 = so.order;
        const p2 = o2.payments?.[0] || {};
        console.log(`    - ${o2.readableCode} | Date: ${toKSA(o2.createdAt)} KSA (+${so.gapDays} days) | Status: ${o2.status} | Reason: ${p2.failureReason || p2.statusDescription || o2.status}`);
      }
    }

    // PART 3: Today's case inspection (Sep 16)
    console.log(`\n================================================================`);
    console.log(`PART 3: DEEP DIVE ON TODAY'S (SEP 16) DOUBLE CHARGE: SUB-33630`);
    console.log(`================================================================`);
    const sub33630 = await db.collection('rushwash_subscriptions').findOne({ readableCode: 'SUB-33630' });
    console.log('SUB-33630 doc:', JSON.stringify(sub33630, null, 2));

    const orders33630 = await db.collection('rushwash_sale_orders').find({
      $or: [
        { subscriptionReadableCode: 'SUB-33630' },
        { notes: { $regex: /SUB-33630/i } }
      ]
    }).toArray();
    console.log('\nAll orders for SUB-33630:');
    for (const o of orders33630) {
      console.log(`Order ${o.readableCode} | Created: ${toKSA(o.createdAt)} KSA | Status: ${o.status} | Total: ${o.postDiscountTotal} SAR | Payments:`, JSON.stringify(o.payments));
    }

    // PART 4: Why were those subscriptions attempted again?
    // Let's inspect why SUB-29833 (56REV), SUB-31220 (2TSN), SUB-31115 (5081RRJ), SUB-31365 (3908KUD) kept getting attempted
    console.log(`\n================================================================`);
    console.log(`PART 4: ROOT CAUSE ANALYSIS OF RE-ATTEMPTS AFTER SUCCESS`);
    console.log(`================================================================`);
    const rootCauseSubs = ['SUB-29833', 'SUB-31220', 'SUB-31115', 'SUB-31365'];
    for (const sc of rootCauseSubs) {
      const s = await db.collection('rushwash_subscriptions').findOne({ readableCode: sc });
      console.log(`\nSubscription ${sc}:`);
      console.log(`  Status: ${s?.status}`);
      console.log(`  renewalDate: ${toKSA(s?.renewalDate)} KSA (${s?.renewalDate?.toISOString()})`);
      console.log(`  startsAt: ${toKSA(s?.startsAt)} KSA`);
      console.log(`  expiresAt: ${toKSA(s?.expiresAt)} KSA`);
      console.log(`  lastRenewedAt / updatedAt: ${toKSA(s?.updatedAt)} KSA`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
