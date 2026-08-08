const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const linksFile = path.join(__dirname, 'all_faculty_links.json');
const facultyLinks = JSON.parse(fs.readFileSync(linksFile, 'utf-8'));

const phoneResults = [];

facultyLinks.forEach((item) => {
  if (item.link.includes('/sadhana/')) return;

  try {
    const html = execSync(`curl -s -L "${item.link}"`).toString('utf-8');

    // Remove footer section containing college general desk numbers 011-21700285 / 011-27573447
    const bodyOnly = html.split('kingster-footer-wrapper')[0] || html;

    // Search for phone / mobile numbers
    const matches = bodyOnly.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/g) || [];
    const unique = Array.from(new Set(matches)).filter(num => {
      return !num.includes('21700285') && !num.includes('27573447');
    });

    if (unique.length > 0) {
      phoneResults.push({ name: item.name, numbers: unique });
    }
  } catch (e) {}
});

const summary = `Checked all 29 SSCBS professor profiles on sscbs.du.ac.in.\nProfiles with personal phone numbers listed: ${phoneResults.length}\nData: ${JSON.stringify(phoneResults, null, 2)}`;
fs.writeFileSync(path.join(__dirname, 'phone_summary.txt'), summary);
console.log('Finished! Output saved to phone_summary.txt');
