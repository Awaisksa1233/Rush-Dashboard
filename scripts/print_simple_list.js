import fs from 'fs';

const content = fs.readFileSync('double_renewal_and_post_charge_audit.csv', 'utf-8');
const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

const doubleCharged = [];
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
  if (cat && cat.startsWith('Double Charged')) {
    const amt1 = parseFloat(row[7]);
    const amt2 = parseFloat(row[13]);
    if (amt1 > 0 && amt2 > 0) {
      doubleCharged.push({
        plate: row[1],
        customer: row[2],
        sub: row[0],
        amt1: row[7],
        date1: row[6],
        ord1: row[5],
        payId1: row[9],
        amt2: row[13],
        date2: row[11],
        ord2: row[10],
        payId2: row[16],
        gapDays: row[17]
      });
    }
  }
}

const seen = new Set();
const unique = [];
for (const d of doubleCharged) {
  const k = `${d.ord1}_${d.ord2}`;
  if (!seen.has(k)) {
    seen.add(k);
    unique.push(d);
  }
}

console.log(JSON.stringify(unique, null, 2));
