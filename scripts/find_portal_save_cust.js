import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    const linkId = '5a3490cb-d723-45ce-b4da-ab6ecb9aff6f';
    const pmtId = '3b35d496-b866-42bb-9774-1ae2ebf74212';

    console.log('--- Searching for PaymentLink or customer with linkId or pmtId ---');
    const audits = await db.collection('rushwash_audit_events').find({
      $or: [
        { entityReadableCode: linkId },
        { 'data.paymentLinkId': linkId },
        { 'after.paymentLinkId': linkId },
        { 'before.paymentLinkId': linkId }
      ]
    }).toArray();

    console.log(`Found ${audits.length} audit events for payment link ${linkId}:`);
    for (const a of audits) {
      console.log(JSON.stringify(a, null, 2));
    }

    // Check if any customer recently added an instrument (updatedAt around 14:36)
    const custs = await db.collection('rushwash_customers').find({
      $or: [
        { 'moyasarPaymentInstruments.id': pmtId },
        { 'moyasarPaymentInstruments.tokenId': pmtId },
        { 'moyasarPaymentInstruments.savedAt': { $gte: '2026-09-10T14:35:00' } },
        { updatedAt: { $gte: new Date('2026-09-10T14:35:00Z') } }
      ]
    }).toArray();

    console.log(`\nFound ${custs.length} customers updated around 14:36:`);
    for (const c of custs) {
      console.log(`Customer: ${c.readableCode} | Name: ${c.name} | Phone: ${c.phone} | UpdatedAt: ${c.updatedAt}`);
      console.log('Instruments:', JSON.stringify(c.moyasarPaymentInstruments || c.moyasarPaymentInstrument, null, 2));
    }

    // Check CUS-00276 specifically
    const c00276 = await db.collection('rushwash_customers').findOne({ readableCode: 'CUS-00276' });
    console.log('\nCUS-00276 instruments:', JSON.stringify(c00276?.moyasarPaymentInstruments || c00276?.moyasarPaymentInstrument, null, 2));

  } finally {
    await client.close();
  }
}

main().catch(console.error);
