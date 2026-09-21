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

const rows = [];
const seen = new Set();

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
  const gapDays = parseFloat(row[17]);
  const amt1 = parseFloat(row[7]);
  const amt2 = parseFloat(row[13]);
  const plate = row[1];
  const ord1 = row[5];
  const payId1 = row[9] || '';
  const ord2 = row[10];
  const payId2 = row[16] || '';
  const status2 = row[12];
  const reason2 = row[15];

  // Include confirmed double charges and charged-then-attempted cases
  if (gapDays <= 20 && amt1 > 0 && plate) {
    const isDoubleCharged = cat && cat.startsWith('Double Charged') && amt2 > 0;
    const isChargedThenAttempted = cat && cat.startsWith('Charged Then Re-attempted');

    if (isDoubleCharged || isChargedThenAttempted) {
      const pairKey = `${ord1}_${ord2}`;
      if (!seen.has(pairKey)) {
        seen.add(pairKey);
        rows.push({
          plateNumber: plate,
          firstChargeAmountSar: amt1,
          firstChargeOrderId: ord1,
          firstChargePaymentId: payId1,
          secondChargeAmountSar: amt2,
          secondChargeOrderId: ord2,
          secondChargePaymentId: payId2,
          secondChargeStatus: isDoubleCharged ? 'Paid' : (status2 || 'Failed'),
          secondChargeFailureReason: isDoubleCharged ? 'SUCCESS' : reason2,
          gapDays: row[17],
          category: isDoubleCharged ? 'Double Charged (Billed Twice)' : 'Charged Then Attempted Again (Failed)'
        });
      }
    }
  }
}

// Sort: Double charged first, then by plate
rows.sort((a, b) => {
  if (a.category.startsWith('Double Charged') && !b.category.startsWith('Double Charged')) return -1;
  if (!a.category.startsWith('Double Charged') && b.category.startsWith('Double Charged')) return 1;
  return a.plateNumber.localeCompare(b.plateNumber);
});

const headers = [
  'Plate',
  'First Charge Amount (SAR)',
  'First Charge Order ID',
  'First Charge Payment ID',
  'Second Charge Amount (SAR)',
  'Second Charge Order ID',
  'Second Charge Payment ID',
  'Second Charge Status',
  'Second Charge Reason',
  'Gap Days',
  'Category'
];

const csvLines = [headers.join(',')];
for (const r of rows) {
  csvLines.push([
    escapeCsv(r.plateNumber),
    escapeCsv(r.firstChargeAmountSar),
    escapeCsv(r.firstChargeOrderId),
    escapeCsv(r.firstChargePaymentId),
    escapeCsv(r.secondChargeAmountSar),
    escapeCsv(r.secondChargeOrderId),
    escapeCsv(r.secondChargePaymentId),
    escapeCsv(r.secondChargeStatus),
    escapeCsv(r.secondChargeFailureReason),
    escapeCsv(r.gapDays),
    escapeCsv(r.category)
  ].join(','));
}

const outputPath = path.join(process.cwd(), 'double_charges_simple_list.csv');
fs.writeFileSync(outputPath, '\uFEFF' + csvLines.join('\n'), 'utf-8');
console.log(`Generated simple CSV at: ${outputPath} with ${rows.length} rows.`);
