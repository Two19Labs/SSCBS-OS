const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const linksFile = path.join(__dirname, 'all_faculty_links.json');
const facultyLinks = JSON.parse(fs.readFileSync(linksFile, 'utf-8'));
const jsonPath = path.join(__dirname, '..', 'src', 'data', 'faculty_directory.json');
let dataset = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

console.log('Running phone extraction...');

dataset = dataset.map(prof => {
  const item = facultyLinks.find(l => l.link.includes(prof.id));
  if (!item) return prof;

  try {
    const html = execSync(`curl -s -L "${item.link}"`).toString('utf-8');

    // Isolate body text before footer
    const bodyOnly = html.split('kingster-footer-wrapper')[0] || html;
    const text = bodyOnly.replace(/<script[\s\S]*?<\/script>/gi, '')
                         .replace(/<style[\s\S]*?<\/style>/gi, '')
                         .replace(/<[^>]+>/g, '\n')
                         .replace(/[ \t]+/g, ' ')
                         .replace(/\n+/g, '\n');

    // Search for phone numbers like +91-981-801-1766 or 9818011766
    const phoneMatch = text.match(/(?:\+?91[\s-]?)?[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4}/g);

    let phone = null;
    if (phoneMatch) {
      const valid = phoneMatch.find(p => !p.includes('21700285') && !p.includes('27573447'));
      if (valid) phone = valid.trim();
    }

    return {
      ...prof,
      phone: phone || null
    };
  } catch (e) {
    return prof;
  }
});

fs.writeFileSync(jsonPath, JSON.stringify(dataset, null, 2));

const withPhone = dataset.filter(p => p.phone);
console.log(`Finished! Professors with phone numbers found: ${withPhone.length}`);
withPhone.forEach(p => console.log(`- ${p.name}: ${p.phone}`));
