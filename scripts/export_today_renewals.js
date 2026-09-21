import 'dotenv/config';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    console.log('Fetching all packages into memory...');
    const pkgs = await db.collection('rushwash_service_packages').find().toArray();
    const pkgMap = {};
    for (const p of pkgs) {
      if (p.readableCode) pkgMap[p.readableCode] = p;
      if (p._id) pkgMap[p._id.toString()] = p;
    }

    console.log('Fetching subscriptions due on Sep 10, 2026...');

    // KSA day: 2026-09-09T21:00:00.000Z to 2026-09-10T20:59:59.999Z
    const startOfSep10 = new Date('2026-09-09T21:00:00.000Z');
    const endOfSep10 = new Date('2026-09-10T20:59:59.999Z');

    const subs = await db.collection('rushwash_subscriptions').find({
      renewalDate: { $gte: startOfSep10, $lte: endOfSep10 }
    }).sort({ renewalDate: 1 }).toArray();

    console.log(`Found ${subs.length} total subscriptions with renewalDate on Sep 10.`);

    // Pre-fetch all customer documents for these subs in one query
    const custIds = [...new Set(subs.map(s => s.customerId).filter(Boolean))];
    const custDocs = await db.collection('rushwash_customers').find({ _id: { $in: custIds } }).toArray();
    const custMap = {};
    for (const c of custDocs) {
      custMap[c._id.toString()] = c;
    }

    const rows = [];

    for (const s of subs) {
      const cust = custMap[s.customerId?.toString()] || {};
      
      // Get payment instruments
      const insts = cust.moyasarPaymentInstruments || (cust.moyasarPaymentInstrument ? [cust.moyasarPaymentInstrument] : []);
      // Choose primary or latest saved
      const primaryInst = insts.find(i => i.isPrimary) || insts[insts.length - 1] || {};
      
      const moyasarToken = primaryInst.tokenId || primaryInst.token || (primaryInst.id?.startsWith?.('token_') ? primaryInst.id : '') || '';
      const instrumentId = primaryInst.id || '';
      const brand = primaryInst.brand || primaryInst.cardType || primaryInst.company || '';
      const last4 = primaryInst.lastFour || primaryInst.last4 || '';

      // Get vehicles
      const vLinks = s.vehicleLinks || [];
      const plates = [];
      const vehCodes = [];
      for (const vl of vLinks) {
        const snap = vl.snapshot || {};
        if (snap.displayPlate || snap.normalizedPlate) {
          plates.push(snap.displayPlate || snap.normalizedPlate);
        }
        if (snap.readableCode) vehCodes.push(snap.readableCode);
      }

      const plateStr = plates.join(' / ') || 'N/A';
      const vehCodeStr = vehCodes.join(' / ') || 'N/A';

      // Get plan name / package
      const pkgCode = s.packageReadableCode || s.planReadableCode || '';
      const pkg = pkgMap[pkgCode] || pkgMap[s.packageId?.toString()] || {};

      let planName = 'Unknown';
      if (typeof s.packageName === 'string') planName = s.packageName;
      else if (s.packageName?.en) planName = s.packageName.en;
      else if (typeof s.planName === 'string') planName = s.planName;
      else if (s.planName?.en) planName = s.planName.en;
      else if (pkg.name?.en) planName = pkg.name.en;
      else if (typeof pkg.name === 'string') planName = pkg.name;
      else if (pkgCode) planName = pkgCode;

      const price = s.price ?? s.recurringPrice ?? pkg.price ?? 0;
      const hasToken = (moyasarToken || instrumentId) ? 'YES' : 'NO';

      rows.push({
        subscription_code: s.readableCode,
        status: s.status,
        auto_renew: s.autoRenew ? 'true' : 'false',
        renewal_date: s.renewalDate ? s.renewalDate.toISOString() : '',
        customer_code: cust.readableCode || '',
        customer_name: cust.name || '',
        phone: cust.phone || '',
        plate: plateStr,
        vehicle_code: vehCodeStr,
        plan_code: pkgCode,
        plan_name: planName,
        amount_sar: Number(price).toFixed(2),
        has_token: hasToken,
        moyasar_token: moyasarToken,
        instrument_id: instrumentId,
        card_brand: brand,
        card_last_four: last4,
        all_instruments_count: insts.length
      });
    }

    // CSV formatting helper
    function toCsv(data) {
      if (!data.length) return '';
      const headers = Object.keys(data[0]);
      const csvLines = [headers.join(',')];
      for (const row of data) {
        const values = headers.map(h => {
          let val = row[h] ?? '';
          val = String(val).replace(/"/g, '""');
          if (val.includes(',') || val.includes('\n') || val.includes('"')) {
            val = `"${val}"`;
          }
          return val;
        });
        csvLines.push(values.join(','));
      }
      return csvLines.join('\n');
    }

    // Write all Sep 10 renewals (all statuses)
    const fullCsvContent = toCsv(rows);
    const fullOutPath = path.join(process.cwd(), 'pending_renewals_sep10_all.csv');
    fs.writeFileSync(fullOutPath, '\uFEFF' + fullCsvContent, 'utf-8');
    console.log(`Saved all ${rows.length} subscriptions to: ${fullOutPath}`);

    // Write ONLY the 54 active subscriptions with tokens ready for execution
    const readyRows = rows.filter(r => r.status === 'active' && r.has_token === 'YES');
    const readyCsvContent = toCsv(readyRows);
    const readyOutPath = path.join(process.cwd(), 'pending_renewals_sep10_ready_tokens.csv');
    fs.writeFileSync(readyOutPath, '\uFEFF' + readyCsvContent, 'utf-8');
    console.log(`Saved ${readyRows.length} ready-to-charge subscriptions to: ${readyOutPath}`);

    // Quick stats
    console.log('\n=================================================');
    console.log('EXPORT FINISHED SUCCESSFULLY');
    console.log('=================================================');
    console.log(`Total Sep 10 Subscriptions: ${rows.length}`);
    console.log(`Active with Valid Tokens (Ready): ${readyRows.length}`);
    const readyRev = readyRows.reduce((acc, r) => acc + parseFloat(r.amount_sar), 0);
    console.log(`Total Ready Revenue: SAR ${readyRev.toFixed(2)}`);

    const missingTokenRows = rows.filter(r => r.status === 'active' && r.has_token === 'NO');
    console.log(`Active with Missing Tokens: ${missingTokenRows.length}`);

    // Print sample of 5 ready rows
    console.log('\nSample 5 ready records:');
    for (const r of readyRows.slice(0, 5)) {
      console.log(`${r.subscription_code} | ${r.customer_name} | ${r.phone} | ${r.plate} | ${r.plan_name} | ${r.amount_sar} SAR | Moyasar Token: ${r.moyasar_token} | Instrument: ${r.instrument_id}`);
    }

  } finally {
    await client.close();
  }
}

main().catch(console.error);
