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

  const since = new Date('2026-09-08T10:00:00.000Z');
  const recentOrders = await db.collection('rushwash_sale_orders').find({
    createdAt: { $gte: since },
    'lines.catalogCode': { $regex: '^SPK-' }
  }).sort({ createdAt: -1 }).toArray();

  console.log('SPK orders since 10:00 UTC today:', recentOrders.length);
  for (const o of recentOrders) {
    console.log(o.readableCode, o.createdAt, o.status, o.totalCaptured);
  }

  await client.close();
}

run().catch(console.error);
