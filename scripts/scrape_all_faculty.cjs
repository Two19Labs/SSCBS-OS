const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'raw_faculty.html'), 'utf-8');

// Regex for portfolio grid cards
const linkRegex = /<a[^>]*href="(https:\/\/sscbs\.du\.ac\.in\/portfolio\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

const facultyMap = new Map();

let match;
while ((match = linkRegex.exec(html)) !== null) {
  const link = match[1];
  const nameText = match[2].replace(/<[^>]+>/g, '').trim();
  
  if (nameText && !facultyMap.has(link)) {
    facultyMap.set(link, nameText);
  }
}

console.log(`Total unique faculty portfolio links found: ${facultyMap.size}`);

const facultyList = [];
facultyMap.forEach((name, link) => {
  facultyList.push({ name, link });
});

fs.writeFileSync(path.join(__dirname, 'all_faculty_links.json'), JSON.stringify(facultyList, null, 2));
console.log('Saved to all_faculty_links.json');
console.log('Sample faculty list:', facultyList.slice(0, 15));
