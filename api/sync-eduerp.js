import https from 'https';
import querystring from 'querystring';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { stu_email, stu_pass } = req.body || {};

  if (!stu_email || !stu_pass) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const postData = querystring.stringify({
    stu_email: stu_email.trim(),
    stu_pass: stu_pass.trim(),
    login: 'login'
  });

  try {
    const loginRes = await new Promise((resolve, reject) => {
      const request = https.request({
        hostname: 'pgtechnos.com',
        path: '/EduERP/verify.php',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve({ statusCode: response.statusCode, headers: response.headers, data }));
      });
      request.on('error', reject);
      request.write(postData);
      request.end();
    });

    // Check cookies / redirects
    const cookies = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'].map(c => c.split(';')[0]).join('; ') : '';

    // Fetch dashboard / attendance page
    const reportRes = await new Promise((resolve, reject) => {
      const request = https.request({
        hostname: 'pgtechnos.com',
        path: '/EduERP/index.php',
        method: 'GET',
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      });
      request.on('error', reject);
      request.end();
    });

    return res.status(200).json({
      success: true,
      htmlText: reportRes || loginRes.data,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("EduERP API Proxy error:", err);
    return res.status(500).json({ error: 'Failed to connect to EduERP portal' });
  }
}
