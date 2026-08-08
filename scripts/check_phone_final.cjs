const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const links = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_faculty_links.json'), 'utf-8'));

console.log('Checking all 29 professor profile pages for personal phone numbers...');

const phoneFound = [];

links.forEach((item) => {
  if (item.link.includes('/sadhana/')) return;

  try {
    const html = execSync(`curl -s -L "${item.link}"`).toString('utf-8');

    // Remove site footer text to exclude general college lines
    const mainBody = html.split('kingster-footer-wrapper')[0] || html;

    // Search for 10-digit mobile numbers or phone numbers
    const matches = mainBody.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/g) || [];
    const filtered = matches.filter(num => !num.includes('21700285') && !num.includes('27573447'));

    if (filtered.length > 0) {
      phoneFound.push({ name: item.name, numbers: filtered });
    }
  } catch (e) {}
});

console.log('\n================ PHONE NUMBER CHECK RESULTS ================');
console.log('Results:', JSON.stringify(phoneFound, null, 2));
console.log('Total profs with personal phone numbers listed:', phoneFound.length);
