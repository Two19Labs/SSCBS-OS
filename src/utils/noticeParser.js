// SSCBS OS — Smart Notice & WhatsApp Text Parser
// Automatically extracts Title, Society, Venue, Event Date & Time, Links, Category & Clean Content from raw announcements.

import { DEMO_SOCIETIES } from '../data/societies';

// Canonical list of society names & short aliases
const BUILTIN_SOCIETIES = [
  'Kronos', 'ACM', '180DC', 'Mark-It', 'FinX', 'Synergy', 'Yuva',
  'Communique', 'CDC', 'Placement Cell', 'E-Cell', 'Enactus', 'TIIF',
  'Grandeur', 'Vittshala', 'NAPS', 'NSS', 'Rotaract', 'Nucleus',
  'FIC', 'IFSA', 'Ecosphere', 'Girl Up', 'Mihira', 'Dark Room',
  'Alacrity', 'Inact', 'Verve', 'Dhwani', 'Fourth Wall', 'Blitz',
  'Parishram', 'Career Development Centre', 'Placement Cell'
];

/**
 * Remove markdown asterisks, bullets, extra whitespace, emojis from ends
 */
function cleanLine(line) {
  if (!line) return '';
  return line
    .replace(/^[\s*•\-–—►▪️🔹🔸▶️*#_~]+/, '')
    .replace(/[\s*#_~]+$/, '')
    .trim();
}

/**
 * Strip emoji characters, variation selectors, zero-width joiners from a string
 */
function stripEmojis(str) {
  if (!str) return '';
  return str
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/[\uFE00-\uFE0F\u200B-\u200D\u2060\u00A0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Remove markdown asterisks, underscores from text
 */
function cleanMarkdown(str) {
  if (!str) return '';
  return str.replace(/\*+([^*]+)\*+/g, '$1').replace(/_+([^_]+)_+/g, '$1').trim();
}

/**
 * Check if a line is a redundant header, society intro, or presentation line
 */
function isHeaderOrPresentation(line, meta = {}) {
  const l = line.toLowerCase().trim();
  if (l.includes('shaheed sukhdev') || l.includes('university of delhi') || l.includes('office of the principal')) {
    return true;
  }
  if (meta.title && (l === meta.title.toLowerCase() || l.includes(meta.title.toLowerCase()))) {
    return true;
  }
  if (meta.society && (l === meta.society.toLowerCase() || l.startsWith(`${meta.society.toLowerCase()} -`))) {
    return true;
  }
  if (/^(?:presents|in collaboration with|proudly announces|invites you to|announces|presents its)\s*$/i.test(l)) {
    return true;
  }
  if (/the (?:tech|cultural|corporate|debating|dance|music|drama|finance|marketing|literary|consulting|social) society of/i.test(l)) {
    return true;
  }
  if (/^(?:career development centre|placement cell|rotaract club|national service scheme)\s*(?:\([a-z]+\))?$/i.test(l)) {
    return true;
  }
  if (/^(?:notice|announcement|circular)\s*[:\-–—]?$/i.test(l)) {
    return true;
  }
  return false;
}

/**
 * Generates an apt, concise 3-4 line description from a raw message,
 * stripping out redundant date, venue, links, and contact lines.
 */
export function generateAptDescription(rawText, meta = {}) {
  if (!rawText) return '';

  const rawLines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const isDateLine = /^(?:date|day|when)\s*[:\-–—]/i;
  const isTimeLine = /^(?:time|timing)\s*[:\-–—]/i;
  const isVenueLine = /^(?:venue|location|place|where|held at|platform|room)\s*[:\-–—]/i;
  const isLinkLine = /^(?:register|registration|form|link|apply|rsvp|portal)\s*[:\-–—]|https?:\/\//i;
  const isGreetingLine = /^(?:greetings|hello|hey|dear\s+all|hope\s+you\s+are|good\s+(?:morning|afternoon|evening))\b/i;
  const isSignoffLine = /^(?:warm\s+regards|regards|team\s+[a-z0-9\s&-]+|best\s+wishes|sincerely|thanks\s+and\s+regards|see\s+you\s+there|see\s+you\s+in|cheers|yours\s+truly)\b/i;
  const isPocLine = /(?:for\s+queries|for\s+any\s+queries|contact\s*[:\-–—]|reach\s+out\s*[:\-–—]|poc\s*[:\-–—]|convenor|president|coordinator|\+?91[\s-]?\d{10}|\b\d{10}\b)/i;
  const isDividerLine = /^[\s*~_\-═━▪️🔹🔸•=•·✦✧]+$/;

  const candidateLines = [];
  const bulletLines = [];
  let speakerLine = '';
  let noteLine = '';
  let deadlineLine = '';

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const stripped = stripEmojis(rawLine);
    const cleaned = cleanMarkdown(stripped);

    if (!cleaned || isDividerLine.test(cleaned)) continue;

    // Check Speaker
    if (/^(?:speaker|guest\s+speaker|mentor|session\s+by)\s*[:\-–—]/i.test(cleaned)) {
      speakerLine = cleaned;
      continue;
    }

    // Check Note / Guidelines
    if (/^(?:note|guidelines|mandatory|important)\s*[:\-–—]/i.test(cleaned)) {
      noteLine = cleaned;
      continue;
    }

    // Check Deadline
    if (/^(?:deadline|last\s+date|reporting\s+discrepancies)\s*[:\-–—]/i.test(cleaned)) {
      deadlineLine = cleaned;
      continue;
    }

    // Skip redundant metadata lines
    if (
      isDateLine.test(cleaned) ||
      isTimeLine.test(cleaned) ||
      isVenueLine.test(cleaned) ||
      isLinkLine.test(cleaned) ||
      isGreetingLine.test(cleaned) ||
      isSignoffLine.test(cleaned) ||
      isPocLine.test(cleaned)
    ) {
      continue;
    }

    // Skip headers and presentation lines
    if (isHeaderOrPresentation(cleaned, meta)) {
      continue;
    }

    // Check if it's a bullet item / perk
    if (/^[-•*▪️🔹🔸]\s+/.test(rawLine)) {
      bulletLines.push(cleaned.replace(/^[-•*▪️🔹🔸]\s+/, '').trim());
      continue;
    }

    // Check bullet section header like "Perks:" or "What's in it for you:"
    if (/^(?:perks|benefits|highlights|eligibility|agenda)\s*[:\-–—]?$/i.test(cleaned)) {
      continue;
    }

    // Skip "NOTICE: ..." line if title already captures it
    if (/^notice\s*[:\-–—]/i.test(cleaned)) {
      const remainingNotice = cleaned.replace(/^notice\s*[:\-–—]\s*/i, '').trim();
      if (!remainingNotice || (meta.title && remainingNotice.toLowerCase().includes(meta.title.toLowerCase()))) {
        continue;
      }
    }

    // Clean trailing colons on general lines
    const lineFormatted = cleaned.replace(/[:\-–—]+$/, '.');
    candidateLines.push(lineFormatted);
  }

  // Compose description
  const resultParts = [];

  // 1. Speaker Info (if any)
  if (speakerLine) {
    resultParts.push(speakerLine);
  }

  // 2. Main Hook/Body: take candidate lines
  if (candidateLines.length > 0) {
    if (/^(?:is back with|invites you to|announces)\b/i.test(candidateLines[0]) && meta.society) {
      candidateLines[0] = `${meta.society} ${candidateLines[0]}`;
    }

    const meaningfulLines = candidateLines.filter(l => l.length > 5);
    let bodyText = meaningfulLines.join(' ').replace(/\s+/g, ' ').trim();
    if (bodyText) {
      const safeText = bodyText
        .replace(/B\.Sc\.\(H\)/gi, 'BSc(H)')
        .replace(/B\.Sc\./gi, 'BSc')
        .replace(/Mr\./gi, 'Mr')
        .replace(/Dr\./gi, 'Dr')
        .replace(/Prof\./gi, 'Prof')
        .replace(/Co\./gi, 'Co')
        .replace(/No\./gi, 'No');

      const sentences = safeText.match(/[^.!?]+[.!?]+/g) || [safeText];
      if (sentences.length > 3) {
        bodyText = sentences.slice(0, 3).join(' ').trim();
      } else if (bodyText.length > 280) {
        bodyText = bodyText.slice(0, 277).trim() + '...';
      }
      resultParts.push(bodyText);
    }
  }

  // 3. Bullets / Key Perks (top 2 maximum)
  if (bulletLines.length > 0 && resultParts.length < 3) {
    const topBullets = bulletLines.slice(0, 2).map(b => `• ${b}`);
    resultParts.push(topBullets.join('\n'));
  }

  // 4. Note or Deadline
  if (deadlineLine && resultParts.length < 4) {
    resultParts.push(deadlineLine);
  } else if (noteLine && resultParts.length < 4) {
    resultParts.push(noteLine);
  }

  if (resultParts.length === 0) {
    return meta.title ? `Announcement regarding ${meta.title}. Check venue and event schedule above.` : 'Check notice details and schedule above.';
  }

  return resultParts.join('\n\n').trim();
}

/**
 * Build society lookup list merging DEMO_SOCIETIES with BUILTIN_SOCIETIES
 */
function getSocietyList() {
  const set = new Set(BUILTIN_SOCIETIES);
  if (Array.isArray(DEMO_SOCIETIES)) {
    DEMO_SOCIETIES.forEach(s => {
      if (s.shortName) set.add(s.shortName.trim());
      if (s.name) {
        // Add cleaned name if concise
        const cleanName = s.name.replace(/\s*\(.*?\)/g, '').replace(/,?\s*SSCBS.*$/i, '').trim();
        if (cleanName.length > 2 && cleanName.length < 35) {
          set.add(cleanName);
        }
      }
    });
  }
  return Array.from(set);
}

/**
 * Main parser function: takes raw WhatsApp / Email text and extracts structured notice data.
 */
export function parseNoticeText(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return null;
  }

  const text = rawText.trim();
  const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let title = '';
  let society = '';
  let venue = '';
  let link_url = '';
  let category = 'Event';
  let event_date = '';
  let active_from = '';
  let active_to = '';
  const extractedFields = [];

  // 1. Extract Links (URLs)
  const urlRegex = /(https?:\/\/[^\s<>"'()[\]]+)/gi;
  const urls = text.match(urlRegex) || [];
  if (urls.length > 0) {
    // Prioritize forms/registration links over generic links
    const formUrl = urls.find(u => /forms\.gle|docs\.google\.com|unstop\.com|bit\.ly|tinyurl|linktr\.ee/i.test(u));
    link_url = formUrl || urls[0];
    // Strip trailing punctuation
    link_url = link_url.replace(/[.,;:!?)]+$/, '');
    extractedFields.push('Registration Link');
  }

  // 2. Identify Society / Department
  const societiesList = getSocietyList();
  for (const soc of societiesList) {
    const socRegex = new RegExp(`\\b${soc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (socRegex.test(text)) {
      society = soc;
      extractedFields.push('Society');
      break;
    }
  }

  // Fallback for society: look for patterns like "Greetings from [XYZ]" or "Team [XYZ]"
  if (!society) {
    const greetingsMatch = text.match(/(?:Greetings from|Warm regards,\s*(?:Team)?|Organized by|Presented by)\s*[:\-–—]?\s*([A-Za-z0-9\s&-]{2,30})/i);
    if (greetingsMatch && greetingsMatch[1]) {
      const candidate = greetingsMatch[1].replace(/Team\s+/i, '').trim();
      if (candidate.length > 2 && candidate.length < 35 && !/everyone|all|students/i.test(candidate)) {
        society = candidate;
        extractedFields.push('Society');
      }
    }
  }

  // 3. Extract Venue
  const venueKeyMatch = text.match(/(?:📍|🏢|🏛️)?\s*(?:Venue|Location|Place|Room|Platform|Where|Held at)\s*[:\-–—]\s*([^\n\r]+)/i);
  if (venueKeyMatch && venueKeyMatch[1]) {
    venue = cleanLine(venueKeyMatch[1]);
  } else {
    // Check known SSCBS locations across text
    if (/Auditorium|Audi\b/i.test(text)) venue = 'Auditorium';
    else if (/Amphitheatre|Amphi\b/i.test(text)) venue = 'Amphitheatre';
    else if (/Seminar Hall/i.test(text)) venue = 'Seminar Hall';
    else if (/Council Room|Board Room/i.test(text)) venue = 'Council Room';
    else if (/Computer Lab\s*\d*/i.test(text)) {
      const m = text.match(/Computer Lab\s*\d*/i);
      venue = m ? m[0] : 'Computer Lab';
    } else if (/Room\s*(?:No\.?\s*)?(\d{2,3})/i.test(text)) {
      const m = text.match(/Room\s*(?:No\.?\s*)?(\d{2,3})/i);
      venue = `Room ${m[1]}`;
    } else if (/Google Meet|GMeet|Zoom|MS Teams|Online/i.test(text)) {
      venue = 'Google Meet / Online';
    }
  }

  if (venue) {
    if (/^audi$/i.test(venue)) venue = 'Auditorium';
    if (/^amphi$/i.test(venue)) venue = 'Amphitheatre';
    extractedFields.push('Venue');
  }

  // 4. Extract Date and Time
  let extractedDateStr = '';
  let extractedTimeStr = '';

  const dateKeyMatch = text.match(/(?:📅|🗓️|📆)?\s*(?:Date|Day|When)\s*[:\-–—]\s*([^\n\r,]+(?:,\s*\d{4})?)/i);
  if (dateKeyMatch && dateKeyMatch[1]) {
    extractedDateStr = cleanLine(dateKeyMatch[1]);
  }

  const timeKeyMatch = text.match(/(?:⏰|⏱️|🕐|🕒)?\s*(?:Time|Timing|At)\s*[:\-–—]\s*([^\n\r]+)/i);
  if (timeKeyMatch && timeKeyMatch[1]) {
    extractedTimeStr = cleanLine(timeKeyMatch[1]);
  }

  // Parse Date string into Year, Month, Day
  let parsedYear = new Date().getFullYear();
  let parsedMonth = null; // 0-11
  let parsedDay = null; // 1-31

  const monthsMap = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
  };

  const targetDateText = extractedDateStr || text;

  // Patterns like: "28th September 2026", "28 September, 2026", "September 28, 2026", "28/09/2026", "28-09-2026"
  const dmyMatch = targetDateText.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)(?:[,\s]+(\d{4}))?\b/i);
  const mdyMatch = targetDateText.match(/\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(\d{4}))?\b/i);
  const slashMatch = targetDateText.match(/\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2,4})\b/);

  if (dmyMatch && monthsMap[dmyMatch[2].toLowerCase()] !== undefined) {
    parsedDay = parseInt(dmyMatch[1], 10);
    parsedMonth = monthsMap[dmyMatch[2].toLowerCase()];
    if (dmyMatch[3]) parsedYear = parseInt(dmyMatch[3], 10);
  } else if (mdyMatch && monthsMap[mdyMatch[1].toLowerCase()] !== undefined) {
    parsedDay = parseInt(mdyMatch[2], 10);
    parsedMonth = monthsMap[mdyMatch[1].toLowerCase()];
    if (mdyMatch[3]) parsedYear = parseInt(mdyMatch[3], 10);
  } else if (slashMatch) {
    parsedDay = parseInt(slashMatch[1], 10);
    parsedMonth = parseInt(slashMatch[2], 10) - 1;
    let y = parseInt(slashMatch[3], 10);
    parsedYear = y < 100 ? 2000 + y : y;
  } else if (/tomorrow/i.test(targetDateText)) {
    const tom = new Date(Date.now() + 24 * 3600 * 1000);
    parsedDay = tom.getDate();
    parsedMonth = tom.getMonth();
    parsedYear = tom.getFullYear();
  } else if (/today/i.test(targetDateText)) {
    const today = new Date();
    parsedDay = today.getDate();
    parsedMonth = today.getMonth();
    parsedYear = today.getFullYear();
  }

  // Parse Time string into Hours & Minutes
  let parsedHour = 10; // Default 10 AM if unspecified
  let parsedMinute = 0;

  const targetTimeText = extractedTimeStr || text;
  // Match e.g. "10:00 AM", "2:30 PM", "3 PM", "14:00"
  const timeRegex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  const timeMatches = targetTimeText.match(new RegExp(timeRegex, 'gi')) || [];

  for (const tm of timeMatches) {
    const m = tm.match(timeRegex);
    if (m) {
      let hr = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      const period = m[3] ? m[3].toUpperCase() : null;

      if (hr >= 1 && hr <= 24) {
        if (period === 'PM' && hr < 12) hr += 12;
        if (period === 'AM' && hr === 12) hr = 0;
        parsedHour = hr;
        parsedMinute = min;
        break;
      }
    }
  }

  if (parsedDay !== null && parsedMonth !== null) {
    const yStr = String(parsedYear);
    const mStr = String(parsedMonth + 1).padStart(2, '0');
    const dStr = String(parsedDay).padStart(2, '0');
    const hrStr = String(parsedHour).padStart(2, '0');
    const minStr = String(parsedMinute).padStart(2, '0');
    event_date = `${yStr}-${mStr}-${dStr}T${hrStr}:${minStr}`;
    extractedFields.push('Event Date');

    // Auto set active_to to end of the event day or +4 hours
    active_to = `${yStr}-${mStr}-${dStr}T23:59`;
  }

  // Auto set active_from to right now
  const now = new Date();
  const curY = now.getFullYear();
  const curM = String(now.getMonth() + 1).padStart(2, '0');
  const curD = String(now.getDate()).padStart(2, '0');
  const curH = String(now.getHours()).padStart(2, '0');
  const curMin = String(now.getMinutes()).padStart(2, '0');
  active_from = `${curY}-${curM}-${curD}T${curH}:${curMin}`;

  // 5. Categorize
  const lowerText = text.toLowerCase();
  if (/recruitment|audition|auditions|orientation|induction|membership drive|core team|join us/i.test(lowerText)) {
    category = 'Society';
  } else if (/workshop|webinar|masterclass|guest lecture|pre-placement|speaker|panel|session/i.test(lowerText)) {
    category = 'Session';
  } else if (/internal assessment|attendance|exam|datesheet|syllabus|semester|portal|fees|admit card|principal/i.test(lowerText)) {
    category = 'Academic';
  } else {
    category = 'Event';
  }
  extractedFields.push('Category');

  // 6. Title Detection
  // Quoted event headline: "Cracking Consulting Case Interviews"
  const quotedMatch = text.match(/["“]([^"”\n\r]{5,60})["”]/);
  
  // "presents" pattern: *KRONOS* presents\n*HACKCBS 7.0*
  const presentsMatch = text.match(/presents\s*[\n\r]+\*?([^\n\r*]+)\*?/i);

  // "invites you to" pattern
  const invitesMatch = text.match(/(?:invites you to|announces)\s*(?:an?\s*)?\*?([^\n\r*]+)\*?/i);

  // "NOTICE:" pattern
  const noticeMatch = text.match(/NOTICE\s*[:\-–—]\s*([^\n\r]+)/i);

  // "is back with its Annual Auditions" pattern
  const eventActionMatch = text.match(/(?:is back with|presents its|announces its)\s+(?:its\s+)?([^\n\r!.]+)/i);

  if (presentsMatch && cleanLine(presentsMatch[1]).length > 4) {
    title = cleanLine(presentsMatch[1]);
  } else if (noticeMatch && cleanLine(noticeMatch[1]).length > 4) {
    title = cleanLine(noticeMatch[1]);
  } else if (eventActionMatch && cleanLine(eventActionMatch[1]).length > 4) {
    const act = cleanLine(eventActionMatch[1]);
    title = society ? `${society} - ${act}` : act;
  } else if (quotedMatch && quotedMatch[1].length > 6) {
    title = cleanLine(quotedMatch[1]);
  } else if (invitesMatch && cleanLine(invitesMatch[1]).length > 4) {
    title = cleanLine(invitesMatch[1]);
  } else {
    // Pick the most prominent early line that isn't just a generic greeting or society name
    for (let i = 0; i < Math.min(5, rawLines.length); i++) {
      const line = cleanLine(rawLines[i]);
      if (
        line.length > 5 &&
        line.length < 80 &&
        !/greetings|everyone|hello|warm regards|team\b/i.test(line) &&
        (!society || line.toLowerCase() !== society.toLowerCase())
      ) {
        title = line;
        break;
      }
    }
  }

  // Clean title: remove markdown asterisks, emojis, trailing colons/dashes
  if (title) {
    title = stripEmojis(title)
      .replace(/^[\s*•\-–—►▪️🔹🔸▶️*#_~]+/, '')
      .replace(/[\s*#_~:\-]+$/, '')
      .trim();
    if (title.length > 0) {
      extractedFields.push('Title');
    }
  }

  if (!title) {
    title = society ? `${society} Announcement` : 'Campus Notice';
  }

  // 7. Generate Apt 3-4 Line Description
  // Strips out redundant venue, date/time, links, contacts, and WhatsApp greetings
  const aptDescription = generateAptDescription(text, { title, society, venue, event_date, link_url });
  const content = aptDescription || (society ? `Announcement by ${society}. Check details above.` : 'Check campus notice details above.');
  if (content) {
    extractedFields.push('Apt Description');
  }

  return {
    title,
    society,
    venue,
    content,
    link_url,
    category,
    event_date,
    active_from,
    active_to,
    extractedFields
  };
}

/**
 * Sample WhatsApp notice for 1-click preview / test in Admin Console
 */
export const SAMPLE_WHATSAPP_NOTICE = `*KRONOS - The Tech Society of SSCBS* 🚀
presents
*HACKCBS 7.0 - INDIA'S LARGEST STUDENT-RUN HACKATHON* 💻🔥

Greetings Everyone! 👋
Are you ready to test your problem-solving, development, and innovation skills? Kronos brings you the flagship 7th edition of HackCBS!

✨ *Perks:*
- Cash prize pool of ₹5,00,000+
- Internship & mentorship opportunities
- Swag kits & certificates for all shortlisted finalists

📅 *Date:* 28th September 2026
⏰ *Time:* 10:00 AM onwards
📍 *Venue:* College Auditorium & Online
🔗 *Register now:* https://forms.gle/xyz123hackcbs

For queries, contact:
Aditya: 9876543210
Manthan: 9876543211

Warm regards,
Team Kronos`;
