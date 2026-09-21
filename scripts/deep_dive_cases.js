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

    console.log('================================================================');
    console.log('DEEP DIVE: THE 4 CONFIRMED DOUBLE CHARGED SUBSCRIPTIONS');
    console.log('================================================================');

    const doubleChargedSubCodes = ['SUB-30589', 'SUB-34124', 'SUB-34150', 'SUB-33630'];

    for (const sc of doubleChargedSubCodes) {
      console.log(`\n================== ${sc} ==================`);
      const sub = await db.collection('rushwash_subscriptions').findOne({ readableCode: sc });
      console.log(`Subscription: ${sc} | status=${sub?.status} | renewalDate=${toKSA(sub?.renewalDate)} KSA | price=${sub?.price} SAR`);
      console.log(`Customer: ${sub?.customerSnapshot?.name} (${sub?.customerSnapshot?.phone})`);
      console.log(`Vehicles:`, sub?.vehicleLinks?.map(v => v.snapshot?.displayPlate || v.snapshot?.normalizedPlate));

      // Fetch all orders for this sub
      const subOrders = await db.collection('rushwash_sale_orders').find({
        $or: [
          { subscriptionReadableCode: sc },
          { notes: { $regex: new RegExp(sc, 'i') } }
        ]
      }).sort({ createdAt: 1 }).toArray();

      console.log(`Orders found (${subOrders.length}):`);
      for (const o of subOrders) {
        console.log(`  Order: ${o.readableCode} | Created: ${toKSA(o.createdAt)} KSA | Status: ${o.status} | Total: ${o.postDiscountTotal} SAR | isRenewal: ${o.isRenewal}`);
        console.log(`    Lines:`, o.lines?.map(l => `${l.displayNameEn || l.catalogCode} (${l.price} SAR)`));
        console.log(`    Payments:`, o.payments?.map(p => ({
          status: p.status,
          amount: p.amount,
          method: p.paymentMethodNameEn || p.provider,
          paymentId: p.providerPaymentId || p.paymentId,
          time: toKSA(p.occurredAt)
        })));
        if (o.refund) {
          console.log(`    REFUND INFO:`, o.refund);
        }
      }

      // Check refund requests collection
      const refundRequests = await db.collection('rushwash_refund_requests').find({
        $or: [
          { subscriptionReadableCode: sc },
          { saleOrderCode: { $in: subOrders.map(o => o.readableCode) } }
        ]
      }).toArray();
      if (refundRequests.length > 0) {
        console.log(`  Refund requests in DB:`, refundRequests);
      } else {
        console.log(`  Refund requests in DB: NONE`);
      }
    }

    console.log('\n================================================================');
    console.log('DEEP DIVE: THE 5 CHARGED THEN ATTEMPTED SUBSCRIPTIONS');
    console.log('================================================================');

    const chargedThenAttemptedCodes = ['SUB-29833', 'SUB-31115', 'SUB-31220', 'SUB-31365', 'SUB-33098'];

    for (const sc of chargedThenAttemptedCodes) {
      console.log(`\n================== ${sc} ==================`);
      const sub = await db.collection('rushwash_subscriptions').findOne({ readableCode: sc });
      console.log(`Subscription: ${sc} | status=${sub?.status} | renewalDate=${toKSA(sub?.renewalDate)} KSA | price=${sub?.price} SAR`);
      console.log(`Customer: ${sub?.customerSnapshot?.name} (${sub?.customerSnapshot?.phone})`);
      console.log(`Vehicles:`, sub?.vehicleLinks?.map(v => v.snapshot?.displayPlate || v.snapshot?.normalizedPlate));

      const subOrders = await db.collection('rushwash_sale_orders').find({
        $or: [
          { subscriptionReadableCode: sc },
          { notes: { $regex: new RegExp(sc, 'i') } }
        ]
      }).sort({ createdAt: 1 }).toArray();

      console.log(`Orders found (${subOrders.length}):`);
      for (const o of subOrders) {
        const p = o.payments?.[0] || {};
        console.log(`  Order: ${o.readableCode} | Created: ${toKSA(o.createdAt)} KSA | Status: ${o.status} | Total: ${o.postDiscountTotal} SAR | FailReason: ${p.failureReason || 'N/A'}`);
        console.log(`    Payment: status=${p.status}, method=${p.paymentMethodNameEn || p.provider}, id=${p.providerPaymentId}`);
      }

      // Check audit events for this sub
      const audits = await db.collection('rushwash_audit_events').find({
        $or: [
          { entityReadableCode: sc },
          { 'data.subscriptionReadableCode': sc },
          { 'payload.subscriptionReadableCode': sc }
        ]
      }).sort({ occurredAt: 1 }).toArray();
      console.log(`Audit events for ${sc} (${audits.length}):`);
      for (const a of audits.slice(-5)) {
        console.log(`  ${toKSA(a.occurredAt)} KSA | ${a.eventType} | Actor: ${a.actorReadableCode || a.actorType}`);
      }
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
