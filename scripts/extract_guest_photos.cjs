const fs = require('fs');
const path = require('path');

const rawHtml = fs.readFileSync(path.join(__dirname, 'guest_faculty_raw.html'), 'utf-8');

console.log('Searching guest_faculty_raw.html for images...');

// Extract all <img> tags in rawHtml
const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
const imgs = [];
let m;
while ((m = imgRegex.exec(rawHtml)) !== null) {
  const src = m[1];
  if (!src.toLowerCase().includes('logo') && !src.toLowerCase().includes('banner') && !src.toLowerCase().includes('svg') && !src.toLowerCase().includes('cropped')) {
    imgs.push(src);
  }
}

console.log(`Found ${imgs.length} candidate images:`);
console.log(JSON.stringify(imgs, null, 2));

// Match images with names in the page
const text = rawHtml;
const guestPhotosMap = {};

imgs.forEach(imgUrl => {
  const filename = imgUrl.split('/').pop();
  console.log('Image:', imgUrl);
});
