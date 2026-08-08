const fs = require('fs');
const path = require('path');

const rawHtml = fs.readFileSync(path.join(__dirname, 'raw_faculty.html'), 'utf-8');
const jsonPath = path.join(__dirname, '..', 'src', 'data', 'faculty_directory.json');
let dataset = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Extract all img tags from raw_faculty.html
const imgRegex = /<img[^>]*src="([^"]+\/uploads\/[0-9]{4}\/[0-9]{2}\/[^"]+)"[^>]*title="([^"]*)"/gi;

const photoMap = new Map();
let m;
while ((m = imgRegex.exec(rawHtml)) !== null) {
  const src = m[1];
  const title = m[2];
  if (src && !src.toLowerCase().includes('logo') && !src.toLowerCase().includes('cropped')) {
    photoMap.set(title.toLowerCase().trim(), src);
  }
}

// Fallback search by surname or first name match
dataset = dataset.map(prof => {
  let photo = null;
  const nameLower = prof.name.toLowerCase().trim();

  // Try direct match by title
  photoMap.forEach((src, title) => {
    if (!photo && (title.includes(nameLower) || nameLower.includes(title.replace(/dr\.|prof\.|mr\.|ms\./g, '').trim()))) {
      photo = src;
    }
  });

  // If still null, search rawHtml for portfolio slug or photo filename
  if (!photo || photo.includes('Logo.png')) {
    const slug = prof.id;
    const match = rawHtml.match(new RegExp(`src="([^"]+\\/uploads\\/[^"]+)"[^\n]*?${prof.name.split(' ')[0]}`, 'i')) ||
                  rawHtml.match(new RegExp(`src="([^"]+\\/uploads\\/[^"]+)"[^\n]*?${slug.split('-')[0]}`, 'i'));
    if (match && !match[1].includes('Logo.png')) {
      photo = match[1];
    }
  }

  // Ensure high quality full photo instead of small thumb if possible
  if (photo) {
    photo = photo.replace('-500x500', '-scaled').replace('-389x389', '');
  }

  return {
    ...prof,
    photoUrl: photo || null
  };
});

fs.writeFileSync(jsonPath, JSON.stringify(dataset, null, 2));
console.log('Fixed photo URLs for all faculty entries!');
