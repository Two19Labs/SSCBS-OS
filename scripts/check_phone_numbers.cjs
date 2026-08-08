const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const linksFile = path.join(__dirname, 'all_faculty_links.json');
const facultyLinks = JSON.parse(fs.readFileSync(linksFile, 'utf-8'));

console.log(`Checking for phone numbers across ${facultyLinks.length} faculty profile pages...`);

const results = [];

facultyLinks.forEach((item, idx) => {
  if (item.link.includes('/sadhana/')) return;

  try {
    const html = execSync(`curl -s -L "${item.link}"`).toString('utf-8');

    // Filter main content (ignore footer phone 011-21700285 / 011-27573447)
    let bodyHtml = html;
    const footerIdx = html.indexOf('kingster-footer-wrapper') || html.indexOf('gdlr-core-footer');
    if (footerIdx !== -1) {
      bodyHtml = html.substring(0, footerIdx);
    }

    // Search for phone patterns: +91, 011-, 9810..., 98..., 99..., 97..., 96..., 95..., 94...
    const phoneMatches = bodyHtml.match(/(?:\+?91[\s-]?)?[6-9]\d{9}/g) || 
                         bodyHtml.match(/011[-.\s]?\d{7,8}/g) || 
                         bodyHtml.match(/(?:Ph|Phone|Mobile|Tel|Contact|Mob)[\s.:]*([+\d\s-]{8,15})/gi);

    const cleanPhones = [];
    if (phoneMatches) {
      phoneMatches.forEach(p => {
        const clean = p.replace(/<[^>]+>/g, '').trim();
        // Ignore official college office numbers 011-21700285 / 011-27573447
        if (!clean.includes('21700285') && !clean.includes('27573447') && clean.length >= 8) {
          cleanPhones.push(clean);
        }
      });
    }

    if (cleanPhones.length > 0) {
      results.push({ name: item.name, link: item.link, phones: cleanPhones });
    }

  } catch (e) {}
});

console.log('\n================ PHONE NUMBER CHECK RESULTS ================');
console.log(`Professors with personal phone numbers found: ${results.length}`);
console.log(JSON.stringify(results, null, 2));
