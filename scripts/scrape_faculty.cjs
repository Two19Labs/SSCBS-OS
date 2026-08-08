const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const url = 'https://sscbs.du.ac.in/faculty/';

function get(targetUrl, cb) {
  const client = targetUrl.startsWith('https') ? https : http;
  client.get(targetUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return get(res.headers.location, cb);
    }
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => cb(null, data));
  }).on('error', cb);
}

get(url, (err, html) => {
  if (err) {
    console.error('Error fetching URL:', err);
    return;
  }
  
  console.log('Successfully fetched page. Byte size:', html.length);
  fs.writeFileSync(path.join(__dirname, 'raw_faculty.html'), html);

  // Extract content
  // Look for tables or personnel lists
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  const tables = html.match(tableRegex) || [];
  console.log('Number of tables found:', tables.length);

  const parsedData = [];

  tables.forEach((table, tableIndex) => {
    const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
    const rows = table.match(rowRegex) || [];
    console.log(`Table ${tableIndex + 1} has ${rows.length} rows`);

    rows.forEach(tr => {
      const cellRegex = /<t[dh][\s\S]*?<\/t[dh]>/gi;
      const cells = (tr.match(cellRegex) || []).map(cell => {
        const imgMatch = cell.match(/src="([^"]+)"/);
        const linkMatch = cell.match(/href="([^"]+)"/);
        const text = cell.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return {
          text,
          img: imgMatch ? imgMatch[1] : null,
          link: linkMatch ? linkMatch[1] : null
        };
      });

      if (cells.length > 0) {
        parsedData.push({ tableIndex: tableIndex + 1, cells });
      }
    });
  });

  fs.writeFileSync(path.join(__dirname, 'faculty_parsed.json'), JSON.stringify(parsedData, null, 2));
  console.log('Saved parsed data to faculty_parsed.json. Total rows parsed:', parsedData.length);
  if (parsedData.length > 0) {
    console.log('Sample row:', JSON.stringify(parsedData[0], null, 2));
  }
});
