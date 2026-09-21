import 'dotenv/config';
import { MongoClient } from 'mongodb';
import fs from 'fs';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('Fetching all subscriptions, customers, and orders...');
    const subs = await db.collection('rushwash_subscriptions').find({}).toArray();
    const custs = await db.collection('rushwash_customers').find({}).toArray();
    const custMap = new Map(custs.map(c => [c._id.toString(), c]));

    // Check all orders to see if any renewal orders failed with NO CARD or token issues
    const renewalOrders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { isRenewal: true },
        { subscriptionTransitionKind: 'renewal' },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }).toArray();

    console.log(`Loaded ${subs.length} subs, ${custs.length} custs, ${renewalOrders.length} renewal orders.`);

    // Check orders with "NO CARD RECORD" or missing card
    const ordersWithNoCard = [];
    for (const o of renewalOrders) {
      for (const p of o.payments || []) {
        if (p.failureReason === 'NO CARD RECORD' || (p.failureReason && /no card/i.test(p.failureReason))) {
          ordersWithNoCard.push({
            orderCode: o.readableCode,
            subCode: o.subscriptionReadableCode,
            date: o.createdAt,
            failureReason: p.failureReason,
            amount: o.postDiscountTotal || p.amount,
            plate: o.normalizedPlate,
            status: o.status
          });
        }
      }
    }
    console.log(`\nRenewal orders failed with NO CARD RECORD: ${ordersWithNoCard.length}`);
    console.table(ordersWithNoCard);

    // Now let's analyze subscriptions where renewal failed or subscription expired and there is NO saved card.
    // Definition of hasCard:
    function getCardDetails(s, c) {
      const pmu = s.paymentMethodUsed || {};
      const subToken = pmu.tokenId || pmu.token || pmu.instrumentId;
      const insts = c?.moyasarPaymentInstruments || (c?.moyasarPaymentInstrument ? [c.moyasarPaymentInstrument] : []);
      const validInst = insts.find(i => i.tokenId || i.token || i.id);

      const hasCard = Boolean(subToken || validInst);
      return {
        hasCard,
        subToken: subToken || null,
        brand: pmu.brand || validInst?.brand || validInst?.cardType || null,
        lastFour: pmu.lastFour || pmu.last4 || validInst?.lastFour || validInst?.last4 || null
      };
    }

    // Let's check subscriptions with lastRenewalFailureReason
    const failReasonCounts = {};
    const subsWithNoCardAndFailed = [];
    const subsWithExplicitNoCardFailure = [];

    for (const s of subs) {
      const c = custMap.get(s.customerId?.toString());
      const cardInfo = getCardDetails(s, c);
      const reason = s.lastRenewalFailureReason;

      if (reason) {
        failReasonCounts[reason] = (failReasonCounts[reason] || 0) + 1;
      }

      // Check if explicit failure reason is related to card/token
      if (reason === 'renewal_charge_unavailable' || reason === 'NO CARD RECORD' || (reason && /card/i.test(reason))) {
        subsWithExplicitNoCardFailure.push({
          subCode: s.readableCode,
          status: s.status,
          autoRenew: s.autoRenew,
          renewalDate: s.renewalDate,
          price: s.price,
          reason,
          hasCard: cardInfo.hasCard,
          brand: cardInfo.brand,
          lastFour: cardInfo.lastFour,
          customerName: c?.name || s.customerSnapshot?.name,
          phone: c?.phone || s.customerSnapshot?.phone
        });
      }

      // If status is expired and autoRenew is true, but hasCard is false
      if ((s.status === 'expired' || s.lastRenewalFailureReason) && s.autoRenew && !cardInfo.hasCard) {
        subsWithNoCardAndFailed.push({
          subCode: s.readableCode,
          status: s.status,
          autoRenew: s.autoRenew,
          renewalDate: s.renewalDate,
          firstFailure: s.firstRenewalFailureAt,
          retryCount: s.retryCount,
          lastRenewalFailureReason: s.lastRenewalFailureReason,
          price: s.price,
          packageName: s.packageNameEn || s.packageSnapshot?.servicePackageCode,
          customerName: c?.name || s.customerSnapshot?.name,
          phone: c?.phone || s.customerSnapshot?.phone,
          plate: s.vehicleLinks?.[0]?.snapshot?.displayPlate || s.vehicleLinks?.[0]?.snapshot?.normalizedPlate
        });
      }
    }

    console.log('\n--- Subscriptions with explicit card-related failure reason ---');
    console.log(`Total: ${subsWithExplicitNoCardFailure.length}`);
    const byReasonAndCard = {};
    for (const item of subsWithExplicitNoCardFailure) {
      const k = `${item.reason} | hasCard: ${item.hasCard} | status: ${item.status}`;
      byReasonAndCard[k] = (byReasonAndCard[k] || 0) + 1;
    }
    console.log(JSON.stringify(byReasonAndCard, null, 2));

    console.log(`\n--- Subscriptions that are expired/failed with autoRenew=true and NO SAVED CARD ---`);
    console.log(`Total count: ${subsWithNoCardAndFailed.length}`);
    
    // Group by lastRenewalFailureReason and status
    const breakdown = {};
    for (const item of subsWithNoCardAndFailed) {
      const k = `${item.status} | reason: ${item.lastRenewalFailureReason || 'none'}`;
      breakdown[k] = (breakdown[k] || 0) + 1;
    }
    console.log(JSON.stringify(breakdown, null, 2));

    // Also check active subscriptions that are due or overdue with autoRenew=true and NO card
    const activeOverdueNoCard = subs.filter(s => {
      if (s.status !== 'active' || !s.autoRenew) return false;
      const c = custMap.get(s.customerId?.toString());
      const cardInfo = getCardDetails(s, c);
      return !cardInfo.hasCard && s.renewalDate && new Date(s.renewalDate) <= new Date();
    });
    console.log(`\nActive overdue subscriptions with autoRenew=true and NO CARD: ${activeOverdueNoCard.length}`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
