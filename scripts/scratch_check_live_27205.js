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

  for (const code of ['ORD-27205', 'ORD-27207', 'ORD-27208']) {
    const o = await db.collection('rushwash_sale_orders').findOne({ readableCode: code });
    const plate = (o?.normalizedPlate || o?.vehicleSnapshot?.displayPlate || '').replace(/\s+/g, '').toUpperCase();
    console.log(`=== ${code} (${plate}) ===`);
    console.log('Status:', o?.status, 'Total Captured:', o?.totalCaptured, 'Payments:', o?.payments);
    console.log('Lines:', o?.lines);
    
    // Find sub
    const vSubs = await db.collection('rushwash_subscriptions').find({
      'vehicleLinks.snapshot.normalizedPlate': plate
    }).toArray();
    console.log('Subs found for plate:', vSubs.map(s => ({
      code: s.readableCode,
      status: s.status,
      created: s.createdAt,
      renewal: s.renewalDate
    })));
  }

  await client.close();
}

run().catch(console.error);
