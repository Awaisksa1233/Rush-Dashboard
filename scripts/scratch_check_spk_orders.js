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

  const start = new Date('2026-08-22T00:00:00.000Z');
  
  const orders = await db.collection('rushwash_sale_orders').find({
    createdAt: { $gte: start },
    'lines.catalogCode': { $regex: '^SPK-' }
  }).toArray();

  console.log('Total orders with SPK- since 22 Aug:', orders.length);

  const statusCounts = {};
  let paidCount = 0;
  for (const o of orders) {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    const isPaid = (o.status === 'paid' || o.status === 'completed') ||
      (o.payments && o.payments.some(p => p.status === 'paid' && p.amount > 0));
    if (isPaid) paidCount++;
  }
  console.log('Order status counts:', statusCounts);
  console.log('Orders with paid status/payments:', paidCount);

  // Load all subscriptions
  const subs = await db.collection('rushwash_subscriptions').find({}).toArray();
  console.log('Total subscriptions in DB:', subs.length);

  await client.close();
}

run().catch(console.error);
