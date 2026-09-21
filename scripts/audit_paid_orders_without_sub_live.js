import 'dotenv/config';
import { MongoClient } from 'mongodb';
import fs from 'fs';

async function run() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // Date cutover: 2026-08-22 (new system go-live / migration cutover)
    const startDt = new Date('2026-08-22T00:00:00.000Z');

    console.log(`Auditing orders from ${startDt.toISOString()} to now...`);

    // Fetch all orders with SPK packages since startDt
    const orders = await db.collection('rushwash_sale_orders').find({
      createdAt: { $gte: startDt },
      dataSource: { $ne: 'legacy' },
      $or: [
        { 'lines.catalogCode': { $regex: '^SPK-' } },
        { 'lineSnapshots.catalogCode': { $regex: '^SPK-' } }
      ]
    }).sort({ createdAt: 1 }).toArray();

    console.log(`Total orders with SPK lines found: ${orders.length}`);

    // Fetch all subscriptions created or renewed since startDt
    const subs = await db.collection('rushwash_subscriptions').find({}).toArray();
    console.log(`Total subscriptions in DB: ${subs.length}`);

    // Map subscriptions by plate and by customerId
    const subsByPlate = new Map();
    const subsByCust = new Map();
    const subsByOrderId = new Map();

    for (const s of subs) {
      if (s.orderId) subsByOrderId.set(String(s.orderId), s);
      if (s.saleOrderId) subsByOrderId.set(String(s.saleOrderId), s);

      const cid = s.customerId ? String(s.customerId) : null;
      if (cid) {
        if (!subsByCust.has(cid)) subsByCust.set(cid, []);
        subsByCust.get(cid).push(s);
      }

      for (const vl of (s.vehicleLinks || [])) {
        const snap = vl.snapshot || {};
        const plate = (snap.normalizedPlate || snap.displayPlate || '').replace(/\s+/g, '').toUpperCase();
        if (plate) {
          if (!subsByPlate.has(plate)) subsByPlate.set(plate, []);
          subsByPlate.get(plate).push(s);
        }
      }
    }

    // Fetch all customers for enrichment
    const customers = await db.collection('rushwash_customers').find({}).project({ readableCode: 1, name: 1, phone: 1 }).toArray();
    const custMap = new Map();
    for (const c of customers) {
      custMap.set(String(c._id), c);
    }

    const uncreatedList = [];

    for (const o of orders) {
      // 1. Is it paid?
      const payments = o.payments || [];
      const paidPayments = payments.filter(p => p.status === 'paid');
      const isPaid = (o.status === 'paid' || o.status === 'active') && (o.totalCaptured > 0 || paidPayments.length > 0 || payments.length === 0);
      if (!isPaid) continue;

      // Exclude refunded orders if fully refunded
      if (o.status === 'refunded' || o.refund) {
        // We'll track it, but let's see if refund happened
        continue;
      }

      // Filter package lines (monthly subscription packages)
      const lines = o.lines || o.lineSnapshots || [];
      const packageLines = lines.filter(l => 
        l.catalogCode && l.catalogCode.startsWith('SPK-') &&
        (l.lineKind === 'package' || l.type === 'monthly_subscription')
      );
      if (packageLines.length === 0) continue;

      const oDt = new Date(o.createdAt);
      const plate = (o.normalizedPlate || o.vehicleSnapshot?.displayPlate || o.vehicleSnapshot?.normalizedPlate || '').replace(/\s+/g, '').toUpperCase();
      const cid = o.customerId ? String(o.customerId) : null;

      // Check if direct link exists
      const directSub = subsByOrderId.get(String(o._id));
      if (directSub) continue;

      // Check if order has subscriptionReadableCode that exists and was renewed/created
      if (o.subscriptionReadableCode) {
        const subByCode = subs.find(s => s.readableCode === o.subscriptionReadableCode);
        if (subByCode) {
          // Check if the renewalDate is in the future compared to order date
          const renewalDt = subByCode.renewalDate ? new Date(subByCode.renewalDate) : null;
          if (renewalDt && renewalDt.getTime() > oDt.getTime()) {
            // Subscription was successfully renewed!
            continue;
          }
        }
      }

      // Check plate subscriptions
      const plateSubs = subsByPlate.get(plate) || [];
      // Did a subscription get created on/after order time (within reasonable window) for this plate?
      const subCreatedAfter = plateSubs.filter(s => s.createdAt && new Date(s.createdAt).getTime() >= oDt.getTime() - 60000);
      // Did an existing subscription get renewed for this plate (renewalDate extended past order date)?
      const subRenewedAfter = plateSubs.filter(s => s.renewalDate && new Date(s.renewalDate).getTime() > oDt.getTime());

      if (subCreatedAfter.length > 0 || subRenewedAfter.length > 0) {
        continue;
      }

      // Also check customer subscriptions if plate is missing or different
      if (cid) {
        const custSubs = subsByCust.get(cid) || [];
        const custSubCreatedAfter = custSubs.filter(s => s.createdAt && new Date(s.createdAt).getTime() >= oDt.getTime() - 60000);
        const custSubRenewedAfter = custSubs.filter(s => s.renewalDate && new Date(s.renewalDate).getTime() > oDt.getTime());
        if (custSubCreatedAfter.length > 0 || custSubRenewedAfter.length > 0) {
          continue;
        }
      }

      // If we reach here, this order was PAID, but NO SUBSCRIPTION WAS CREATED OR RENEWED!
      const primaryPayment = paidPayments[0] || payments[0] || {};
      const cust = custMap.get(cid) || o.customerSnapshot || {};
      const pkgNames = packageLines.map(l => l.displayNameEn || l.catalogCode).join(' + ');
      const pkgCodes = packageLines.map(l => l.catalogCode).join(', ');
      const paidAmt = o.postDiscountTotal || o.totalCaptured || paidPayments.reduce((acc, p) => acc + (p.amount || 0), 0);

      // Riyadh time
      const astDate = new Date(oDt.getTime() + 3 * 3600 * 1000).toISOString().replace('T', ' ').substring(0, 19);

      uncreatedList.push({
        order_id: o.readableCode,
        plate: plate || 'N/A',
        time_utc: oDt.toISOString().replace('T', ' ').substring(0, 19),
        time_ksa: astDate,
        amount_sar: Number(paidAmt).toFixed(2),
        order_status: o.status,
        payment_status: primaryPayment.status || o.status,
        payment_method: primaryPayment.paymentMethodNameEn || primaryPayment.paymentMethodCode || 'Moyasar',
        provider_payment_id: primaryPayment.providerPaymentId || '',
        package_details: pkgNames,
        package_codes: pkgCodes,
        customer_code: cust.readableCode || '',
        customer_name: cust.name || '',
        customer_phone: cust.phone || ''
      });
    }

    console.log(`\n======================================================`);
    console.log(`TOTAL PAID ORDERS WITH NO SUBSCRIPTION CREATED: ${uncreatedList.length}`);
    console.log(`======================================================\n`);

    console.log(JSON.stringify(uncreatedList, null, 2));

    // Save to CSV
    const csvHeader = [
      'order_id', 'plate', 'time_utc', 'time_ksa', 'amount_sar',
      'order_status', 'payment_status', 'payment_method', 'provider_payment_id',
      'package_details', 'customer_code', 'customer_name', 'customer_phone'
    ];

    const csvRows = [
      csvHeader.join(','),
      ...uncreatedList.map(r => [
        r.order_id,
        r.plate,
        `"${r.time_utc}"`,
        `"${r.time_ksa}"`,
        r.amount_sar,
        r.order_status,
        r.payment_status,
        `"${r.payment_method}"`,
        r.provider_payment_id,
        `"${r.package_details}"`,
        r.customer_code,
        `"${(r.customer_name || '').replace(/"/g, '""')}"`,
        `"${r.customer_phone}"`
      ].join(','))
    ];

    fs.writeFileSync('uncreated_subscription_paid_orders_live.csv', csvRows.join('\n'), 'utf-8');
    console.log('\nWrote uncreated_subscription_paid_orders_live.csv');

  } finally {
    await client.close();
  }
}

run().catch(console.error);
