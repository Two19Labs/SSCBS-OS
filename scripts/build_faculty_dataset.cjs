const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const linksFile = path.join(__dirname, 'all_faculty_links.json');
const facultyLinks = JSON.parse(fs.readFileSync(linksFile, 'utf-8'));

console.log(`Starting refined extraction for ${facultyLinks.length} faculty entries...`);

const dataset = [];

facultyLinks.forEach((item, idx) => {
  if (item.link.includes('/sadhana/')) return; // skip non-faculty entries if any

  try {
    const html = execSync(`curl -s -L "${item.link}"`).toString('utf-8');

    // Extract photo from portfolio image element or post image
    const imgMatch = html.match(/<img[^>]*src="([^"]+\/uploads\/[0-9]{4}\/[0-9]{2}\/[^"]+)"/i);
    const photoUrl = imgMatch ? imgMatch[1] : null;

    // Isolate main page body to exclude header/footer menus
    let mainHtml = html;
    const bodyStart = html.indexOf('kingster-page-wrapper') || html.indexOf('gdlr-core-page-builder-body');
    const footerStart = html.indexOf('kingster-footer-wrapper') || html.indexOf('gdlr-core-footer');
    if (bodyStart !== -1 && footerStart !== -1 && footerStart > bodyStart) {
      mainHtml = html.substring(bodyStart, footerStart);
    }

    // Clean text conversion for main content
    const text = mainHtml.replace(/<script[\s\S]*?<\/script>/gi, '')
                         .replace(/<style[\s\S]*?<\/style>/gi, '')
                         .replace(/<[^>]+>/g, '\n')
                         .replace(/[ \t]+/g, ' ')
                         .replace(/\n+/g, '\n');

    // Extract Email (prefer @sscbsdu.ac.in)
    const emailMatch = mainHtml.match(/([a-zA-Z0-9._%+-]+@sscbsdu\.ac\.in)/i) || 
                       mainHtml.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    let email = emailMatch ? emailMatch[1] : null;
    if (email === 'cbs@sscbsdu.ac.in' || !email) {
      // search for specific faculty emails if formatted as email[at]domain
      const altMatch = mainHtml.match(/([a-zA-Z0-9._%+-]+)\s*\[at\]\s*([a-zA-Z0-9.-]+)/i);
      if (altMatch) email = `${altMatch[1]}@${altMatch[2]}`;
      else email = 'Contact Department';
    }

    // Extract Room Number
    const roomMatch = mainHtml.match(/(Room\s*No\.?\s*[0-9A-Z\s,-]+(?:Aral Sea|South China Sea|Yellow Sea|Baltic Sea|Bering Sea|Caribbean Sea|Mediterranean Sea)?)/i) ||
                      mainHtml.match(/(Room\s*[0-9A-Z\s-]+)/i);
    const room = roomMatch ? roomMatch[1].replace(/\s+/g, ' ').trim() : 'Room details upon request';

    // Extract Designation
    let designation = 'Faculty Member';
    if (mainHtml.includes('Professor-Principal') || mainHtml.includes('Principal')) {
      designation = 'Professor & Principal';
    } else if (mainHtml.includes('Associate Professor')) {
      designation = 'Associate Professor';
    } else if (mainHtml.includes('Assistant Professor')) {
      designation = 'Assistant Professor';
    } else if (mainHtml.includes('Professor')) {
      designation = 'Professor';
    }

    // Extract Areas of Expertise
    let expertise = [];
    const expIdx = text.indexOf('Areas of Expertise');
    if (expIdx !== -1) {
      const expSnippet = text.substring(expIdx + 18, expIdx + 250);
      const stopWords = ['Detailed Resume', 'Biography', 'Education', 'Publications', 'Learn More', 'About Us'];
      let stopIdx = expSnippet.length;
      stopWords.forEach(sw => {
        const swPos = expSnippet.indexOf(sw);
        if (swPos !== -1 && swPos < stopIdx) stopIdx = swPos;
      });
      const rawExp = expSnippet.substring(0, stopIdx).replace(/\n/g, ', ');
      expertise = rawExp.split(/[,;\n]+/).map(s => s.trim()).filter(s => s.length > 2 && !s.includes('@') && !s.includes('http'));
    }

    // Extract Biography
    let biography = '';
    const bioIdx = text.indexOf('Biography');
    if (bioIdx !== -1) {
      const bioSnippet = text.substring(bioIdx + 9, bioIdx + 1000);
      const stopWords = ['Education', 'Publications', 'Learn More', 'Shaheed Sukhdev', 'Copyright'];
      let stopIdx = bioSnippet.length;
      stopWords.forEach(sw => {
        const swPos = bioSnippet.indexOf(sw);
        if (swPos !== -1 && swPos < stopIdx) stopIdx = swPos;
      });
      biography = bioSnippet.substring(0, stopIdx).replace(/\n+/g, ' ').trim();
    }

    // Extract Education
    let education = [];
    const eduIdx = text.indexOf('Education');
    if (eduIdx !== -1) {
      const eduSnippet = text.substring(eduIdx + 9, eduIdx + 800);
      const stopWords = ['Publications', 'Learn More', 'Shaheed Sukhdev', 'Copyright'];
      let stopIdx = eduSnippet.length;
      stopWords.forEach(sw => {
        const swPos = eduSnippet.indexOf(sw);
        if (swPos !== -1 && swPos < stopIdx) stopIdx = swPos;
      });
      const eduLines = eduSnippet.substring(0, stopIdx)
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 5 && !s.includes('Shaheed') && !s.includes('Copyright') && !s.includes('Navig'));
      education = eduLines;
    }

    // Extract Publications
    let publications = [];
    const pubIdx = text.indexOf('Publications');
    if (pubIdx !== -1) {
      const pubSnippet = text.substring(pubIdx + 12, pubIdx + 1200);
      const stopWords = ['Learn More', 'Shaheed Sukhdev', 'Copyright'];
      let stopIdx = pubSnippet.length;
      stopWords.forEach(sw => {
        const swPos = pubSnippet.indexOf(sw);
        if (swPos !== -1 && swPos < stopIdx) stopIdx = swPos;
      });
      const pubLines = pubSnippet.substring(0, stopIdx)
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 12 && !s.includes('Shaheed') && !s.includes('Copyright') && !s.includes('Admissions') && !s.includes('Portal'));
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
    console.error(`Error processing ${item.name}:`, e.message);
  }
});

const outPath = path.join(__dirname, '..', 'src', 'data', 'faculty_directory.json');
fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));
console.log(`\nSuccessfully built cleaned faculty database with ${dataset.length} profiles!`);
console.log(`Saved to ${outPath}`);
