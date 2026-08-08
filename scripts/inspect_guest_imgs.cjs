const fs = require('fs');
const path = require('path');

const rawHtml = fs.readFileSync(path.join(__dirname, 'guest_faculty_raw.html'), 'utf-8');

// Find all <img> tags inside table or list
const imgMatches = rawHtml.match(/<img[^>]+src="([^"]+)"[^>]*>/gi) || [];

console.log('Total img tags on guest faculty page:', imgMatches.length);
imgMatches.forEach(img => {
  console.log('-', img);
});
