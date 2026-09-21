import fs from 'fs';
import path from 'path';

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const content = fs.readFileSync('double_renewal_and_post_charge_audit.csv', 'utf-8');
const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

const autoDoubleCharged = [];
const autoChargedThenAttempted = [];

for (let i = 1; i < lines.length; i++) {
  const row = [];
  let inQuotes = false;
  let current = '';
  for (const c of lines[i]) {
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  row.push(current);

  const cat = row[4];
  const method1 = (row[8] || '').toLowerCase();
  const method2 = (row[14] || '').toLowerCase();
  const amt1 = parseFloat(row[7]);
  const amt2 = parseFloat(row[13]);
  const gapDays = parseFloat(row[17]);

  // Automated only: "Saved card" or "moyasar_token", NOT Cash, NOT POS, NOT Payment Link
  const isAuto1 = method1.includes('saved card') || method1.includes('token');
  const isAuto2 = method2.includes('saved card') || method2.includes('token');

  // If both are automated renewals
  if (isAuto1 && isAuto2 && amt1 > 0 && gapDays <= 20) {
    const item = {
      plate: row[1],
      customer: row[2],
      sub: row[0],
      amt1: row[7],
      date1: row[6],
      ord1: row[5],
      payId1: row[9] || 'N/A',
      amt2: row[13],
      date2: row[11],
      ord2: row[10],
      payId2: row[16] || 'N/A',
      status2: row[12],
      reason2: row[15],
      gapDays: row[17],
      gapHours: row[18],
      category: cat
    };

    if (cat.startsWith('Double Charged') && amt2 > 0) {
      autoDoubleCharged.push(item);
    } else if (cat.startsWith('Charged Then Re-attempted')) {
      autoChargedThenAttempted.push(item);
    }
  }
}

function dedup(list) {
  const seen = new Set();
  const out = [];
  for (const x of list) {
    const k = `${x.ord1}_${x.ord2}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

const dc = dedup(autoDoubleCharged);
const ca = dedup(autoChargedThenAttempted);

console.log('=== AUTOMATED DOUBLE CHARGED (BOTH PAID VIA SAVED CARD) ===');
console.log(JSON.stringify(dc, null, 2));

console.log(`=== AUTOMATED CHARGED THEN ATTEMPTED AGAIN (SAVED CARD) (${ca.length} cases) ===`);
console.log(JSON.stringify(ca, null, 2));

// Generate clean CSV for Automated Double Renewals
const headers = [
  'Plate',
  'First Charge Amount (SAR)',
  'First Charge Order ID',
  'First Charge Payment ID',
  'First Charge Date (KSA)',
  'Second Charge Amount (SAR)',
  'Second Charge Order ID',
  'Second Charge Payment ID',
  'Second Charge Date (KSA)',
  'Second Charge Status',
  'Gap Days',
  'Issue Type'
];

const allRows = [
  ...dc.map(r => ({ ...r, type: 'Double Charged (Both Paid via Saved Card)' })),
  ...ca.map(r => ({ ...r, type: 'Charged Then Auto-Attempted Again (Failed via Saved Card)' }))
];

const csvLines = [headers.join(',')];
for (const r of allRows) {
  csvLines.push([
    escapeCsv(r.plate),
    escapeCsv(r.amt1),
    escapeCsv(r.ord1),
    escapeCsv(r.payId1),
    escapeCsv(r.date1),
    escapeCsv(r.amt2),
    escapeCsv(r.ord2),
    escapeCsv(r.payId2),
    escapeCsv(r.date2),
    escapeCsv(r.status2),
    escapeCsv(r.gapDays),
    escapeCsv(r.type)
  ].join(','));
}

const outPath = path.join(process.cwd(), 'automated_double_renewals_saved_card.csv');
fs.writeFileSync(outPath, '\uFEFF' + csvLines.join('\n'), 'utf-8');
console.log(`Saved automated double renewals to ${outPath} with ${allRows.length} rows.`);
