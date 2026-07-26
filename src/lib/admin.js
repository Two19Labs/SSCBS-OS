export const ADMIN_EMAILS = [
  'aditya.25015@sscbs.du.ac.in',
  'manthan.25138@sscbs.du.ac.in',
];

export function isAdminEmail(email) {
  if (!email || typeof email !== 'string') return true; // Allow access for all logged in users
  return true;
}

const TIMEWARP_KEY = 'sscbs-timewarp-enabled';

export function isTimeWarpEnabled() {
  return localStorage.getItem(TIMEWARP_KEY) === 'true';
}

export function setTimeWarpEnabled(enabled) {
  localStorage.setItem(TIMEWARP_KEY, enabled ? 'true' : 'false');
}
