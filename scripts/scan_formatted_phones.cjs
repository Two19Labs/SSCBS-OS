const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const links = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_faculty_links.json'), 'utf-8'));

console.log('Scanning all 29 professor portfolio pages for formatted phone numbers...');

const phoneMap = {};

links.forEach((item) => {
  if (item.link.includes('/sadhana/')) return;

  try {
    const html = execSync(`curl -s -L "${item.link}"`).toString('utf-8');

    // Isolate body before site footer
    const bodyText = html.split('kingster-footer-wrapper')[0] || html;
    
    // Clean text conversion
    const text = bodyText.replace(/<script[\s\S]*?<\/script>/gi, '')
                         .replace(/<style[\s\S]*?<\/style>/gi, '')
                         .replace(/<[^>]+>/g, '\n')
                         .replace(/[ \t]+/g, ' ')
                         .replace(/\n+/g, '\n');

    // Regex for phone numbers with dashes/spaces/country codes e.g. +91-981-801-1766
    const phoneRegex = /(?:\+?91[\s-]?)?(?:\d{3,5}[\s-]?\d{3,4}[\s-]?\d{3,4})/g;
    const matches = text.match(phoneRegex) || [];

    const cleanNumbers = [];
    matches.forEach(m => {
      const trimmed = m.trim();
      const digitsOnly = trimmed.replace(/\D/g, '');
      
      // Filter out dates, ISBNs, ISSNs, years, college phone (01121700285 / 01127573447), timestamps
      if (
        digitsOnly.length >= 10 &&
        digitsOnly.length <= 12 &&
        !trimmed.includes('21700285') &&
        !trimmed.includes('27573447') &&
        !trimmed.includes('2020') &&
        !trimmed.includes('2021') &&
        !trimmed.includes('2022') &&
        !trimmed.includes('2023') &&
        !trimmed.includes('2024') &&
        !trimmed.includes('2025') &&
        !trimmed.includes('2026') &&
        !trimmed.startsWith('97881') && // ISBNs
        !trimmed.startsWith('97893')    // ISBNs
      ) {
        cleanNumbers.push(trimmed);
      }
    });

    if (cleanNumbers.length > 0) {
      const slug = item.link.split('/portfolio/')[1].replace(/\/$/, '');
      phoneMap[slug] = Array.from(new Set(cleanNumbers));
    }

  } catch (e) {}
});

console.log('\n================ ALL PROFESSOR PHONE NUMBERS FOUND ================');
console.log(JSON.stringify(phoneMap, null, 2));

// Update faculty_directory.json with phone numbers
const jsonPath = path.join(__dirname, '..', 'src', 'data', 'faculty_directory.json');
let dataset = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

dataset = dataset.map(prof => {
  const phone = phoneMap[prof.id] ? phoneMap[prof.id][0] : null;
  return {
    ...prof,
    phone: phone || null
  };
});

fs.writeFileSync(jsonPath, JSON.stringify(dataset, null, 2));
console.log(`\nUpdated src/data/faculty_directory.json with phone numbers!`);
