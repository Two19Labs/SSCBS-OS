const { execSync } = require('child_process');

const testUrls = [
  'https://sscbs.du.ac.in/portfolio/abhimanyu-verma-mba/',
  'https://sscbs.du.ac.in/portfolio/dr-ajay-jaiswal-ph-d/',
  'https://sscbs.du.ac.in/portfolio/dr-amrina-kausar-ph-d/',
  'https://sscbs.du.ac.in/portfolio/dr-anamika-gupta-ph-d/',
  'https://sscbs.du.ac.in/portfolio/dr-anuja-mathur-ph-d/',
  'https://sscbs.du.ac.in/portfolio/poonam-verma/'
];

testUrls.forEach(url => {
  console.log(`\n================ INSPECTING: ${url} ================`);
  const html = execSync(`curl -s -L "${url}"`).toString('utf-8');

  // Find images (excluding logo)
  const imgMatches = html.match(/<img[^>]*src="([^"]+\/uploads\/[0-9]{4}\/[0-9]{2}\/[^"]+)"/gi) || [];
  const profImg = imgMatches.map(m => {
    const src = m.match(/src="([^"]+)"/i);
    return src ? src[1] : '';
  }).filter(src => src && !src.toLowerCase().includes('logo') && !src.toLowerCase().includes('cropped') && !src.toLowerCase().includes('pvc'));
  console.log('Real Photo:', profImg[0] || 'NONE');

  // Find real emails (excluding cbs@sscbsdu.ac.in)
  const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const cleanEmails = Array.from(new Set(emails)).filter(e => e.toLowerCase() !== 'cbs@sscbsdu.ac.in' && !e.includes('example'));
  console.log('Real Emails:', cleanEmails);

  // Find designation in text
  // Let's search for "Assistant Professor", "Associate Professor", "Professor", "Professor-Principal"
  let desig = 'Faculty Member';
  if (/Professor\s*-\s*Principal/i.test(html) || /Professor\s*&\s*Principal/i.test(html) || /Professor-Principal/i.test(html)) {
    desig = 'Professor & Principal';
  } else if (/Associate\s+Professor/i.test(html)) {
    desig = 'Associate Professor';
  } else if (/Assistant\s+Professor/i.test(html)) {
    desig = 'Assistant Professor';
  } else if (/Professor/i.test(html)) {
    desig = 'Professor';
  }
  console.log('Detected Designation:', desig);

  // Find room
  const roomMatch = html.match(/(Room\s*No\.?\s*[0-9A-Z\s,-]+(?:Aral Sea|South China Sea|Yellow Sea|Baltic Sea|Bering Sea|Caribbean Sea|Mediterranean Sea|Adriatic Sea|Sea of Galilee|Sea of Cortez)?)/i) ||
                    html.match(/(Room\s*[0-9A-Z\s-]+)/i);
  console.log('Room Match:', roomMatch ? roomMatch[1].replace(/\s+/g, ' ').trim() : 'NONE');
});
