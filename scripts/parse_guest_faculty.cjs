const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const htmlPath = path.join(__dirname, 'guest_faculty_raw.html');
const rawHtml = fs.readFileSync(htmlPath, 'utf-8');

// Find portfolio or faculty profile links in guest_faculty_raw.html
const linkRegex = /href="(https:\/\/sscbs\.du\.ac\.in\/(?:portfolio|guest-faculty)[^"]+)"[^>]*>([^<]+)</gi;

const guestLinks = [];
let match;
while ((match = linkRegex.exec(rawHtml)) !== null) {
  const href = match[1];
  const text = match[2].trim();
  if (text && text.length > 2 && !text.includes('Read More') && !guestLinks.some(l => l.link === href)) {
    guestLinks.push({ name: text, link: href });
  }
}

console.log(`Found ${guestLinks.length} guest faculty links:`);
console.log(JSON.stringify(guestLinks, null, 2));

// Parse each guest faculty link or extract from table/cards in guest_faculty_raw.html
const textOnly = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
                        .replace(/<style[\s\S]*?<\/style>/gi, '')
                        .replace(/<[^>]+>/g, '\n')
                        .replace(/[ \t]+/g, ' ')
                        .replace(/\n+/g, '\n');

fs.writeFileSync(path.join(__dirname, 'guest_text.txt'), textOnly);
console.log('Saved guest_text.txt!');
