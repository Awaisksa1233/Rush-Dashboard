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

const rawUri = process.env.MONGODB_URI;
if (!rawUri) {
  console.error('Error: MONGODB_URI is not set in .env');
  process.exit(1);
}

const uri = sanitizeMongoUri(rawUri);

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputBaseDir = path.join(__dirname, '..', 'database', 'atlas_backup');
const currentBackupDir = path.join(outputBaseDir, `backup_${timestamp}`);

async function exportCollection(db, collectionName, targetDir) {
  const col = db.collection(collectionName);
  const totalDocs = await col.countDocuments();
  console.log(`\n  -> Exporting [${collectionName}] (${totalDocs} documents)...`);

  // Export metadata (indexes)
  try {
    const indexes = await col.indexes();
    fs.writeFileSync(
      path.join(targetDir, `${collectionName}.metadata.json`),
      JSON.stringify({ collection: collectionName, indexes, totalDocs, exportedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.warn(`    Warning: Could not fetch indexes for ${collectionName}:`, err.message);
  }

  if (totalDocs === 0) {
    fs.writeFileSync(path.join(targetDir, `${collectionName}.jsonl`), '', 'utf-8');
    fs.writeFileSync(path.join(targetDir, `${collectionName}.json`), '[]', 'utf-8');
    return { name: collectionName, totalDocs: 0, sizeBytes: 0, status: 'EMPTY' };
  }

  const jsonlFilePath = path.join(targetDir, `${collectionName}.jsonl`);
  const jsonFilePath = path.join(targetDir, `${collectionName}.json`);
  
  const jsonlStream = fs.createWriteStream(jsonlFilePath, { encoding: 'utf-8' });
  const jsonStream = fs.createWriteStream(jsonFilePath, { encoding: 'utf-8' });
  
  // Begin JSON array
  jsonStream.write('[\n');

  const cursor = col.find({}).batchSize(2000);
  let processed = 0;
  let isFirstJsonDoc = true;

  for await (const doc of cursor) {
    // EJSON stringify preserves full BSON typing ($oid, $date, etc.)
    const ejsonString = BSON.EJSON.stringify(doc);
    
    // Write JSONL
    jsonlStream.write(ejsonString + '\n');

    // Write JSON Array
    if (!isFirstJsonDoc) {
      jsonStream.write(',\n');
    } else {
      isFirstJsonDoc = false;
    }
    jsonStream.write('  ' + ejsonString);

    processed++;
    if (processed % 20000 === 0 || processed === totalDocs) {
      const pct = ((processed / totalDocs) * 100).toFixed(1);
      process.stdout.write(`    Progress: ${processed.toLocaleString()} / ${totalDocs.toLocaleString()} (${pct}%)\r`);
    }
  }

  jsonStream.write('\n]\n');

  await new Promise((resolve) => jsonlStream.end(resolve));
  await new Promise((resolve) => jsonStream.end(resolve));

  const jsonlStat = fs.statSync(jsonlFilePath);
  console.log(`\n    Completed: ${processed.toLocaleString()} docs saved (${(jsonlStat.size / (1024 * 1024)).toFixed(2)} MB)`);

  return {
    name: collectionName,
    totalDocs: processed,
    sizeBytes: jsonlStat.size,
    status: 'OK'
  };
}

async function main() {
  console.log('====================================================');
  console.log('       MONGODB ATLAS COMPLETE DATABASE BACKUP       ');
  console.log('====================================================');
  console.log(`Target directory: ${currentBackupDir}`);
  
  fs.mkdirSync(currentBackupDir, { recursive: true });

  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 60000,
  });

  try {
    await client.connect();
    console.log('[+] Connected to Atlas successfully.\n');

    const adminDb = client.db().admin();
    const dbsList = await adminDb.listDatabases();
    
    const targetDbs = dbsList.databases.filter(d => !['admin', 'local', 'config'].includes(d.name));
    
    const summary = {
      timestamp: new Date().toISOString(),
      cluster: uri.replace(/\/\/.*@/, '//***:***@'),
      databases: []
    };

    for (const dbInfo of targetDbs) {
      const dbName = dbInfo.name;
      console.log(`\n====================================================`);
      console.log(`DATABASE: ${dbName} (Size: ${(dbInfo.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
      console.log(`====================================================`);

      const dbDir = path.join(currentBackupDir, dbName);
      fs.mkdirSync(dbDir, { recursive: true });

      const db = client.db(dbName);
      const collections = await db.listCollections().toArray();
      // Sort collections alphabetically
      collections.sort((a, b) => a.name.localeCompare(b.name));

      const dbSummary = {
        name: dbName,
        sizeOnDisk: dbInfo.sizeOnDisk,
        collections: []
      };

      for (const col of collections) {
        const colStats = await exportCollection(db, col.name, dbDir);
        dbSummary.collections.push(colStats);
      }

      summary.databases.push(dbSummary);
    }

    // Save summary manifest
    const manifestPath = path.join(currentBackupDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(summary, null, 2), 'utf-8');

    // Also update a symlink / pointer or latest folder
    const latestDir = path.join(outputBaseDir, 'latest');
    try {
      if (fs.existsSync(latestDir)) {
        fs.rmSync(latestDir, { recursive: true, force: true });
      }
      fs.cpSync(currentBackupDir, latestDir, { recursive: true });
    } catch (e) {
      // ignore
    }

    console.log('\n====================================================');
    console.log('              ALL DATABASES DOWNLOADED!             ');
    console.log('====================================================');
    console.log(`Backup Location: ${currentBackupDir}`);
    console.log(`Latest Copy:     ${latestDir}`);
    console.log(`Manifest File:   ${manifestPath}`);

    // Print summary stats
    let totalDocsAllDbs = 0;
    let totalBytesAllDbs = 0;
    summary.databases.forEach(db => {
      console.log(`\nSummary for Database [${db.name}]:`);
      db.collections.forEach(c => {
        totalDocsAllDbs += c.totalDocs;
        totalBytesAllDbs += c.sizeBytes;
        console.log(`  - ${c.name.padEnd(40)}: ${c.totalDocs.toString().padStart(8)} docs | ${(c.sizeBytes / (1024 * 1024)).toFixed(2).padStart(6)} MB`);
      });
    });

    console.log('\n----------------------------------------------------');
    console.log(`TOTALS: ${totalDocsAllDbs.toLocaleString()} documents | ${(totalBytesAllDbs / (1024 * 1024)).toFixed(2)} MB exported.`);
    console.log('----------------------------------------------------');

  } catch (err) {
    console.error('[!] Error during Atlas database download:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main();
