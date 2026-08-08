const fs = require('fs');
const path = require('path');

const rawHtml = fs.readFileSync(path.join(__dirname, 'guest_faculty_raw.html'), 'utf-8');

console.log('HTML size:', rawHtml.length);

// Extract tables, cards, portfolio links, images
const imgMatches = rawHtml.match(/<img[^>]+>/g) || [];
console.log('Images found:', imgMatches.length);

// Extract portfolio links
const portfolioLinks = [];
const linkRegex = /href="([^"]*portfolio[^"]*)"[^>]*>([^<]*)</gi;
let m;
while ((m = linkRegex.exec(rawHtml)) !== null) {
  portfolioLinks.push({ link: m[1], text: m[2].trim() });
}

console.log('Portfolio links:', JSON.stringify(portfolioLinks, null, 2));

// Clean text to see structure
const text = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[\s\S]*?<\/style>/gi, '')
                    .replace(/<[^>]+>/g, '\n')
                    .replace(/[ \t]+/g, ' ')
                    .replace(/\n+/g, '\n');

fs.writeFileSync(path.join(__dirname, 'clean_guest_text.txt'), text);
console.log('Saved clean_guest_text.txt! Lines count:', text.split('\n').length);
