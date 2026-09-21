import { MongoClient, BSON } from 'mongodb';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_MONGO_URI = process.env.LOCAL_MONGO_URI || 'mongodb://127.0.0.1:27017';
const BACKUP_DIR = path.join(__dirname, '..', 'database', 'atlas_backup', 'latest');

async function importCollection(db, collectionName, jsonlPath, metaPath) {
  const col = db.collection(collectionName);
  
  // Clear existing collection in local DB
  await col.drop().catch(() => {});

  if (!fs.existsSync(jsonlPath)) {
    console.log(`  [!] Skipping ${collectionName} (no data file found)`);
    return { name: collectionName, count: 0 };
  }

  const fileStream = fs.createReadStream(jsonlPath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let batch = [];
  const BATCH_SIZE = 5000;
  let totalInserted = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const doc = BSON.EJSON.parse(trimmed);
      batch.push(doc);

      if (batch.length >= BATCH_SIZE) {
        await col.insertMany(batch, { ordered: false });
        totalInserted += batch.length;
        batch = [];
        process.stdout.write(`    Restoring [${collectionName}]: ${totalInserted.toLocaleString()} docs...\r`);
      }
    } catch (err) {
      console.warn(`    Warning: Failed to parse line in ${collectionName}:`, err.message);
    }
  }

  if (batch.length > 0) {
    await col.insertMany(batch, { ordered: false });
    totalInserted += batch.length;
    batch = [];
  }

  // Restore indexes if metadata exists
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (meta.indexes && Array.isArray(meta.indexes)) {
        for (const idx of meta.indexes) {
          if (idx.name === '_id_') continue; // Default index already exists
          const keys = idx.key;
          const options = { name: idx.name };
          if (idx.unique) options.unique = true;
          if (idx.sparse) options.sparse = true;
          if (idx.expireAfterSeconds !== undefined) options.expireAfterSeconds = idx.expireAfterSeconds;
          
          await col.createIndex(keys, options).catch(e => {
            // Non-critical index warning
          });
        }
      }
    } catch (err) {
      console.warn(`    Warning restoring indexes for ${collectionName}:`, err.message);
    }
  }

  console.log(`  -> Restored [${collectionName}]: ${totalInserted.toLocaleString()} documents & indexes`);
  return { name: collectionName, count: totalInserted };
}

async function restore() {
  console.log('====================================================');
  console.log('       RESTORE ATLAS BACKUP TO LOCAL MONGODB        ');
  console.log('====================================================');
  console.log(`Source Backup Dir: ${BACKUP_DIR}`);
  console.log(`Local Mongo Target: ${LOCAL_MONGO_URI}\n`);

  if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`Error: Backup directory not found at ${BACKUP_DIR}`);
    process.exit(1);
  }

  const client = new MongoClient(LOCAL_MONGO_URI);

  try {
    await client.connect();
    console.log('[+] Connected to local MongoDB instance successfully.\n');

    // Find database folders in BACKUP_DIR
    const dbFolders = fs.readdirSync(BACKUP_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    let grandTotalDocs = 0;

    for (const dbName of dbFolders) {
      console.log(`====================================================`);
      console.log(`IMPORTING DATABASE: ${dbName}`);
      console.log(`====================================================`);

      const db = client.db(dbName);
      const dbPath = path.join(BACKUP_DIR, dbName);

      const files = fs.readdirSync(dbPath);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
      jsonlFiles.sort();

      for (const jsonlFile of jsonlFiles) {
        const colName = jsonlFile.replace('.jsonl', '');
        const jsonlFilePath = path.join(dbPath, jsonlFile);
        const metaFilePath = path.join(dbPath, `${colName}.metadata.json`);

        const result = await importCollection(db, colName, jsonlFilePath, metaFilePath);
        grandTotalDocs += result.count;
      }
    }

    console.log('\n====================================================');
    console.log('            LOCAL RESTORE COMPLETE!                 ');
    console.log('====================================================');
    console.log(`Total restored documents: ${grandTotalDocs.toLocaleString()}`);
    console.log(`Databases restored: ${dbFolders.join(', ')}`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('[!] Error restoring to local MongoDB:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

restore();
