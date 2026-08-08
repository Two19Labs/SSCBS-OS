const { execSync } = require('child_process');
const fs = require('fs');

const url = 'https://sscbs.du.ac.in/portfolio/dr-rishi-rajan-sahay-ph-d/';
console.log(`Fetching ${url}...`);

const html = execSync(`curl -s -L "${url}"`).toString('utf-8');
fs.writeFileSync('C:\\Users\\adity\\.gemini\\antigravity\\brain\\c8f437fd-2e73-4e60-8de3-67a6e0d03c72\\scratch\\rishi.html', html);

const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                 .replace(/<style[\s\S]*?<\/style>/gi, '')
                 .replace(/<[^>]+>/g, '\n')
                 .replace(/[ \t]+/g, ' ')
                 .replace(/\n+/g, '\n');

fs.writeFileSync('C:\\Users\\adity\\.gemini\\antigravity\\brain\\c8f437fd-2e73-4e60-8de3-67a6e0d03c72\\scratch\\rishi_text.txt', text);

const idx = text.indexOf('Rishi Rajan Sahay');
if (idx !== -1) {
  console.log('Snippet around Rishi Rajan Sahay:\n', text.substring(idx - 100, idx + 1000));
} else {
  console.log('Name not found in text');
}
