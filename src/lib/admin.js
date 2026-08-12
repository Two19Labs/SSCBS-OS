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
  'lorena.25131@sscbs.du.ac.in',
];

export function canAccessTeamFinder(email) {
  if (!email || typeof email !== 'string') return false;
  return true; // Team Finder & Competition Hub is live for all SSCBS students!
}

export const EMPTY_ROOM_TESTERS = [
  'aditya.25015@sscbs.du.ac.in',
  'lorena.25131@sscbs.du.ac.in',
];

export function canAccessEmptyRoom(email) {
  if (!email || typeof email !== 'string') return false;
  return true; // Empty Room Finder is now live for all SSCBS students!
}

export const FACULTY_DB_TESTERS = [
  'aditya.25015@sscbs.du.ac.in',
];

export function canAccessFacultyDatabase(email) {
  if (!email || typeof email !== 'string') return false;
  return true; // Faculty Directory is live for all SSCBS users!
}

export function canAccessSocietyTracker(email) {
  if (!email || typeof email !== 'string') return false;
  return true; // Society Recruitment Tracker is live for all SSCBS students!
}

const TIMEWARP_KEY = 'sscbs-timewarp-enabled';


export function isTimeWarpEnabled() {
  return localStorage.getItem(TIMEWARP_KEY) === 'true';
}

export function setTimeWarpEnabled(enabled) {
  localStorage.setItem(TIMEWARP_KEY, enabled ? 'true' : 'false');
}


