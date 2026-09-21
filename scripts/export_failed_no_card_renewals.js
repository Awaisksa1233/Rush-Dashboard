import 'dotenv/config';
import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('rushwash');

    // 1. Fetch subscriptions that failed because of no saved card
    // Group 1: Subscriptions with autoRenew=true where renewal failed / expired / charge unavailable AND have NO saved card
    const subs = await db.collection('rushwash_subscriptions').find({}).toArray();
    const custs = await db.collection('rushwash_customers').find({}).toArray();
    const custMap = new Map(custs.map(c => [c._id.toString(), c]));

    const orders = await db.collection('rushwash_sale_orders').find({
      $or: [
        { isRenewal: true },
        { subscriptionTransitionKind: 'renewal' },
        { notes: { $regex: /subscription_renewal/i } }
      ]
    }).toArray();

    // Map orders by subscription code
    const ordersBySub = new Map();
    for (const o of orders) {
      let sc = o.subscriptionReadableCode;
      if (!sc && o.notes) {
        const m = o.notes.match(/SUB-\d+/i);
        if (m) sc = m[0].toUpperCase();
      }
      if (sc) {
        if (!ordersBySub.has(sc)) ordersBySub.set(sc, []);
        ordersBySub.get(sc).push(o);
      }
    }

    function getCardDetails(s, c) {
      const pmu = s.paymentMethodUsed || {};
      const subToken = pmu.tokenId || pmu.token || pmu.instrumentId;
      const insts = c?.moyasarPaymentInstruments || (c?.moyasarPaymentInstrument ? [c.moyasarPaymentInstrument] : []);
      const validInst = insts.find(i => i.tokenId || i.token || i.id);

      const hasCard = Boolean(subToken || validInst);
      return {
        hasCard,
        subToken: subToken || null,
        instToken: validInst?.tokenId || validInst?.token || validInst?.id || null,
        brand: pmu.brand || validInst?.brand || validInst?.cardType || null,
        lastFour: pmu.lastFour || pmu.last4 || validInst?.lastFour || validInst?.last4 || null
      };
    }

    const failedRenewalsList = [];

    for (const s of subs) {
      const c = custMap.get(s.customerId?.toString());
      const cardInfo = getCardDetails(s, c);
      const subOrders = ordersBySub.get(s.readableCode) || [];

      // Check if any order failed specifically with "NO CARD RECORD"
      const hasNoCardOrder = subOrders.some(o => 
        (o.payments || []).some(p => p.failureReason === 'NO CARD RECORD')
      );

      // Criteria 1: Renewal failed or expired with autoRenew=true and NO card in system
      const isFailedWithoutCard = (s.status === 'expired' || s.lastRenewalFailureReason) && s.autoRenew && !cardInfo.hasCard;

      // Criteria 2: Attempted renewal order failed with explicit "NO CARD RECORD" from payment gateway
      if (isFailedWithoutCard || hasNoCardOrder) {
        // Extract plate
        let plates = [];
        for (const vl of s.vehicleLinks || []) {
          const snap = vl.snapshot || {};
          const p = snap.displayPlate || snap.normalizedPlate;
          if (p) plates.push(p);
        }
        const plateStr = plates.join(', ') || 'N/A';

        // Customer info
        const csnap = s.customerSnapshot || {};
        const custName = csnap.name || c?.name || 'Unknown';
        const phone = csnap.phone || c?.phone || 'N/A';

        // Plan info
        const plan = s.packageNameEn || s.packageSnapshot?.servicePackageCode || s.packageNameAr || 'N/A';

        // Reason description
        let category = '';
        let failureDetails = '';
        if (hasNoCardOrder) {
          category = 'GATEWAY_ERROR_NO_CARD_RECORD';
          failureDetails = 'Payment gateway rejected attempt: NO CARD RECORD';
        } else if (!cardInfo.hasCard) {
          category = 'NO_SAVED_CARD_IN_PROFILE';
          failureDetails = s.lastRenewalFailureReason ? `Charge unavailable (${s.lastRenewalFailureReason}) - No card token found` : 'Subscription expired with autoRenew enabled but no payment method saved';
        }

        const renewalDateStr = s.renewalDate ? new Date(s.renewalDate).toISOString().slice(0, 10) : 'N/A';
        const lastOrder = subOrders.length ? subOrders[subOrders.length - 1].readableCode : 'None';

        failedRenewalsList.push({
          subscription_code: s.readableCode,
          customer_name: custName,
          phone: phone,
          plate: plateStr,
          plan: plan,
          price_sar: s.price ?? 0,
          status: s.status,
          auto_renew: s.autoRenew ? 'true' : 'false',
          renewal_date: renewalDateStr,
          failure_category: category,
          failure_reason: s.lastRenewalFailureReason || (hasNoCardOrder ? 'NO CARD RECORD' : 'No saved card'),
          failure_details: failureDetails,
          attempts_count: subOrders.length,
          last_order_code: lastOrder,
          saved_card_found: cardInfo.hasCard ? 'YES' : 'NO'
        });
      }
    }

    // Sort by renewal date descending
    failedRenewalsList.sort((a, b) => b.renewal_date.localeCompare(a.renewal_date));

    console.log(`Total renewals identified that failed due to no saved card / token: ${failedRenewalsList.length}`);

    // Convert to CSV
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

    const csvContent = toCsv(failedRenewalsList);
    const outPath = path.join(process.cwd(), 'renewals_failed_no_saved_card.csv');
    fs.writeFileSync(outPath, '\uFEFF' + csvContent, 'utf-8');
    console.log(`Exported CSV report to: ${outPath}`);

    // Print summary counts
    const catCounts = {};
    for (const r of failedRenewalsList) {
      catCounts[r.failure_category] = (catCounts[r.failure_category] || 0) + 1;
    }
    console.log('\nCategory breakdown:', catCounts);

    const statusCounts = {};
    for (const r of failedRenewalsList) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    }
    console.log('Status breakdown:', statusCounts);

    const totalSar = failedRenewalsList.reduce((acc, r) => acc + (parseFloat(r.price_sar) || 0), 0);
    console.log(`Total impacted revenue: SAR ${totalSar.toFixed(2)}`);

    console.log('\nSample rows:');
    console.table(failedRenewalsList.slice(0, 15).map(r => ({
      Sub: r.subscription_code,
      Customer: r.customer_name,
      Phone: r.phone,
      Plate: r.plate,
      Plan: r.plan,
      Price: `${r.price_sar} SAR`,
      RenewalDate: r.renewal_date,
      Status: r.status,
      Category: r.failure_category,
      Reason: r.failure_reason
    })));

  } finally {
    await client.close();
  }
}

main().catch(console.error);
