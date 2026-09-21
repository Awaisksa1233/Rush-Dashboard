import 'dotenv/config';
import { MongoClient, BSON } from 'mongodb';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sanitize Mongo URI
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
  } catch (e) {
    // ignore
  }
  return uri;
}

// Parse Command Line Arguments
const args = process.argv.slice(2);
const isFullSync = args.includes('--full');
const isAllDbs = args.includes('--all');
const autoProcess = args.includes('--process');

const sinceArgIdx = args.indexOf('--since');
const customSince = sinceArgIdx !== -1 && args[sinceArgIdx + 1] ? args[sinceArgIdx + 1] : null;

const daysArgIdx = args.indexOf('--days');
const customDays = daysArgIdx !== -1 && args[daysArgIdx + 1] ? parseFloat(args[daysArgIdx + 1]) : null;

const colArgIdx = args.indexOf('--collections');
const customCols = colArgIdx !== -1 && args[colArgIdx + 1] ? args[colArgIdx + 1].split(',').map(s => s.trim()) : null;

// Core CRM collections needed by dashboard & analytics
const CORE_CRM_COLLECTIONS = [
  'rushwash_customers',
  'rushwash_vehicles',
  'rushwash_subscriptions',
  'rushwash_sale_orders',
  'rushwash_wash_histories',
  'rushwash_employees',
  'rushwash_pos_sessions',
  'rushwash_service_packages',
  'rushwash_services',
  'rushwash_shops',
  'rushwash_pos_balances',
  'rushwash_discounts',
  'rushwash_coupon_redemptions',
  'rushwash_refund_requests'
];

const rawUri = process.env.MONGODB_URI;
if (!rawUri) {
  console.error('[!] Error: MONGODB_URI is not defined in .env');
  process.exit(1);
}
const uri = sanitizeMongoUri(rawUri);

const baseBackupDir = path.join(__dirname, '..', 'database', 'atlas_backup');
const latestBackupDir = path.join(baseBackupDir, 'latest');

// Get last sync date from existing manifest
function getLastSyncDate() {
  if (isFullSync) return null;
  if (customSince) return new Date(customSince);
  if (customDays) return new Date(Date.now() - customDays * 24 * 60 * 60 * 1000);

  const manifestPath = path.join(latestBackupDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (manifest.timestamp) {
        return new Date(manifest.timestamp);
      }
    } catch (e) {
      // ignore
    }
  }
  return null;
}

// Build Delta Query for MongoDB
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

// Load existing JSONL into Map keyed by ID
async function loadExistingMap(jsonlPath) {
  const map = new Map();
  if (!fs.existsSync(jsonlPath)) return map;

  const fileStream = fs.createReadStream(jsonlPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const doc = BSON.EJSON.parse(trimmed);
      const idKey = doc._id ? (typeof doc._id === 'object' ? JSON.stringify(doc._id) : String(doc._id)) : null;
      if (idKey) {
        map.set(idKey, line); // Store raw line string to avoid unnecessary re-serialization
      }
    } catch (e) {
      // ignore bad line
    }
  }
  return map;
}

// Sync a single collection (delta or full)
async function syncCollection(db, collectionName, targetDir, sinceDate) {
  const col = db.collection(collectionName);
  const totalInDb = await col.countDocuments();
  
  const jsonlFilePath = path.join(targetDir, `${collectionName}.jsonl`);
  const jsonFilePath = path.join(targetDir, `${collectionName}.json`);
  const metaFilePath = path.join(targetDir, `${collectionName}.metadata.json`);

  // Fetch indexes
  let indexes = [];
  try {
    indexes = await col.indexes();
  } catch (e) {}

  const isIncremental = Boolean(sinceDate && fs.existsSync(jsonlFilePath));
  const query = isIncremental ? buildDeltaQuery(sinceDate) : {};

  const queryCount = isIncremental ? await col.countDocuments(query) : totalInDb;

  if (isIncremental && queryCount === 0) {
    console.log(`  ✓ [${collectionName}]: Up to date (${totalInDb.toLocaleString()} docs, 0 new/modified)`);
    // Update metadata
    fs.writeFileSync(metaFilePath, JSON.stringify({
      collection: collectionName,
      indexes,
      totalDocs: totalInDb,
      lastSyncedAt: new Date().toISOString()
    }, null, 2), 'utf-8');
    return { name: collectionName, totalDocs: totalInDb, deltaCount: 0, status: 'UP_TO_DATE' };
  }

  console.log(`  -> Syncing [${collectionName}]: ${isIncremental ? `Found ${queryCount.toLocaleString()} changed docs` : `Full fetch (${totalInDb.toLocaleString()} docs)`}...`);

  if (!isIncremental) {
    // Full export
    const jsonlStream = fs.createWriteStream(jsonlFilePath, { encoding: 'utf-8' });
    const jsonStream = fs.createWriteStream(jsonFilePath, { encoding: 'utf-8' });
    jsonStream.write('[\n');

    let processed = 0;
    let isFirst = true;
    const cursor = col.find(query).batchSize(2000);

    for await (const doc of cursor) {
      const ejsonString = BSON.EJSON.stringify(doc);
      jsonlStream.write(ejsonString + '\n');
      if (!isFirst) jsonStream.write(',\n');
      else isFirst = false;
      jsonStream.write('  ' + ejsonString);
      processed++;
    }
    jsonStream.write('\n]\n');

    await new Promise(res => jsonlStream.end(res));
    await new Promise(res => jsonStream.end(res));

    fs.writeFileSync(metaFilePath, JSON.stringify({
      collection: collectionName,
      indexes,
      totalDocs: processed,
      lastSyncedAt: new Date().toISOString()
    }, null, 2), 'utf-8');

    return { name: collectionName, totalDocs: processed, deltaCount: processed, status: 'SYNCED_FULL' };
  }

  // Incremental merge
  const existingMap = await loadExistingMap(jsonlFilePath);
  let newlyAdded = 0;
  let updated = 0;

  const cursor = col.find(query).batchSize(2000);
  for await (const doc of cursor) {
    const idKey = doc._id ? (typeof doc._id === 'object' ? JSON.stringify(doc._id) : String(doc._id)) : null;
    if (idKey) {
      if (existingMap.has(idKey)) updated++;
      else newlyAdded++;
      existingMap.set(idKey, BSON.EJSON.stringify(doc));
    }
  }

  // Write merged output
  const jsonlStream = fs.createWriteStream(jsonlFilePath, { encoding: 'utf-8' });
  const jsonStream = fs.createWriteStream(jsonFilePath, { encoding: 'utf-8' });
  jsonStream.write('[\n');

  let count = 0;
  let isFirst = true;
  for (const lineStr of existingMap.values()) {
    jsonlStream.write(lineStr + '\n');
    if (!isFirst) jsonStream.write(',\n');
    else isFirst = false;
    jsonStream.write('  ' + lineStr);
    count++;
  }
  jsonStream.write('\n]\n');

  await new Promise(res => jsonlStream.end(res));
  await new Promise(res => jsonStream.end(res));

  fs.writeFileSync(metaFilePath, JSON.stringify({
    collection: collectionName,
    indexes,
    totalDocs: count,
    lastSyncedAt: new Date().toISOString()
  }, null, 2), 'utf-8');

  console.log(`    ✓ Merged: +${newlyAdded} new, ${updated} updated (Total: ${count.toLocaleString()} docs)`);
  return { name: collectionName, totalDocs: count, deltaCount: newlyAdded + updated, status: 'MERGED' };
}

async function main() {
  const startTime = Date.now();
  const lastSyncDate = getLastSyncDate();

  console.log('====================================================');
  console.log('       MONGODB ATLAS FAST INCREMENTAL SYNC          ');
  console.log('====================================================');
  console.log(`Sync Mode:       ${lastSyncDate ? `INCREMENTAL (Since: ${lastSyncDate.toISOString()})` : 'FULL SNAPSHOT'}`);
  console.log(`Target Dir:      ${latestBackupDir}`);
  console.log(`Target Scope:    ${isAllDbs ? 'All Databases' : (customCols ? `Custom: [${customCols.join(', ')}]` : 'Core CRM Collections')}`);
  console.log('====================================================\n');

  fs.mkdirSync(latestBackupDir, { recursive: true });

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 60000,
  });

  try {
    await client.connect();
    console.log('[+] Connected to MongoDB Atlas.\n');

    const adminDb = client.db().admin();
    const dbsList = await adminDb.listDatabases();
    
    let targetDbs = dbsList.databases.filter(d => !['admin', 'local', 'config'].includes(d.name));
    if (!isAllDbs) {
      targetDbs = targetDbs.filter(d => d.name === (process.env.DB_NAME || 'rushwash'));
    }

    const summary = {
      timestamp: new Date().toISOString(),
      cluster: uri.replace(/\/\/.*@/, '//***:***@'),
      syncMode: lastSyncDate ? 'incremental' : 'full',
      syncedSince: lastSyncDate ? lastSyncDate.toISOString() : null,
      databases: []
    };

    let totalChangesAcrossDbs = 0;
    let totalDocsAcrossDbs = 0;

    for (const dbInfo of targetDbs) {
      const dbName = dbInfo.name;
      console.log(`\n--- DATABASE: ${dbName} ---`);

      const dbDir = path.join(latestBackupDir, dbName);
      fs.mkdirSync(dbDir, { recursive: true });

      const db = client.db(dbName);
      const allCols = await db.listCollections().toArray();

      let targetCols = allCols.map(c => c.name);
      if (customCols) {
        targetCols = targetCols.filter(c => customCols.includes(c));
      } else if (!isAllDbs) {
        // Default: core CRM collections
        targetCols = targetCols.filter(c => CORE_CRM_COLLECTIONS.includes(c));
      }

      targetCols.sort();

      const dbSummary = {
        name: dbName,
        collections: []
      };

      for (const colName of targetCols) {
        const result = await syncCollection(db, colName, dbDir, lastSyncDate);
        dbSummary.collections.push(result);
        totalChangesAcrossDbs += result.deltaCount;
        totalDocsAcrossDbs += result.totalDocs;
      }

      summary.databases.push(dbSummary);
    }

    // Save updated manifest
    const manifestPath = path.join(latestBackupDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(summary, null, 2), 'utf-8');

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n====================================================');
    console.log('                 SYNC COMPLETE!                     ');
    console.log('====================================================');
    console.log(`Time Elapsed:    ${elapsedSec}s`);
    console.log(`Total Docs:      ${totalDocsAcrossDbs.toLocaleString()}`);
    console.log(`Changes Synced:  ${totalChangesAcrossDbs.toLocaleString()}`);
    console.log(`Manifest:        ${manifestPath}`);
    console.log('====================================================\n');

    // Run Python processing if requested
    if (autoProcess) {
      console.log('[*] Running Python CRM data processor...');
      try {
        execSync('python scripts/process_mongo_data.py', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
        console.log('[✓] Dashboard production dataset refreshed successfully.');
      } catch (err) {
        console.error('[!] Error executing Python processor:', err.message);
      }
    }

  } catch (err) {
    console.error('[!] Error during Atlas sync:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
