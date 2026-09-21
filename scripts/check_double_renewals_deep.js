import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('================================================================');
    console.log('DEEP AUDIT: DOUBLE RENEWAL ATTEMPTS & POST-CHARGE ATTEMPTS');
    console.log('================================================================\n');

    console.log('Fetching renewal orders with projection...');
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

    const renewalOrders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { isRenewal: true },
        { isRenewal: 1 },
        { orderType: 'renewal' },
        { subscriptionTransitionKind: { $in: ['renewal', 'renew'] } },
        { subscriptionReadableCode: { $exists: true, $nin: [null, ''] } },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }, { projection }).toArray();

    console.log(`Fetched ${renewalOrders.length} total renewal orders. Sorting in memory...`);
    renewalOrders.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    function isOrderPaid(o) {
      if (['paid', 'completed'].includes(o.status)) return true;
      if (o.payments && o.payments.some(p => ['paid', 'completed', 'success', 'succeeded', 'captured'].includes(p.status))) {
        return true;
      }
      return false;
    }

    function getPaidPayment(o) {
      if (!o.payments) return null;
      return o.payments.find(p => ['paid', 'completed', 'success', 'succeeded', 'captured'].includes(p.status));
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

    function getCustId(o) {
      if (o.customerId) return o.customerId.toString();
      return null;
    }

    function toKSA(d) {
      if (!d) return '';
      const dt = new Date(d);
      const ksa = new Date(dt.getTime() + 3 * 3600 * 1000);
      return ksa.toISOString().replace('T', ' ').slice(0, 19);
    }

    // CHECK 1: Within a single order, was there an attempt AFTER a paid payment?
    console.log('\n----------------------------------------------------------------');
    console.log('CHECK 1: Inside single order, payment attempted AFTER successful charge');
    console.log('----------------------------------------------------------------');
    let intraOrderCases = [];
    for (const o of renewalOrders) {
      const payments = o.payments || [];
      if (payments.length <= 1) continue;

      let foundPaidIndex = -1;
      for (let i = 0; i < payments.length; i++) {
        if (['paid', 'completed', 'success', 'succeeded', 'captured'].includes(payments[i].status)) {
          foundPaidIndex = i;
          break;
        }
      }

      if (foundPaidIndex !== -1 && foundPaidIndex < payments.length - 1) {
        intraOrderCases.push({
          orderCode: o.readableCode,
          subCode: getSubCode(o),
          plate: getPlate(o),
          status: o.status,
          paidAttempt: payments[foundPaidIndex],
          subsequentPayments: payments.slice(foundPaidIndex + 1)
        });
      }
    }
    console.log(`Intra-order cases found: ${intraOrderCases.length}`);
    for (const c of intraOrderCases) {
      console.log(`Order ${c.orderCode} (Sub: ${c.subCode}, Plate: ${c.plate}):`);
      console.log(`  Paid Payment: attempt ${c.paidAttempt.attemptNumber}, status ${c.paidAttempt.status}, amount ${c.paidAttempt.amount}`);
      console.log(`  Subsequent Payments:`, c.subsequentPayments);
    }

    // CHECK 2: Grouping by Subscription Code
    console.log('\n----------------------------------------------------------------');
    console.log('CHECK 2: By Subscription Code - Any renewal attempt after a charged order');
    console.log('----------------------------------------------------------------');
    const bySub = new Map();
    for (const o of renewalOrders) {
      const sc = getSubCode(o);
      if (!sc) continue;
      if (!bySub.has(sc)) bySub.set(sc, []);
      bySub.get(sc).push(o);
    }

    console.log(`Total unique subscriptions with renewal orders: ${bySub.size}`);

    let chargedThenAttemptedBySub = [];
    let doubleChargedBySub = [];

    for (const [subCode, list] of bySub.entries()) {
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      for (let i = 0; i < list.length; i++) {
        const o1 = list[i];
        if (!isOrderPaid(o1)) continue;

        const d1 = new Date(o1.createdAt);

        for (let j = i + 1; j < list.length; j++) {
          const o2 = list[j];
          const d2 = new Date(o2.createdAt);
          const diffHours = (d2 - d1) / (3600 * 1000);
          const diffDays = diffHours / 24;

          // If within same cycle (say <= 27 days):
          if (diffDays <= 27) {
            const o2Paid = isOrderPaid(o2);
            const caseInfo = {
              subCode,
              plate: getPlate(o1) || getPlate(o2),
              customerSnapshot: o1.customerSnapshot || o2.customerSnapshot,
              order1: {
                code: o1.readableCode,
                dateKSA: toKSA(o1.createdAt),
                status: o1.status,
                total: o1.postDiscountTotal || o1.netTotal,
                payments: o1.payments
              },
              order2: {
                code: o2.readableCode,
                dateKSA: toKSA(o2.createdAt),
                status: o2.status,
                total: o2.postDiscountTotal || o2.netTotal,
                payments: o2.payments
              },
              gapHours: Math.round(diffHours * 10) / 10,
              gapDays: Math.round(diffDays * 10) / 10,
              o2Paid
            };

            if (o2Paid) {
              doubleChargedBySub.push(caseInfo);
            } else {
              chargedThenAttemptedBySub.push(caseInfo);
            }
          }
        }
      }
    }

    console.log(`\n>>> Double Charged for Same Subscription (both paid within 27 days): ${doubleChargedBySub.length}`);
    for (const c of doubleChargedBySub) {
      console.log(`\n[DOUBLE CHARGED] Sub: ${c.subCode} | Plate: ${c.plate} | Cust: ${c.customerSnapshot?.name} (${c.customerSnapshot?.phone})`);
      console.log(`  Gap: ${c.gapDays} days (${c.gapHours} hours)`);
      console.log(`  Order 1: ${c.order1.code} | Date: ${c.order1.dateKSA} KSA | Status: ${c.order1.status} | Total: ${c.order1.total} SAR`);
      console.log(`  Order 2: ${c.order2.code} | Date: ${c.order2.dateKSA} KSA | Status: ${c.order2.status} | Total: ${c.order2.total} SAR`);
    }

    console.log(`\n>>> Charged Then Attempted Again for Same Subscription (O1 paid, O2 attempted within 27 days): ${chargedThenAttemptedBySub.length}`);
    for (const c of chargedThenAttemptedBySub) {
      const p2 = c.order2.payments?.[0];
      const failReason = p2?.failureReason || p2?.gatewayResponse?.message || c.order2.status;
      console.log(`\n[CHARGED THEN ATTEMPTED AGAIN] Sub: ${c.subCode} | Plate: ${c.plate} | Cust: ${c.customerSnapshot?.name} (${c.customerSnapshot?.phone})`);
      console.log(`  Gap: ${c.gapDays} days (${c.gapHours} hours)`);
      console.log(`  Order 1 (PAID): ${c.order1.code} | Date: ${c.order1.dateKSA} KSA | Status: ${c.order1.status} | Total: ${c.order1.total} SAR`);
      console.log(`  Order 2 (ATTEMPTED): ${c.order2.code} | Date: ${c.order2.dateKSA} KSA | Status: ${c.order2.status} | Reason: ${failReason}`);
    }

    // CHECK 3: Grouping by Plate (in case subCode differed or was missing)
    console.log('\n----------------------------------------------------------------');
    console.log('CHECK 3: By Plate - Charged then attempted again within 27 days');
    console.log('----------------------------------------------------------------');
    const byPlate = new Map();
    for (const o of renewalOrders) {
      const p = getPlate(o);
      if (!p) continue;
      if (!byPlate.has(p)) byPlate.set(p, []);
      byPlate.get(p).push(o);
    }

    let chargedThenAttemptedByPlate = [];
    let doubleChargedByPlate = [];

    for (const [plate, list] of byPlate.entries()) {
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      for (let i = 0; i < list.length; i++) {
        const o1 = list[i];
        if (!isOrderPaid(o1)) continue;

        const d1 = new Date(o1.createdAt);

        for (let j = i + 1; j < list.length; j++) {
          const o2 = list[j];
          const d2 = new Date(o2.createdAt);
          const diffHours = (d2 - d1) / (3600 * 1000);
          const diffDays = diffHours / 24;

          if (diffDays <= 27) {
            const o2Paid = isOrderPaid(o2);
            const caseInfo = {
              plate,
              sub1: getSubCode(o1),
              sub2: getSubCode(o2),
              customerSnapshot: o1.customerSnapshot || o2.customerSnapshot,
              order1: {
                code: o1.readableCode,
                dateKSA: toKSA(o1.createdAt),
                status: o1.status,
                total: o1.postDiscountTotal || o1.netTotal,
                payments: o1.payments
              },
              order2: {
                code: o2.readableCode,
                dateKSA: toKSA(o2.createdAt),
                status: o2.status,
                total: o2.postDiscountTotal || o2.netTotal,
                payments: o2.payments
              },
              gapHours: Math.round(diffHours * 10) / 10,
              gapDays: Math.round(diffDays * 10) / 10,
              o2Paid
            };

            if (o2Paid) {
              doubleChargedByPlate.push(caseInfo);
            } else {
              chargedThenAttemptedByPlate.push(caseInfo);
            }
          }
        }
      }
    }

    console.log(`\n>>> Double Charged for Same Plate (both paid within 27 days): ${doubleChargedByPlate.length}`);
    for (const c of doubleChargedByPlate) {
      console.log(`\n[DOUBLE CHARGED PLATE] Plate: ${c.plate} | Sub1: ${c.sub1} vs Sub2: ${c.sub2} | Cust: ${c.customerSnapshot?.name} (${c.customerSnapshot?.phone})`);
      console.log(`  Gap: ${c.gapDays} days (${c.gapHours} hours)`);
      console.log(`  Order 1: ${c.order1.code} | Date: ${c.order1.dateKSA} KSA | Status: ${c.order1.status} | Total: ${c.order1.total} SAR`);
      console.log(`  Order 2: ${c.order2.code} | Date: ${c.order2.dateKSA} KSA | Status: ${c.order2.status} | Total: ${c.order2.total} SAR`);
    }

    console.log(`\n>>> Charged Then Attempted Again for Same Plate (O1 paid, O2 attempted within 27 days): ${chargedThenAttemptedByPlate.length}`);
    for (const c of chargedThenAttemptedByPlate) {
      const p2 = c.order2.payments?.[0];
      const failReason = p2?.failureReason || p2?.gatewayResponse?.message || c.order2.status;
      console.log(`\n[CHARGED THEN ATTEMPTED AGAIN PLATE] Plate: ${c.plate} | Sub1: ${c.sub1} vs Sub2: ${c.sub2} | Cust: ${c.customerSnapshot?.name} (${c.customerSnapshot?.phone})`);
      console.log(`  Gap: ${c.gapDays} days (${c.gapHours} hours)`);
      console.log(`  Order 1 (PAID): ${c.order1.code} | Date: ${c.order1.dateKSA} KSA | Status: ${c.order1.status} | Total: ${c.order1.total} SAR`);
      console.log(`  Order 2 (ATTEMPTED): ${c.order2.code} | Date: ${c.order2.dateKSA} KSA | Status: ${c.order2.status} | Reason: ${failReason}`);
    }

    // CHECK 4: Check Moyasar payment IDs directly to see if any Moyasar payment ID was charged twice or duplicated
    console.log('\n----------------------------------------------------------------');
    console.log('CHECK 4: Duplicate Moyasar payment IDs or Moyasar tokens');
    console.log('----------------------------------------------------------------');
    const moyasarIdMap = new Map();
    for (const o of renewalOrders) {
      for (const p of o.payments || []) {
        const pid = p.providerPaymentId || p.paymentId || p.transactionId;
        if (pid) {
          if (!moyasarIdMap.has(pid)) moyasarIdMap.set(pid, []);
          moyasarIdMap.get(pid).push({ orderCode: o.readableCode, payment: p });
        }
      }
    }
    const dupPids = Array.from(moyasarIdMap.entries()).filter(([k, v]) => v.length > 1);
    console.log(`Duplicate Provider Payment IDs: ${dupPids.length}`);
    for (const [pid, list] of dupPids) {
      console.log(`  Payment ID ${pid} appears in orders:`, list.map(x => x.orderCode));
    }

    // CHECK 5: Multiple renewal attempts in a single day (Same subscription attempted multiple times in 1 calendar day)
    console.log('\n----------------------------------------------------------------');
    console.log('CHECK 5: Multiple Renewal Attempts on the SAME Calendar Day (KSA)');
    console.log('----------------------------------------------------------------');
    const subDayMap = new Map();
    for (const o of renewalOrders) {
      const sc = getSubCode(o);
      if (!sc) continue;
      const ksaDate = toKSA(o.createdAt).slice(0, 10);
      const key = `${sc}_${ksaDate}`;
      if (!subDayMap.has(key)) subDayMap.set(key, []);
      subDayMap.get(key).push(o);
    }
    const multiAttemptsSameDay = Array.from(subDayMap.entries()).filter(([k, v]) => v.length > 1);
    console.log(`Total Subscription + Day pairs with > 1 attempt on same day: ${multiAttemptsSameDay.length}`);
    
    // Breakdown of multi attempts same day
    let sameDayChargedThenAttempted = 0;
    let sameDayDoublePaid = 0;
    let sameDayRepeatedFailed = 0;
    let sameDayFailedThenPaid = 0;

    for (const [key, orders] of multiAttemptsSameDay) {
      const paidOrders = orders.filter(isOrderPaid);
      const failedOrders = orders.filter(o => !isOrderPaid(o));
      if (paidOrders.length > 1) {
        sameDayDoublePaid++;
        console.log(`  [SAME DAY DOUBLE CHARGED] ${key}:`, orders.map(o => `${o.readableCode} (${toKSA(o.createdAt).slice(11, 19)}, ${o.status})`).join(', '));
      } else if (paidOrders.length === 1 && failedOrders.length > 0) {
        // Did the paid order happen BEFORE or AFTER the failed order?
        const paidOrder = paidOrders[0];
        const failedBefore = failedOrders.filter(f => new Date(f.createdAt) < new Date(paidOrder.createdAt));
        const failedAfter = failedOrders.filter(f => new Date(f.createdAt) > new Date(paidOrder.createdAt));
        if (failedAfter.length > 0) {
          sameDayChargedThenAttempted++;
          console.log(`  [SAME DAY CHARGED THEN ATTEMPTED AGAIN] ${key}:`, orders.map(o => `${o.readableCode} (${toKSA(o.createdAt).slice(11, 19)}, ${o.status})`).join(', '));
        } else {
          sameDayFailedThenPaid++;
        }
      } else {
        sameDayRepeatedFailed++;
      }
    }

    console.log(`  Breakdown of ${multiAttemptsSameDay.length} same-day multiple attempts:`);
    console.log(`    - Double Charged on same day: ${sameDayDoublePaid}`);
    console.log(`    - Charged THEN attempted again on same day: ${sameDayChargedThenAttempted}`);
    console.log(`    - Failed then recovered/paid on same day: ${sameDayFailedThenPaid}`);
    console.log(`    - Multiple failed attempts on same day: ${sameDayRepeatedFailed}`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
