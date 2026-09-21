import 'dotenv/config';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

function sanitizeMongoUri(uri) {
  if (!uri) return uri;
  try {
    const s = uri.trim();
    if (s.startsWith('mongodb://') || s.startsWith('mongodb+srv://')) {
      const protocol = s.startsWith('mongodb+srv://') ? 'mongodb+srv://' : 'mongodb://';
      const rest = s.slice(protocol.length);
      const lastAt = rest.lastIndexOf('@');
      if (lastAt !== -1) {
        const userInfo = rest.slice(0, lastAt);
        const hostAndRest = rest.slice(lastAt + 1);
        const firstColon = userInfo.indexOf(':');
        if (firstColon !== -1) {
          const user = userInfo.slice(0, firstColon);
          const pass = userInfo.slice(firstColon + 1);
          const decodedPass = decodeURIComponent(pass);
          const encodedPass = encodeURIComponent(decodedPass);
          return `${protocol}${user}:${encodedPass}@${hostAndRest}`;
        }
      }
    }
  } catch (e) {}
  return uri;
}

async function run() {
  const uri = sanitizeMongoUri(process.env.MONGODB_URI);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('rushwash');

  const startDt = new Date('2026-08-22T00:00:00.000Z');

  // Fetch all orders with SPK lines from startDt
  const orders = await db.collection('rushwash_sale_orders').find({
    createdAt: { $gte: startDt },
    'lines.catalogCode': { $regex: '^SPK-' },
    dataSource: { $ne: 'legacy' }
  }).sort({ createdAt: 1 }).toArray();

  console.log(`Found ${orders.length} non-legacy orders with SPK lines since 22 Aug`);

  // Fetch all customers for enrichment
  const customers = await db.collection('rushwash_customers').find({}).toArray();
  const customerMap = new Map();
  for (const c of customers) {
    customerMap.set(c._id.toString(), c);
  }

  // Fetch all subscriptions
  const subs = await db.collection('rushwash_subscriptions').find({}).toArray();
  console.log(`Found ${subs.length} total subscriptions in DB`);

  const subsByPlate = new Map();
  const subsByOrderId = new Map();

  for (const s of subs) {
    if (s.orderId) {
      const oid = s.orderId.toString();
      if (!subsByOrderId.has(oid)) subsByOrderId.set(oid, []);
      subsByOrderId.get(oid).push(s);
    }
    if (s.saleOrderId) {
      const soid = s.saleOrderId.toString();
      if (!subsByOrderId.has(soid)) subsByOrderId.set(soid, []);
      subsByOrderId.get(soid).push(s);
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

  const uncreatedOrders = [];

  for (const o of orders) {
    const oDt = new Date(o.createdAt);
    const lines = o.lines || [];
    
    // Filter package lines (monthly subscriptions)
    const packageLines = lines.filter(l => 
      (l.catalogCode && l.catalogCode.startsWith('SPK-')) &&
      (l.lineKind === 'package' || l.type === 'monthly_subscription')
    );

    // If no monthly subscription package line, skip (e.g. single onetime wash services)
    if (packageLines.length === 0) continue;

    // Check payment status
    const payments = o.payments || [];
    const paidPayments = payments.filter(p => p.status === 'paid' && (p.amount > 0 || p.amount === 0));
    const isPaid = (['paid', 'completed', 'active'].includes(o.status) && paidPayments.length > 0) || (o.totalCaptured > 0);

    if (!isPaid) continue;

    const plate = (o.normalizedPlate || o.vehicleSnapshot?.displayPlate || 'UNKNOWN').replace(/\s+/g, '').toUpperCase();
    const orderIdStr = o._id.toString();
    
    // Check matched subs
    const plateSubs = subsByPlate.get(plate) || [];
    const orderSubs = subsByOrderId.get(orderIdStr) || [];

    // Unique matched subs
    const matchedMap = new Map();
    for (const s of [...plateSubs, ...orderSubs]) {
      matchedMap.set(s.readableCode, s);
    }
    const matchedSubs = Array.from(matchedMap.values());

    // 1. Was a subscription created for this order or for this plate on/after order time?
    const createdAfter = matchedSubs.filter(s => s.createdAt && new Date(s.createdAt).getTime() >= oDt.getTime() - 1000);

    // 2. Was an existing subscription renewed with renewalDate > order time?
    const renewedAfter = matchedSubs.filter(s => s.renewalDate && new Date(s.renewalDate).getTime() > oDt.getTime());

    if (createdAfter.length === 0 && renewedAfter.length === 0) {
      const primaryPayment = paidPayments[0] || {};
      const cid = o.customerId ? o.customerId.toString() : null;
      const cust = customerMap.get(cid) || o.customerSnapshot || {};
      
      const pkgNames = packageLines.map(l => l.displayNameEn || l.catalogCode).join(' + ');
      const pkgCodes = packageLines.map(l => l.catalogCode).join(', ');
      
      const paidAmt = o.totalCaptured || paidPayments.reduce((acc, p) => acc + (p.amount || 0), 0) || o.postDiscountTotal || 0;

      uncreatedOrders.push({
        order_id: o.readableCode,
        plate: plate,
        order_date_utc: oDt.toISOString().replace('T', ' ').substring(0, 19),
        amount_sar: Number(paidAmt).toFixed(2),
        payment_status: o.status,
        payment_method: primaryPayment.paymentMethodNameEn || primaryPayment.paymentMethodCode || 'Moyasar',
        provider_payment_id: primaryPayment.providerPaymentId || '',
        package_codes: pkgCodes,
        package_names: pkgNames,
        customer_name: cust.name || '',
        customer_phone: cust.phone || '',
        matched_subs_count: matchedSubs.length,
        latest_sub_status: matchedSubs.length > 0 ? matchedSubs[matchedSubs.length - 1].status : 'none',
        latest_renewal_date: matchedSubs.length > 0 ? (matchedSubs[matchedSubs.length - 1].renewalDate ? new Date(matchedSubs[matchedSubs.length - 1].renewalDate).toISOString().substring(0, 10) : 'none') : 'none'
      });
    }
  }

  console.log(`\n========================================`);
  console.log(`TOTAL ORDERS WITH SPK- AND NO SUB CREATED: ${uncreatedOrders.length}`);
  console.log(`========================================\n`);

  // Write out to JSON and CSV
  const csvHeader = [
    'order_id', 'plate', 'order_date_utc', 'amount_sar',
    'payment_status', 'payment_method', 'provider_payment_id',
    'package_codes', 'package_names', 'customer_name', 'customer_phone'
  ];

  const csvRows = [
    csvHeader.join(','),
    ...uncreatedOrders.map(r => [
      r.order_id,
      r.plate,
      `"${r.order_date_utc}"`,
      r.amount_sar,
      r.payment_status,
      `"${r.payment_method}"`,
      r.provider_payment_id,
      `"${r.package_codes}"`,
      `"${r.package_names}"`,
      `"${(r.customer_name || '').replace(/"/g, '""')}"`,
      `"${r.customer_phone}"`
    ].join(','))
  ];

  fs.writeFileSync('orders_spk_without_subscription.csv', csvRows.join('\n'), 'utf-8');
  console.log(`Saved results to orders_spk_without_subscription.csv`);

  console.log(JSON.stringify(uncreatedOrders, null, 2));

  await client.close();
}

run().catch(console.error);
