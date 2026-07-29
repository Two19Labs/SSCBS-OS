// SSCBS Faculty Initials Resolution Map
const FACULTY_INITIALS = {
  'ayg': 'Ayushi Goel',
  'ag': 'Ayushi Goel',
  'aa': 'Dr. Anamika Agarwal',
  'dd': 'Dr. Deepali Dhaka',
  'am': 'Dr. Amit Kumar',
  'ta': 'Dr. Tarannum Ahmad',
  'mv': 'Dr. Mona Verma',
  'sj': 'Dr. Shikha Gupta',
  'sk': 'Mr. Praveen SK',
  'ps': 'Mr. Praveen SK',
  'kr': 'Kavita Rastogi',
  'os': 'Onkar Singh',
  'ng': 'Neha Gupta',
  'nb': 'Dr. Neha Bhatia',
  'st': 'Sonika Thakral'
};

const NON_TEACHER_REGEX = /^(hindi\s*[a-d]?|hindi\s.*|aecc|vac|sec|ge|evs|sports|physical ed|value addition|lab|free|unsupervised|break|infinity hour|-)$/i;

/**
 * Clean embedded 3-digit room numbers, handle G1/G2 splits, and resolve faculty initials.
 */
export function sanitizeClassItem(item) {
  if (!item || item.isBreak) return item;

  let subject = (item.subject || '').trim();
  let teacher = (item.teacher || '').trim();
  let room = (item.room || '').trim();

  // 1. EXTRACT EMBEDDED 3-DIGIT ROOM NUMBERS (e.g. "Komal 648", "MV (361/326)", "Ankit (523/651)")
  const extractedRooms = [];
  const roomExtractRegex = /\b([2-7]\d{2}(?:\/[2-7]\d{2})?)\b/g;

  let roomMatch;
  while ((roomMatch = roomExtractRegex.exec(subject)) !== null) {
    extractedRooms.push(roomMatch[1]);
  }
  roomExtractRegex.lastIndex = 0;
  while ((roomMatch = roomExtractRegex.exec(teacher)) !== null) {
    extractedRooms.push(roomMatch[1]);
  }

  // Clean extracted room numbers from subject and teacher text
  if (extractedRooms.length > 0) {
    subject = subject.replace(/\s*\(\s*[2-7]\d{2}(?:\/[2-7]\d{2})*\s*\)/g, '').replace(/\b[2-7]\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
    teacher = teacher.replace(/\s*\(\s*[2-7]\d{2}(?:\/[2-7]\d{2})*\s*\)/g, '').replace(/\b[2-7]\d{2}\b/g, '').replace(/\s+/g, ' ').trim();

    // If room is generic like "P", "Tute", "Hin A / Hin C" or empty, update room to extracted numbers
    const cleanExtracted = extractedRooms.flatMap(r => r.split('/')).map(r => `Room ${r.trim()}`);
    const uniqueExtracted = [...new Set(cleanExtracted)];
    if (room === 'P' || room === 'Tute' || room === '' || room === '-' || room.startsWith('Hin ')) {
      room = uniqueExtracted.join(' / ');
    }
  }

  // 2. CHECK FOR NON-TEACHER IN TEACHER FIELD (e.g. "HINDI A / Hindi C")
  if (NON_TEACHER_REGEX.test(teacher)) {
    if (subject && !subject.toLowerCase().includes(teacher.toLowerCase())) {
      subject = `${subject} (${teacher})`;
    } else if (!subject) {
      subject = teacher;
    }
    teacher = '-';
  }

  // 3. FACULTY INITIALS RESOLUTION & LAB SUFFIX STRIPPING
  if (teacher && teacher !== '-') {
    const parts = teacher.split(/\/|\band\b|,/gi).map(p => p.trim());
    const cleanedParts = parts.map(p => {
      let cleaned = p.replace(/\blab\b/gi, '').replace(/\(g\d+\)/gi, '').trim();
      const lower = cleaned.toLowerCase();
      if (FACULTY_INITIALS[lower]) return FACULTY_INITIALS[lower];
      if (NON_TEACHER_REGEX.test(lower)) return '';
      return cleaned;
    }).filter(Boolean);

    teacher = cleanedParts.length > 0 ? cleanedParts.join(' / ') : '-';
  }

  // 4. G1/G2 SPLIT PAIRING & LABELLING
  const subParts = subject.split(/\s*\|\s*|\s*\/\s*/).map(s => s.trim()).filter(Boolean);
  const teacherParts = teacher.split(/\s*\/\s*/).map(t => t.trim()).filter(Boolean);
  const roomParts = room.split(/\s*\/\s*/).map(r => r.trim()).filter(Boolean);

  const hasGroupTag = /g1|g2|g\?/i.test(subject) || /g1|g2|g\?/i.test(teacher) || /g1|g2|g\?/i.test(room);

  if (!hasGroupTag) {
    if (subParts.length === 2 && teacherParts.length === 2) {
      subject = `G1: ${subParts[0]} | G2: ${subParts[1]}`;
      teacher = `${teacherParts[0]} (G1) / ${teacherParts[1]} (G2)`;
      if (roomParts.length === 2) {
        room = `G1: ${roomParts[0]} / G2: ${roomParts[1]}`;
      }
    } else if (teacherParts.length === 2 && subParts.length <= 1) {
      teacher = `${teacherParts[0]} (G1) / ${teacherParts[1]} (G2)`;
      if (roomParts.length === 2) {
        room = `G1: ${roomParts[0]} / G2: ${roomParts[1]}`;
      }
    } else if (subParts.length === 3 && teacherParts.length === 3) {
      subject = `G1: ${subParts[0]} | G2: ${subParts[1]} | G3: ${subParts[2]}`;
      teacher = `${teacherParts[0]} (G1) / ${teacherParts[1]} (G2) / ${teacherParts[2]} (G3)`;
      if (roomParts.length === 3) {
        room = `G1: ${roomParts[0]} / G2: ${roomParts[1]} / G3: ${roomParts[2]}`;
      }
    }
  }

  return {
    ...item,
    subject,
    teacher,
    room
  };
}

export function sanitizeWeekSchedule(weekSchedule) {
  if (!weekSchedule || typeof weekSchedule !== 'object') return weekSchedule;
  const sanitized = {};
  for (const day in weekSchedule) {
    if (!Array.isArray(weekSchedule[day])) {
      sanitized[day] = weekSchedule[day];
      continue;
    }
    sanitized[day] = weekSchedule[day].map(sanitizeClassItem);
  }
  return sanitized;
}

export function sanitizeEntireTimetable(timetableData) {
  if (!timetableData || typeof timetableData !== 'object') return timetableData;
  const sanitized = {};
  for (const course in timetableData) {
    sanitized[course] = {};
    for (const sem in timetableData[course]) {
      sanitized[course][sem] = {};
      for (const sec in timetableData[course][sem]) {
        sanitized[course][sem][sec] = sanitizeWeekSchedule(timetableData[course][sem][sec]);
      }
    }
  }
  return sanitized;
}
