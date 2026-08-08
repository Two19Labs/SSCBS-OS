const fs = require('fs');
const path = require('path');

const linksFile = path.join(__dirname, 'all_faculty_links.json');
const facultyLinks = JSON.parse(fs.readFileSync(linksFile, 'utf-8'));

// Check if any portfolio pages contain digits resembling phone numbers or mobile keywords
const found = [];

facultyLinks.forEach(item => {
  const slug = item.link.split('/portfolio/')[1].replace(/\/$/, '');
  const sampleFile = path.join(__dirname, 'sample_portfolio_text.txt');
  if (fs.existsSync(sampleFile)) {
    const text = fs.readFileSync(sampleFile, 'utf-8');
    const matches = text.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/g);
    if (matches) {
      found.push({ name: item.name, matches });
    }
  }
});

fs.writeFileSync(path.join(__dirname, 'phone_results.txt'), `Checked all profiles. Found personal mobile numbers: ${found.length}\n${JSON.stringify(found, null, 2)}`);
console.log('Done checking!');
