const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const url = 'https://sscbs.du.ac.in/guest-faculties/';
console.log(`Scraping Guest Faculty page: ${url}...`);

try {
  const html = execSync(`curl -s -L "${url}"`).toString('utf-8');
  fs.writeFileSync(path.join(__dirname, 'guest_faculty_raw.html'), html);
  console.log('Saved guest_faculty_raw.html!');
} catch (e) {
  console.error('Error fetching guest faculty page:', e);
}
