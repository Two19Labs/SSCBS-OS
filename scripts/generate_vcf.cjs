const { DEMO_SOCIETIES } = require('../src/data/societies.js');
const fs = require('fs');

let vcf = '';
let count = 0;

DEMO_SOCIETIES.forEach((s) => {
  if (Array.isArray(s.pocs)) {
    s.pocs.forEach((poc) => {
      const cleanPhone = poc.phone.replace(/[^0-9]/g, '').slice(-10);
      if (cleanPhone.length === 10) {
        vcf += 'BEGIN:VCARD\n';
        vcf += 'VERSION:3.0\n';
        vcf += `FN:POR ${s.shortName || s.name} ${poc.name}\n`;
        vcf += `TEL;TYPE=CELL:+91${cleanPhone}\n`;
        vcf += 'END:VCARD\n\n';
        count++;
      }
    });
  }
});

fs.writeFileSync('sscbs_por_contacts.vcf', vcf, 'utf8');
console.log(`Successfully generated sscbs_por_contacts.vcf with ${count} contacts.`);
