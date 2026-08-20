/**
 * EduERP Hands-Free Auto-Sync Engine for SSCBS OS
 * Automatically authenticates with pgtechnos.com/EduERP/ via API proxy and fetches live attendance reports.
 */

export const syncEduErpAttendance = async (stu_email, stu_pass) => {
  if (!stu_email || !stu_pass) {
    throw new Error("EduERP credentials required for auto-sync.");
  }

  // 1. Attempt Serverless Proxy API (/api/sync-eduerp)
  try {
    const proxyRes = await fetch('/api/sync-eduerp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ stu_email: stu_email.trim(), stu_pass: stu_pass.trim() })
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data && data.htmlText) {
        return data;
      }
    }
  } catch (e) {
    console.warn("Serverless EduERP proxy notice:", e);
  }

  // 2. Direct fetch fallback
  const loginUrl = 'https://pgtechnos.com/EduERP/verify.php';
  const postBody = new URLSearchParams({
    stu_email: stu_email.trim(),
    stu_pass: stu_pass.trim(),
    login: 'login'
  });

  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: postBody.toString(),
    credentials: 'include'
  });

  const htmlText = await response.text();
  return {
    success: true,
    htmlText,
    timestamp: new Date().toISOString()
  };
};
