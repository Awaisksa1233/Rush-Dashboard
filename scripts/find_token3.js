import 'dotenv/config';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

async function main() {
  const targetToken = 'token_M3QC4nZ8NCoKxBpJtimQSZhTSb';
  console.log(`Searching for ${targetToken} in files and DB...`);

  // 1. Search in local files (CSVs, JSONs)
  const dir = process.cwd();
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (f.endsWith('.csv') || f.endsWith('.json')) {
      const fullPath = path.join(dir, f);
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (content.includes(targetToken)) {
          console.log(`Found in file: ${f}!`);
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(targetToken)) {
              console.log(`  Line ${i+1}: ${lines[i]}`);
            }
          }
        }
      } catch (e) {}
    }
  }

  // 2. Search in MongoDB Atlas
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');
    const cols = await db.listCollections().toArray();
    for (const c of cols) {
      const col = db.collection(c.name);
      // text or regex search
      const count = await col.countDocuments({
        $or: [
          { 'moyasarPaymentInstruments.tokenId': targetToken },
          { 'moyasarPaymentInstruments.token': targetToken },
          { 'moyasarPaymentInstrument.tokenId': targetToken },
          { 'moyasarPaymentInstrument.token': targetToken },
          { tokenId: targetToken },
          { token: targetToken },
          { paymentToken: targetToken },
          { 'payments.paymentToken': targetToken },
          { 'payments.tokenId': targetToken },
          { 'paymentMethodUsed.token': targetToken }
        ]
      });
      if (count > 0) {
        console.log(`Found in collection ${c.name}: ${count} docs`);
        const docs = await col.find({
          $or: [
            { 'moyasarPaymentInstruments.tokenId': targetToken },
            { 'moyasarPaymentInstruments.token': targetToken },
            { 'moyasarPaymentInstrument.tokenId': targetToken },
            { 'moyasarPaymentInstrument.token': targetToken },
            { tokenId: targetToken },
            { token: targetToken },
            { paymentToken: targetToken },
            { 'payments.paymentToken': targetToken },
            { 'payments.tokenId': targetToken },
            { 'paymentMethodUsed.token': targetToken }
          ]
        }).toArray();
        console.log(JSON.stringify(docs, null, 2));
      }
    }

    // Also search customer 1 for token_4Ly2ZGGgPa6bhytvzRPqpLxPPp details
    const cust1 = await db.collection('rushwash_customers').findOne({
      $or: [
        { 'moyasarPaymentInstruments.tokenId': 'token_4Ly2ZGGgPa6bhytvzRPqpLxPPp' },
        { 'moyasarPaymentInstruments.token': 'token_4Ly2ZGGgPa6bhytvzRPqpLxPPp' }
      ]
    });
    console.log('\n--- Details for Token 1 (token_4Ly2ZGGgPa6bhytvzRPqpLxPPp) ---');
    console.log(`Customer: ${cust1?.readableCode} | Name: ${cust1?.name} | Phone: ${cust1?.phone}`);
    console.log('Matching instrument:', cust1?.moyasarPaymentInstruments?.find(i => i.tokenId === 'token_4Ly2ZGGgPa6bhytvzRPqpLxPPp' || i.token === 'token_4Ly2ZGGgPa6bhytvzRPqpLxPPp'));

  } finally {
    await client.close();
  }
}

main().catch(console.error);
