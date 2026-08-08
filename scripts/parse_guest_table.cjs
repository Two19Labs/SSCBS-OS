const fs = require('fs');
const path = require('path');

const rawHtml = fs.readFileSync(path.join(__dirname, 'guest_faculty_raw.html'), 'utf-8');

// Search for table rows <tr> or cards <div> in rawHtml
const text = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
                    .replace(/<style[\s\S]*?<\/style>/gi, '')
                    .replace(/<[^>]+>/g, '\n')
                    .replace(/[ \t]+/g, ' ')
                    .replace(/\n+/g, '\n');

// Find where main content is
const mainIdx = text.indexOf('Guest Faculties') !== -1 ? text.indexOf('Guest Faculties') : text.indexOf('Guest');
const snippet = text.substring(mainIdx, mainIdx + 8000);

fs.writeFileSync(path.join(__dirname, 'guest_snippet.txt'), snippet);
console.log('Snippet saved to guest_snippet.txt!');
