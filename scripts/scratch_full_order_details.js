import 'dotenv/config';
import { MongoClient } from 'mongodb';

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

  const list = [];
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
    // AST is UTC + 3
    const dtAst = new Date(dtUtc.getTime() + 3 * 3600 * 1000);

    list.push({
      orderId: o.readableCode,
      plate: (o.normalizedPlate || o.vehicleSnapshot?.displayPlate || '').replace(/\s+/g, '').toUpperCase(),
      utcDate: dtUtc.toISOString().replace('T', ' ').substring(0, 19),
      astDate: dtAst.toISOString().replace('T', ' ').substring(0, 19),
      amount: (p.amount != null ? p.amount : (o.totalCaptured || o.postDiscountTotal)).toFixed(2),
      orderStatus: o.status,
      paymentStatus: p.status,
      paymentMethod: p.paymentMethodNameEn || p.paymentMethodCode || 'Saved card',
      paymentId: p.providerPaymentId || p.paymentToken || 'N/A',
      packages: pkgs,
      customerId: cid || 'N/A',
      customerCode: cust.readableCode || o.customerSnapshot?.readableCode || 'N/A',
      customerName: cust.name || 'N/A',
      customerPhone: cust.phone || 'N/A'
    });
  }

  console.log(JSON.stringify(list, null, 2));
  await client.close();
}

run().catch(console.error);
