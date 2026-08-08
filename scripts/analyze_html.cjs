const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'raw_faculty.html'), 'utf-8');
const out = [];

out.push('HTML total length: ' + html.length);

const namesToSearch = ['Abhimanyu Verma', 'Kumar Bijoy', 'Kavita Rastogi', 'Onkar Singh', 'Tushar Marwaha', 'Poonam Verma', 'Raj Kumar'];

namesToSearch.forEach(name => {
  let idx = html.indexOf(name);
  if (idx !== -1) {
    out.push(`\n================ FOUND: ${name} ================`);
    out.push(html.substring(Math.max(0, idx - 400), Math.min(html.length, idx + 600)));
  } else {
    out.push(`NOT FOUND: ${name}`);
  }
});

fs.writeFileSync(path.join(__dirname, 'out.txt'), out.join('\n'));
console.log('Wrote output to scripts/out.txt');
