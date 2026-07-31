export const ADMIN_EMAILS = [
  'aditya.25015@sscbs.du.ac.in',
  'manthan.25138@sscbs.du.ac.in',
];

export function isAdminEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.toLowerCase().trim();
  return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === normalized);
}

export const TEAM_FINDER_TESTERS = [
  ...ADMIN_EMAILS,
  'somya.25221@sscbs.du.ac.in',
];

export function canAccessTeamFinder(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.toLowerCase().trim();
  return TEAM_FINDER_TESTERS.some((testerEmail) => testerEmail.toLowerCase() === normalized);
}

const TIMEWARP_KEY = 'sscbs-timewarp-enabled';

export function isTimeWarpEnabled() {
  return localStorage.getItem(TIMEWARP_KEY) === 'true';
}

export function setTimeWarpEnabled(enabled) {
  localStorage.setItem(TIMEWARP_KEY, enabled ? 'true' : 'false');
}
