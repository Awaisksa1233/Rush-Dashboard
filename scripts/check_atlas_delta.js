import 'dotenv/config';
import { MongoClient, BSON } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
          return protocol + user + ':' + encodeURIComponent(decodeURIComponent(pass)) + '@' + hostAndRest;
        }
      }
    }
  } catch (e) {}
  return uri;
}

const rawUri = process.env.MONGODB_URI;
if (!rawUri) {
  console.error('No MONGODB_URI found.');
  process.exit(1);
}

const manifestPath = path.join(__dirname, '..', 'database', 'atlas_backup', 'latest', 'manifest.json');
let lastSyncDate = null;
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  lastSyncDate = new Date(manifest.timestamp);
}

console.log('Last Sync in manifest:', lastSyncDate ? lastSyncDate.toISOString() : 'Never');

const client = new MongoClient(sanitizeMongoUri(rawUri), { serverSelectionTimeoutMS: 15000 });

async function check() {
  await client.connect();
  console.log('[+] Connected to MongoDB Atlas.\n');
  const db = client.db('rushwash');

  function buildDeltaQuery(sinceDate) {
    if (!sinceDate) return {};
    const sinceIso = sinceDate.toISOString();
    const sinceUnixSec = Math.floor(sinceDate.getTime() / 1000);
    let minObjectId = null;
    try {
      minObjectId = BSON.ObjectId.createFromTime(sinceUnixSec);
    } catch (e) {}

    return {
      $or: [
        { updatedAt: { $gte: sinceDate } },
        { createdAt: { $gte: sinceDate } },
        { "updatedAt.$date": { $gte: sinceIso } },
        { "createdAt.$date": { $gte: sinceIso } },
        { washDate: { $gte: sinceDate } },
        { finishedAt: { $gte: sinceDate } },
        ...(minObjectId ? [{ _id: { $gte: minObjectId } }] : [])
      ]
    };
  }

  const query = buildDeltaQuery(lastSyncDate);
  const cols = [
    'rushwash_sale_orders',
    'rushwash_wash_histories',
    'rushwash_customers',
    'rushwash_vehicles',
    'rushwash_subscriptions',
    'rushwash_coupon_redemptions',
    'rushwash_pos_balances',
    'rushwash_pos_sessions'
  ];

  let totalNew = 0;
  console.log('Pending new/modified records on Atlas since last sync:');
  console.log('----------------------------------------------------');
  for (const c of cols) {
    const deltaCount = await db.collection(c).countDocuments(query);
    const totalCount = await db.collection(c).countDocuments({});
    console.log(  - :  changes (Total: ));
    totalNew += deltaCount;
  }
  console.log('----------------------------------------------------');
  console.log(Total Pending Changes: \n);

  await client.close();
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
