import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('Searching for any token matching /token_M3/i ...');

    const custs = await db.collection('rushwash_customers').find({
      $or: [
        { 'moyasarPaymentInstruments.tokenId': { $regex: /token_M3/i } },
        { 'moyasarPaymentInstruments.token': { $regex: /token_M3/i } },
        { 'moyasarPaymentInstruments.id': { $regex: /M3QC/i } }
      ]
    }).toArray();

    console.log(`Matching customers: ${custs.length}`);
    for (const c of custs) {
      console.log(`Customer ${c.readableCode}:`, JSON.stringify(c.moyasarPaymentInstruments, null, 2));
    }

    // Also search audit events
    const audits = await db.collection('rushwash_audit_events').find({
      $or: [
        { 'after.token': { $regex: /token_M3/i } },
        { entityReadableCode: { $regex: /M3/i } }
      ]
    }).limit(10).toArray();
    console.log(`Matching audits: ${audits.length}`);
    for (const a of audits) {
      console.log(a.eventId, a.eventType, a.entityReadableCode, JSON.stringify(a.after || {}));
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
