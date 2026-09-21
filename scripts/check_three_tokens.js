import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function main() {
  const tokens = [
    'token_4Ly2ZGGgPa6bhytvzRPqpLxPPp',
    'token_3zGF7wUU7NQ2VrNfUwcfQg213s',
    'token_M3QC4nZ8NCoKxBpJtimQSZhTSb'
  ];

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('Connected to Atlas rushwash DB. Investigating the 3 tokens...\n');

    for (const tok of tokens) {
      console.log('========================================================================');
      console.log(`TOKEN: ${tok}`);
      console.log('========================================================================');

      // 1. Find customer(s) with this token
      const custs = await db.collection('rushwash_customers').find({
        $or: [
          { 'moyasarPaymentInstruments.tokenId': tok },
          { 'moyasarPaymentInstruments.token': tok },
          { 'moyasarPaymentInstrument.tokenId': tok },
          { 'moyasarPaymentInstrument.token': tok },
          { 'paymentMethodUsed.token': tok }
        ]
      }).toArray();

      console.log(`Customers found with token: ${custs.length}`);
      const custIds = [];
      for (const c of custs) {
        custIds.push(c._id);
        const insts = c.moyasarPaymentInstruments || (c.moyasarPaymentInstrument ? [c.moyasarPaymentInstrument] : []);
        const matchingInsts = insts.filter(i => i.tokenId === tok || i.token === tok || i.id === tok);
        console.log(`  Customer: ${c.readableCode} | Name: ${c.name} | Phone: ${c.phone} | ID: ${c._id}`);
        console.log(`  Matching Instrument(s):`, JSON.stringify(matchingInsts, null, 2));
      }

      // Also search subscriptions directly
      const subs = await db.collection('rushwash_subscriptions').find({
        $or: [
          { customerId: { $in: custIds } },
          { 'paymentMethodUsed.token': tok },
          { 'paymentMethodUsed.tokenId': tok },
          { 'paymentInstrument.token': tok },
          { 'paymentInstrument.tokenId': tok }
        ]
      }).toArray();

      console.log(`\nSubscriptions tied to customer/token: ${subs.length}`);
      const subCodes = [];
      for (const s of subs) {
        subCodes.push(s.readableCode);
        const vPlates = (s.vehicleLinks || []).map(vl => vl.snapshot?.displayPlate || vl.snapshot?.normalizedPlate).filter(Boolean).join(', ');
        console.log(`  Sub: ${s.readableCode} | Status: ${s.status} | Plan: ${s.packageName || s.planName || s.packageReadableCode} | Price: ${s.price} SAR | Renewal: ${s.renewalDate?.toISOString?.()} | Plate: ${vPlates}`);
      }

      // 2. Check sale_orders for any charges with this token or for these subs/customers
      const tokenOrders = await db.collection('rushwash_sale_orders').find({
        $or: [
          { 'payments.providerPaymentId': tok },
          { 'payments.paymentMethodIdentityKey': { $regex: tok } },
          { 'payments.paymentToken': tok },
          { 'payments.tokenId': tok },
          { subscriptionReadableCode: { $in: subCodes } },
          { subCode: { $in: subCodes } }
        ]
      }).sort({ createdAt: -1 }).toArray();

      console.log(`\nSale Orders found: ${tokenOrders.length}`);
      for (const o of tokenOrders) {
        const pmts = o.payments || [];
        console.log(`  Order: ${o.readableCode} | Created: ${o.createdAt?.toISOString?.()} | Status: ${o.status} | Sub: ${o.subscriptionReadableCode || o.subCode} | Total: ${o.postDiscountTotal} SAR | Notes: ${o.notes}`);
        for (const p of pmts) {
          console.log(`    Payment: status=${p.status}, amount=${p.amount}, providerId=${p.providerPaymentId}, failReason=${p.failureReason || 'N/A'}, date=${p.occurredAt}`);
        }
      }

      // 3. Check audit events for this token
      const audits = await db.collection('rushwash_audit_events').find({
        $or: [
          { entityReadableCode: tok },
          { 'after.token': tok },
          { 'data.token': tok },
          { 'payload.token': tok },
          { 'details.token': tok }
        ]
      }).sort({ occurredAt: -1 }).toArray();

      console.log(`\nAudit events matching token: ${audits.length}`);
      for (const a of audits) {
        console.log(`  Audit: ${a.occurredAt?.toISOString?.()} | Event: ${a.eventType} | Entity: ${a.entityType}:${a.entityReadableCode} | Details: ${JSON.stringify(a.after || a.data || a.details)}`);
      }

      // Also check instrument IDs associated with this token in payments
      const instIds = [];
      for (const c of custs) {
        const insts = c.moyasarPaymentInstruments || (c.moyasarPaymentInstrument ? [c.moyasarPaymentInstrument] : []);
        for (const i of insts) {
          if ((i.tokenId === tok || i.token === tok) && i.id) instIds.push(i.id);
        }
      }

      if (instIds.length > 0) {
        const instAudits = await db.collection('rushwash_audit_events').find({
          entityReadableCode: { $in: instIds }
        }).sort({ occurredAt: -1 }).toArray();
        console.log(`\nAudit events matching instrument IDs (${instIds.join(', ')}): ${instAudits.length}`);
        for (const ia of instAudits) {
          console.log(`  Inst Audit: ${ia.occurredAt?.toISOString?.()} | Event: ${ia.eventType} | Entity: ${ia.entityReadableCode} | Data: ${JSON.stringify(ia.after || ia.data || {})}`);
        }
      }
      console.log('\n');
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
