/**
 * EduERP Hands-Free Auto-Sync Engine for SSCBS OS
 * Automatically authenticates with pgtechnos.com/EduERP/ and fetches live attendance reports.
 */

export const syncEduErpAttendance = async (stu_email, stu_pass) => {
  if (!stu_email || !stu_pass) {
    throw new Error("EduERP credentials required for auto-sync.");
  }

  const loginUrl = 'https://pgtechnos.com/EduERP/verify.php';
  const postBody = new URLSearchParams({
    stu_email: stu_email.trim(),
    stu_pass: stu_pass.trim(),
    login: 'login'
  });

  try {
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
  } catch (err) {
    console.warn("Direct CORS EduERP sync notice:", err);
    throw err;
  }
};
