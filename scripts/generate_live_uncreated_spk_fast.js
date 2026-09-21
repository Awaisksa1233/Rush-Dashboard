import 'dotenv/config';
import { MongoClient } from 'mongodb';
import fs from 'fs';

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

  // 1. Fetch paid/active/completed orders with SPK packages
  const orders = await db.collection('rushwash_sale_orders').find({
    createdAt: { $gte: startDt },
    'lines.catalogCode': { $regex: '^SPK-' },
    dataSource: { $ne: 'legacy' },
    $or: [
      { status: { $in: ['paid', 'completed', 'active'] }, 'payments.status': 'paid' },
      { totalCaptured: { $gt: 0 } }
    ]
  }).sort({ createdAt: 1 }).toArray();

  console.log(`Found ${orders.length} potentially paid orders with SPK lines`);

  // Filter package lines (monthly subscriptions) and valid payments
  const candidateOrders = [];
  const plateSet = new Set();
  const customerIdSet = new Set();

  for (const o of orders) {
    const lines = o.lines || [];
    const packageLines = lines.filter(l => 
      l.catalogCode && l.catalogCode.startsWith('SPK-') &&
      (l.lineKind === 'package' || l.type === 'monthly_subscription')
    );
    if (packageLines.length === 0) continue;

    const payments = o.payments || [];
    const paidPayments = payments.filter(p => p.status === 'paid');
    const isPaid = (o.totalCaptured > 0) || (paidPayments.length > 0);
    if (!isPaid) continue;

    const plate = (o.normalizedPlate || o.vehicleSnapshot?.displayPlate || '').replace(/\s+/g, '').toUpperCase();
    if (plate) plateSet.add(plate);
    if (o.customerId) customerIdSet.add(o.customerId);

    candidateOrders.push({
      order: o,
      packageLines,
      paidPayments,
      plate
    });
  }

  console.log(`Candidate subscription orders to check: ${candidateOrders.length}`);
  console.log(`Unique plates: ${plateSet.size}`);

  // 2. Fetch subscriptions: all subscriptions created since startDt, or renewed since startDt, or matching plates
  const platesVariants = [];
  for (const p of plateSet) {
    platesVariants.push(p);
    // Add variant with space between digits and letters if applicable (e.g. 7395 ULR)
    const match = p.match(/^(\d+)([A-Z]+)$/);
    if (match) {
      platesVariants.push(`${match[1]} ${match[2]}`);
    }
  }

  const subs = await db.collection('rushwash_subscriptions').find(
    {
      $or: [
        { createdAt: { $gte: startDt } },
        { renewalDate: { $gte: startDt } },
        { 'vehicleLinks.snapshot.normalizedPlate': { $in: platesVariants } },
        { 'vehicleLinks.snapshot.displayPlate': { $in: platesVariants } }
      ]
    },
    {
      projection: {
        readableCode: 1,
        createdAt: 1,
        renewalDate: 1,
        status: 1,
        orderId: 1,
        saleOrderId: 1,
        'vehicleLinks.snapshot.normalizedPlate': 1,
        'vehicleLinks.snapshot.displayPlate': 1
      }
    }
  ).toArray();

  console.log(`Matched subscriptions from DB: ${subs.length}`);

  const subsByPlate = new Map();
  for (const s of subs) {
    for (const vl of (s.vehicleLinks || [])) {
      const snap = vl.snapshot || {};
      const plate = (snap.normalizedPlate || snap.displayPlate || '').replace(/\s+/g, '').toUpperCase();
      if (plate) {
        if (!subsByPlate.has(plate)) subsByPlate.set(plate, []);
        subsByPlate.get(plate).push(s);
      }
    }
  }

  // 3. Fetch customers
  const custIds = Array.from(customerIdSet);
  const customers = await db.collection('rushwash_customers').find(
    { _id: { $in: custIds } },
    { projection: { name: 1, phone: 1 } }
  ).toArray();
  const customerMap = new Map();
  for (const c of customers) {
    customerMap.set(c._id.toString(), c);
  }

  // 4. Identify uncreated orders
  const uncreatedOrders = [];

  for (const item of candidateOrders) {
    const o = item.order;
    const oDt = new Date(o.createdAt);
    const plate = item.plate;
    const plateSubs = subsByPlate.get(plate) || [];

    // Check if subscription was created on/after order time
    const createdAfter = plateSubs.filter(s => s.createdAt && new Date(s.createdAt).getTime() >= oDt.getTime() - 1000);

    // Check if existing subscription was renewed (renewalDate > order time)
    const renewedAfter = plateSubs.filter(s => s.renewalDate && new Date(s.renewalDate).getTime() > oDt.getTime());

    if (createdAfter.length === 0 && renewedAfter.length === 0) {
      const paidPayments = item.paidPayments;
      const primaryPayment = paidPayments[0] || {};
      const cid = o.customerId ? o.customerId.toString() : null;
      const cust = customerMap.get(cid) || o.customerSnapshot || {};
      
      const pkgNames = item.packageLines.map(l => l.displayNameEn || l.catalogCode).join(' + ');
      const pkgCodes = item.packageLines.map(l => l.catalogCode).join(', ');
      
      const paidAmt = o.totalCaptured || paidPayments.reduce((acc, p) => acc + (p.amount || 0), 0) || o.postDiscountTotal || 0;

      uncreatedOrders.push({
        order_id: o.readableCode,
        plate: plate,
        order_date_utc: oDt.toISOString().replace('T', ' ').substring(0, 19),
        amount_sar: Number(paidAmt).toFixed(2),
        order_status: o.status,
        payment_status: primaryPayment.status || o.status,
        payment_method: primaryPayment.paymentMethodNameEn || primaryPayment.paymentMethodCode || 'Moyasar',
        provider_payment_id: primaryPayment.providerPaymentId || '',
        package_codes: pkgCodes,
        package_names: pkgNames,
        customer_name: cust.name || '',
        customer_phone: cust.phone || ''
      });
    }
  }

  console.log(`\n======================================================`);
  console.log(`TOTAL ORDERS WITH SPK- AND NO SUBSCRIPTION CREATED: ${uncreatedOrders.length}`);
  console.log(`======================================================\n`);

  console.table(uncreatedOrders.map(r => ({
    'Order ID': r.order_id,
    'Plate': r.plate,
    'Order Date (UTC)': r.order_date_utc,
    'Amount': `SAR ${r.amount_sar}`,
    'Payment Method': r.payment_method,
    'Package': r.package_names,
    'Phone': r.customer_phone
  })));

  // Write CSV
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

  const outputPath = 'orders_spk_without_subscription.csv';
  fs.writeFileSync(outputPath, csvRows.join('\n'), 'utf-8');
  console.log(`\nSaved CSV to: ${outputPath}`);

  await client.close();
}

run().catch(console.error);
