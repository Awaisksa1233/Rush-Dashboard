import fs from 'fs';

const content = fs.readFileSync('double_renewal_and_post_charge_audit.csv', 'utf-8');
const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

const doubleCharged = [];
const chargedThenAttempted = [];

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

  // Focus on renewals within <= 20 days and recent (Sep/Aug)
  if (gapDays <= 20 && amt1 > 0) {
    const item = {
      sub: row[0],
      plate: row[1],
      cust: row[2],
      ord1: row[5],
      date1: row[6],
      amt1: row[7],
      payId1: row[9] || 'N/A',
      ord2: row[10],
      date2: row[11],
      amt2: row[13],
      payId2: row[16] || 'N/A',
      status2: row[12],
      reason2: row[15],
      gapDays: row[17],
      gapHours: row[18]
    };

    if (cat && cat.startsWith('Double Charged') && amt2 > 0) {
      doubleCharged.push(item);
    } else if (cat && cat.startsWith('Charged Then Re-attempted')) {
      chargedThenAttempted.push(item);
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

const dc = dedup(doubleCharged);
const ca = dedup(chargedThenAttempted);

console.log('=== DOUBLE CHARGED (BOTH PAID) ===');
console.log(JSON.stringify(dc, null, 2));

console.log('=== CHARGED THEN ATTEMPTED AGAIN ===');
console.log(JSON.stringify(ca.slice(0, 15), null, 2));
