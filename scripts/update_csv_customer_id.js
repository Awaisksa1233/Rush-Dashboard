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

async function updateCsv() {
  const uri = sanitizeMongoUri(process.env.MONGODB_URI);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('rushwash');

  const orderCodes = [
    'ORD-25776', 'ORD-25900', 'ORD-25912', 'ORD-25933', 'ORD-26096',
    'ORD-26099', 'ORD-26113', 'ORD-26144', 'ORD-26260', 'ORD-26262',
    'ORD-26280', 'ORD-26297', 'ORD-26330', 'ORD-26642', 'ORD-26646',
    'ORD-26892'
  ];

  const orders = await db.collection('rushwash_sale_orders').find({
    readableCode: { $in: orderCodes }
  }).sort({ createdAt: 1 }).toArray();

  const customerIds = orders.map(o => o.customerId).filter(Boolean);
  const customers = await db.collection('rushwash_customers').find({
    _id: { $in: customerIds }
  }).toArray();
  const custMap = new Map(customers.map(c => [c._id.toString(), c]));

  const csvHeader = [
    'order_id', 'plate', 'order_date_utc', 'order_date_ast', 'amount_sar',
    'order_status', 'payment_status', 'payment_method', 'provider_payment_id',
    'package_details', 'customer_code', 'customer_id', 'customer_name', 'customer_phone'
  ];

  const rows = [csvHeader.join(',')];

  for (const o of orders) {
    const cid = o.customerId ? o.customerId.toString() : '';
    const cust = custMap.get(cid) || o.customerSnapshot || {};
    const payments = o.payments || [];
    const p = payments[0] || {};

    const packageLines = (o.lines || []).filter(l => 
      l.catalogCode && l.catalogCode.startsWith('SPK-')
    );
    const pkgs = packageLines.map(l => `${l.catalogCode} (${l.displayNameEn})`).join(' + ');

    const dtUtc = new Date(o.createdAt);
    const dtAst = new Date(dtUtc.getTime() + 3 * 3600 * 1000);

    const amt = (p.amount != null ? p.amount : (o.totalCaptured || o.postDiscountTotal)).toFixed(2);

    rows.push([
      o.readableCode,
      (o.normalizedPlate || o.vehicleSnapshot?.displayPlate || '').replace(/\s+/g, '').toUpperCase(),
      `"${dtUtc.toISOString().replace('T', ' ').substring(0, 19)}"`,
      `"${dtAst.toISOString().replace('T', ' ').substring(0, 19)}"`,
      amt,
      o.status,
      p.status || o.status,
      `"${p.paymentMethodNameEn || p.paymentMethodCode || 'Saved card'}"`,
      p.providerPaymentId || p.paymentToken || '',
      `"${pkgs}"`,
      cust.readableCode || o.customerSnapshot?.readableCode || '',
      cid,
      `"${(cust.name || '').replace(/"/g, '""')}"`,
      `"${cust.phone || ''}"`
    ].join(','));
  }

  fs.writeFileSync('orders_spk_without_subscription.csv', rows.join('\n'), 'utf-8');
  console.log('Updated orders_spk_without_subscription.csv successfully!');

  await client.close();
}

updateCsv().catch(console.error);
