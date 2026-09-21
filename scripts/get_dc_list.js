import fs from 'fs';

const content = fs.readFileSync('double_renewal_and_post_charge_audit.csv', 'utf-8');
const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

const dc = [];
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

  // Focus on recent renewals (August / September 2026) within 20 days
  if (cat && cat.startsWith('Double Charged') && gapDays <= 20 && amt1 > 0 && amt2 > 0) {
    dc.push({
      plate: row[1],
      amt1: row[7],
      ord1: row[5],
      payId1: row[9] || 'N/A',
      amt2: row[13],
      ord2: row[10],
      payId2: row[16] || 'N/A',
      gapDays: row[17]
    });
  }
}

const seen = new Set();
const unique = [];
for (const x of dc) {
  const k = `${x.ord1}_${x.ord2}`;
  if (!seen.has(k)) {
    seen.add(k);
    unique.push(x);
  }
}

console.log(JSON.stringify(unique, null, 2));
