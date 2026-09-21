import 'dotenv/config';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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
      subscriptionTransitionKind: 1,
      refund: 1
    };

    console.log('Fetching orders...');
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
      return o.normalizedPlate || o.vehicleSnapshot?.normalizedPlate || o.vehicleSnapshot?.displayPlate || '';
    }

    function getCustName(o) {
      return o.customerSnapshot?.name || '';
    }

    function getCustPhone(o) {
      return o.customerSnapshot?.phone || '';
    }

    // Collect all relevant subscription codes from orders
    const neededSubCodes = new Set();
    for (const o of orders) {
      const sc = getSubCode(o);
      if (sc) neededSubCodes.add(sc);
    }

    console.log(`Fetching only the ${neededSubCodes.size} relevant subscriptions...`);
    const subProj = {
      readableCode: 1,
      status: 1,
      renewalDate: 1,
      'customerSnapshot.name': 1,
      'customerSnapshot.phone': 1,
      'vehicleLinks.snapshot.displayPlate': 1
    };
    const subs = await db.collection('rushwash_subscriptions').find(
      { readableCode: { $in: Array.from(neededSubCodes) } },
      { projection: subProj }
    ).toArray();

    const subMap = new Map();
    for (const s of subs) {
      subMap.set(s.readableCode, s);
    }

    // Fetch refund requests
    const refunds = await db.collection('rushwash_refund_requests').find({}).toArray();
    const refundOrderMap = new Map();
    for (const r of refunds) {
      if (r.saleOrderCode) {
        refundOrderMap.set(r.saleOrderCode, r);
      }
    }

    // Group orders by subscription
    const bySub = new Map();
    for (const o of orders) {
      const sc = getSubCode(o);
      if (!sc) continue;
      if (!bySub.has(sc)) bySub.set(sc, []);
      bySub.get(sc).push(o);
    }

    // Also group by plate for cross-checking
    const byPlate = new Map();
    for (const o of orders) {
      const p = getPlate(o);
      if (!p) continue;
      if (!byPlate.has(p)) byPlate.set(p, []);
      byPlate.get(p).push(o);
    }

    const rows = [];
    const seenPairs = new Set();

    // 1. Process Subscription-grouped orders
    for (const [sc, list] of bySub.entries()) {
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      for (let i = 0; i < list.length; i++) {
        const o1 = list[i];
        if (!isOrderPaid(o1)) continue;

        const d1 = new Date(o1.createdAt);
        const p1 = getPaidPayment(o1) || o1.payments?.[0] || {};

        for (let j = i + 1; j < list.length; j++) {
          const o2 = list[j];
          const d2 = new Date(o2.createdAt);
          const diffMs = d2 - d1;
          const diffDays = diffMs / (86400 * 1000);
          const diffHours = diffMs / (3600 * 1000);

          // We check within 28 days
          if (diffDays > 28) continue;

          const pairKey = `${o1.readableCode}_${o2.readableCode}`;
          if (seenPairs.has(pairKey)) continue;
          seenPairs.add(pairKey);

          const o2Paid = isOrderPaid(o2);
          const p2 = (o2Paid ? getPaidPayment(o2) : null) || o2.payments?.[0] || {};
          const subDoc = subMap.get(sc);

          let category = '';
          let actionRequired = '';

          if (o2Paid) {
            category = 'Double Charged (Billed Twice)';
            const r1 = refundOrderMap.get(o1.readableCode) || o1.refund;
            const r2 = refundOrderMap.get(o2.readableCode) || o2.refund;
            if (r1 || r2) {
              actionRequired = 'Already Refunded';
            } else {
              actionRequired = `URGENT: Review & Refund Second Charge (${o2.postDiscountTotal || p2.amount || 0} SAR)`;
            }
          } else {
            category = 'Charged Then Re-attempted (Failed/Cancelled Retry)';
            actionRequired = 'Verify subscription renewalDate & cancel unnecessary automated retries';
          }

          rows.push({
            subscriptionCode: sc,
            plateNumber: getPlate(o1) || getPlate(o2) || (subDoc?.vehicleLinks?.[0]?.snapshot?.displayPlate || ''),
            customerName: getCustName(o1) || getCustName(o2) || (subDoc?.customerSnapshot?.name || ''),
            customerPhone: getCustPhone(o1) || getCustPhone(o2) || (subDoc?.customerSnapshot?.phone || ''),
            issueCategory: category,
            initialPaidOrderCode: o1.readableCode,
            initialPaidDateKSA: toKSA(o1.createdAt),
            initialPaidAmountSar: o1.postDiscountTotal || p1.amount || 0,
            initialPaymentMethod: p1.paymentMethodNameEn || p1.provider || 'Saved card',
            initialProviderPaymentId: p1.providerPaymentId || p1.paymentId || '',
            subsequentOrderCode: o2.readableCode,
            subsequentOrderDateKSA: toKSA(o2.createdAt),
            subsequentOrderStatus: o2.status,
            subsequentOrderAmountSar: o2.postDiscountTotal || p2.amount || 0,
            subsequentPaymentMethod: p2.paymentMethodNameEn || p2.provider || 'Saved card',
            subsequentFailureReason: p2.failureReason || p2.gatewayResponse?.message || (o2Paid ? 'SUCCESSFUL_CHARGE' : o2.status),
            subsequentProviderPaymentId: p2.providerPaymentId || p2.paymentId || '',
            gapDays: Math.round(diffDays * 10) / 10,
            gapHours: Math.round(diffHours * 10) / 10,
            currentSubStatus: subDoc?.status || 'unknown',
            currentSubRenewalDateKSA: toKSA(subDoc?.renewalDate),
            actionRequired
          });
        }
      }
    }

    // 2. Cross check by Plate for any cases where sub code was missing on one of the orders
    for (const [plate, list] of byPlate.entries()) {
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      for (let i = 0; i < list.length; i++) {
        const o1 = list[i];
        if (!isOrderPaid(o1)) continue;

        const d1 = new Date(o1.createdAt);
        const p1 = getPaidPayment(o1) || o1.payments?.[0] || {};

        for (let j = i + 1; j < list.length; j++) {
          const o2 = list[j];
          const d2 = new Date(o2.createdAt);
          const diffMs = d2 - d1;
          const diffDays = diffMs / (86400 * 1000);
          const diffHours = diffMs / (3600 * 1000);

          if (diffDays > 28) continue;

          const pairKey = `${o1.readableCode}_${o2.readableCode}`;
          if (seenPairs.has(pairKey)) continue;
          seenPairs.add(pairKey);

          const sc1 = getSubCode(o1);
          const sc2 = getSubCode(o2);
          const sc = sc1 || sc2 || 'N/A';
          const subDoc = subMap.get(sc);

          const o2Paid = isOrderPaid(o2);
          const p2 = (o2Paid ? getPaidPayment(o2) : null) || o2.payments?.[0] || {};

          let category = '';
          let actionRequired = '';

          if (o2Paid) {
            category = 'Double Charged (Same Plate Billed Twice)';
            const r1 = refundOrderMap.get(o1.readableCode) || o1.refund;
            const r2 = refundOrderMap.get(o2.readableCode) || o2.refund;
            if (r1 || r2) {
              actionRequired = 'Already Refunded';
            } else {
              actionRequired = `URGENT: Review & Refund Second Charge (${o2.postDiscountTotal || p2.amount || 0} SAR)`;
            }
          } else {
            category = 'Charged Then Re-attempted (Same Plate Failed Retry)';
            actionRequired = 'Verify plate active subscription status';
          }

          rows.push({
            subscriptionCode: sc,
            plateNumber: plate,
            customerName: getCustName(o1) || getCustName(o2) || (subDoc?.customerSnapshot?.name || ''),
            customerPhone: getCustPhone(o1) || getCustPhone(o2) || (subDoc?.customerSnapshot?.phone || ''),
            issueCategory: category,
            initialPaidOrderCode: o1.readableCode,
            initialPaidDateKSA: toKSA(o1.createdAt),
            initialPaidAmountSar: o1.postDiscountTotal || p1.amount || 0,
            initialPaymentMethod: p1.paymentMethodNameEn || p1.provider || 'Saved card',
            initialProviderPaymentId: p1.providerPaymentId || p1.paymentId || '',
            subsequentOrderCode: o2.readableCode,
            subsequentOrderDateKSA: toKSA(o2.createdAt),
            subsequentOrderStatus: o2.status,
            subsequentOrderAmountSar: o2.postDiscountTotal || p2.amount || 0,
            subsequentPaymentMethod: p2.paymentMethodNameEn || p2.provider || 'Saved card',
            subsequentFailureReason: p2.failureReason || p2.gatewayResponse?.message || (o2Paid ? 'SUCCESSFUL_CHARGE' : o2.status),
            subsequentProviderPaymentId: p2.providerPaymentId || p2.paymentId || '',
            gapDays: Math.round(diffDays * 10) / 10,
            gapHours: Math.round(diffHours * 10) / 10,
            currentSubStatus: subDoc?.status || 'unknown',
            currentSubRenewalDateKSA: toKSA(subDoc?.renewalDate),
            actionRequired
          });
        }
      }
    }

    // Sort rows: first Double Charged cases, then by Date descending
    rows.sort((a, b) => {
      if (a.issueCategory.startsWith('Double Charged') && !b.issueCategory.startsWith('Double Charged')) return -1;
      if (!a.issueCategory.startsWith('Double Charged') && b.issueCategory.startsWith('Double Charged')) return 1;
      return new Date(b.subsequentOrderDateKSA) - new Date(a.subsequentOrderDateKSA);
    });

    console.log(`Total incidents identified for CSV: ${rows.length}`);

    // Headers
    const headers = [
      'Subscription Code',
      'Plate Number',
      'Customer Name',
      'Customer Phone',
      'Issue Category',
      'Initial Paid Order Code',
      'Initial Paid Date (KSA)',
      'Initial Paid Amount (SAR)',
      'Initial Payment Method',
      'Initial Provider Payment ID',
      'Subsequent Order Code',
      'Subsequent Order Date (KSA)',
      'Subsequent Order Status',
      'Subsequent Order Amount (SAR)',
      'Subsequent Payment Method',
      'Subsequent Failure Reason / Status',
      'Subsequent Provider Payment ID',
      'Gap Days',
      'Gap Hours',
      'Current Subscription Status',
      'Current Subscription Renewal Date (KSA)',
      'Action Required / Refund Status'
    ];

    const csvLines = [headers.join(',')];
    for (const r of rows) {
      const line = [
        escapeCsv(r.subscriptionCode),
        escapeCsv(r.plateNumber),
        escapeCsv(r.customerName),
        escapeCsv(r.customerPhone),
        escapeCsv(r.issueCategory),
        escapeCsv(r.initialPaidOrderCode),
        escapeCsv(r.initialPaidDateKSA),
        escapeCsv(r.initialPaidAmountSar),
        escapeCsv(r.initialPaymentMethod),
        escapeCsv(r.initialProviderPaymentId),
        escapeCsv(r.subsequentOrderCode),
        escapeCsv(r.subsequentOrderDateKSA),
        escapeCsv(r.subsequentOrderStatus),
        escapeCsv(r.subsequentOrderAmountSar),
        escapeCsv(r.subsequentPaymentMethod),
        escapeCsv(r.subsequentFailureReason),
        escapeCsv(r.subsequentProviderPaymentId),
        escapeCsv(r.gapDays),
        escapeCsv(r.gapHours),
        escapeCsv(r.currentSubStatus),
        escapeCsv(r.currentSubRenewalDateKSA),
        escapeCsv(r.actionRequired)
      ];
      csvLines.push(line.join(','));
    }

    const csvContent = '\uFEFF' + csvLines.join('\n'); // UTF-8 BOM for Excel Arabic support
    const targetPath = path.join(process.cwd(), 'double_renewal_and_post_charge_audit.csv');
    fs.writeFileSync(targetPath, csvContent, 'utf-8');
    console.log(`Successfully generated CSV at: ${targetPath}`);

  } finally {
    await client.close();
  }
}

main().catch(console.error);
