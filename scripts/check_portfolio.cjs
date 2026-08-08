const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const sampleUrl = 'https://sscbs.du.ac.in/portfolio/abhimanyu-verma-mba/';

try {
  const html = execSync(`curl -s -L "${sampleUrl}"`).toString('utf-8');
  fs.writeFileSync(path.join(__dirname, 'sample_portfolio.html'), html);
  console.log('Fetched portfolio HTML length:', html.length);
  
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                   .replace(/<style[\s\S]*?<\/style>/gi, '')
                   .replace(/<[^>]+>/g, '\n')
                   .replace(/[ \t]+/g, ' ')
                   .replace(/\n+/g, '\n');

  fs.writeFileSync(path.join(__dirname, 'sample_portfolio_text.txt'), text);
  console.log('Wrote text extract successfully.');
} catch (e) {
  console.error('Error fetching sample portfolio:', e.message);
}
