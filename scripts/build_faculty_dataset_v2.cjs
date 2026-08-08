const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const linksFile = path.join(__dirname, 'all_faculty_links.json');
const facultyLinks = JSON.parse(fs.readFileSync(linksFile, 'utf-8'));

console.log(`Starting comprehensive clean extraction for ${facultyLinks.length} faculty entries...`);

// Load raw_faculty.html to map main thumbnail images if available
let rawHtml = '';
try {
  rawHtml = fs.readFileSync(path.join(__dirname, 'raw_faculty.html'), 'utf-8');
} catch (e) {}

const dataset = [];

facultyLinks.forEach((item, idx) => {
  if (item.link.includes('/sadhana/')) return; // skip non-faculty entries

  console.log(`[${idx + 1}/${facultyLinks.length}] Scraping ${item.name}...`);

  try {
    const html = execSync(`curl -s -L "${item.link}"`).toString('utf-8');

    // 1. Photo Extraction
    // First check main portfolio html for 700x660 or 500x500 upload images excluding logos and headers
    let photoUrl = null;
    const imgMatches = html.match(/<img[^>]*src="([^"]+\/uploads\/[0-9]{4}\/[0-9]{2}\/[^"]+)"/gi) || [];
    const validPhotos = imgMatches.map(m => {
      const srcMatch = m.match(/src="([^"]+)"/i);
      return srcMatch ? srcMatch[1] : '';
    }).filter(src => {
      if (!src) return false;
      const lower = src.toLowerCase();
      return !lower.includes('logo') && !lower.includes('cropped') && !lower.includes('pvc') && !lower.includes('banner');
    });

    if (validPhotos.length > 0) {
      photoUrl = validPhotos[0];
    } else {
      // Fallback search in rawHtml for thumbnail
      const slug = item.link.split('/portfolio/')[1].replace(/\/$/, '');
      const rawImgMatch = rawHtml.match(new RegExp(`src="([^"]+\\/uploads\\/[^"]+)"[^>]*alt="[^"]*${slug.split('-')[0]}`, 'i'));
      if (rawImgMatch) photoUrl = rawImgMatch[1];
    }

    // 2. Email Extraction
    const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
    const cleanEmails = Array.from(new Set(emails)).filter(e => {
      const lower = e.toLowerCase();
      return lower !== 'cbs@sscbsdu.ac.in' && !lower.includes('example') && !lower.includes('sentry') && !lower.includes('wordpress');
    });
    
    let email = cleanEmails.length > 0 ? cleanEmails[0] : null;
    if (!email) {
      // Try alt pattern email[at]sscbsdu.ac.in
      const altMatch = html.match(/([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+)/i);
      if (altMatch) email = `${altMatch[1]}@${altMatch[2]}`;
      else email = 'cbs@sscbsdu.ac.in'; // standard backup if unlisted
    }

    // 3. Designation Extraction (Strict order)
    let designation = 'Faculty Member';
    if (/Professor\s*-\s*Principal/i.test(html) || /Professor\s*&\s*Principal/i.test(html) || (item.name.includes('Poonam Verma') && /Principal/i.test(html))) {
      designation = 'Professor & Principal';
    } else if (/Associate\s+Professor/i.test(html)) {
      designation = 'Associate Professor';
    } else if (/Assistant\s+Professor/i.test(html)) {
      designation = 'Assistant Professor';
    } else if (/Professor/i.test(html)) {
      designation = 'Professor';
    }

    // 4. Room Number Extraction
    const roomMatch = html.match(/(Room\s*No\.?\s*[0-9A-Z\s,-]+(?:Aral Sea|South China Sea|Yellow Sea|Baltic Sea|Bering Sea|Caribbean Sea|Mediterranean Sea|Adriatic Sea|Sea of Galilee|Sea of Cortez)?)/i) ||
                      html.match(/(Room\s*[0-9A-Z\s-]+)/i);
    const room = roomMatch ? roomMatch[1].replace(/\s+/g, ' ').trim() : 'Room details upon request';

    // Clean text conversion for content extraction
    const mainText = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                         .replace(/<style[\s\S]*?<\/style>/gi, '')
                         .replace(/<[^>]+>/g, '\n')
                         .replace(/[ \t]+/g, ' ')
                         .replace(/\n+/g, '\n');

    // 5. Expertise Extraction
    let expertise = [];
    const expIdx = mainText.indexOf('Areas of Expertise');
    if (expIdx !== -1) {
      const expSnippet = mainText.substring(expIdx + 18, expIdx + 250);
      const stopWords = ['Detailed Resume', 'Biography', 'Education', 'Publications', 'Learn More', 'About Us', 'Grade'];
      let stopIdx = expSnippet.length;
      stopWords.forEach(sw => {
        const swPos = expSnippet.indexOf(sw);
        if (swPos !== -1 && swPos < stopIdx) stopIdx = swPos;
      });
      const rawExp = expSnippet.substring(0, stopIdx).replace(/\n/g, ', ');
      expertise = rawExp.split(/[,;\n]+/).map(s => s.trim()).filter(s => s.length > 2 && !s.includes('@') && !s.includes('http') && !s.includes('Shaheed'));
    }

    // 6. Biography Extraction
    let biography = '';
    const bioIdx = mainText.indexOf('Biography');
    if (bioIdx !== -1) {
      const bioSnippet = mainText.substring(bioIdx + 9, bioIdx + 900);
      const stopWords = ['Education', 'Publications', 'Learn More', 'Shaheed Sukhdev', 'Copyright', 'Grade'];
      let stopIdx = bioSnippet.length;
      stopWords.forEach(sw => {
        const swPos = bioSnippet.indexOf(sw);
        if (swPos !== -1 && swPos < stopIdx) stopIdx = swPos;
      });
      biography = bioSnippet.substring(0, stopIdx).replace(/\n+/g, ' ').trim();
    }

    // 7. Education Extraction
    let education = [];
    const eduIdx = mainText.indexOf('Education');
    if (eduIdx !== -1) {
      const eduSnippet = mainText.substring(eduIdx + 9, eduIdx + 700);
      const stopWords = ['Publications', 'Learn More', 'Shaheed Sukhdev', 'Copyright', 'Grade'];
      let stopIdx = eduSnippet.length;
      stopWords.forEach(sw => {
        const swPos = eduSnippet.indexOf(sw);
        if (swPos !== -1 && swPos < stopIdx) stopIdx = swPos;
      });
      const eduLines = eduSnippet.substring(0, stopIdx)
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 5 && !s.includes('Shaheed') && !s.includes('Copyright') && !s.includes('Grade') && !s.includes('Accredited'));
      education = eduLines;
    }

    // 8. Publications Extraction
    let publications = [];
    const pubIdx = mainText.indexOf('Publications');
    if (pubIdx !== -1) {
      const pubSnippet = mainText.substring(pubIdx + 12, pubIdx + 1000);
      const stopWords = ['Learn More', 'Shaheed Sukhdev', 'Copyright', 'Grade'];
      let stopIdx = pubSnippet.length;
      stopWords.forEach(sw => {
        const swPos = pubSnippet.indexOf(sw);
        if (swPos !== -1 && swPos < stopIdx) stopIdx = swPos;
      });
      const pubLines = pubSnippet.substring(0, stopIdx)
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 12 && !s.includes('Shaheed') && !s.includes('Copyright') && !s.includes('Grade') && !s.includes('Portal'));
      publications = pubLines;
    }

    // Standardize Name & Degrees
    const nameParts = item.name.split(',');
    const fullName = nameParts[0].trim();
    const qualification = nameParts.slice(1).join(',').trim();

    dataset.push({
      id: item.link.split('/portfolio/')[1].replace(/\/$/, ''),
      name: fullName,
      qualification: qualification || '',
      designation,
      room,
      email,
      expertise: Array.from(new Set(expertise)),
      photoUrl,
      profileUrl: item.link,
      biography: biography || `${fullName} is a distinguished faculty member at Shaheed Sukhdev College of Business Studies, University of Delhi.`,
      education: education.slice(0, 5),
      publications: publications.slice(0, 5)
    });

  } catch (e) {
    console.error(`Error scraping ${item.name}:`, e.message);
  }
});

const outPath = path.join(__dirname, '..', 'src', 'data', 'faculty_directory.json');
fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));
console.log(`\nSuccessfully built clean faculty dataset with ${dataset.length} profiles!`);
console.log(`Saved to ${outPath}`);
