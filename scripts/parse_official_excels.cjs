const xlsx = require('xlsx');
const fs = require('fs');

const FILE_1 = 'TT_wef _28.07.2026 .xlsx';
const FILE_2 = 'TT_JULY 2026.xlsx';

const DEFAULT_SECTION_ROOMS = {
  'BMS_1_A': 'Room 703',
  'BMS_1_B': 'Room 703',
  'BMS_1_C': 'Room 703',
  'BMS_1_D': 'Room 703',
  'BMS_3_A': 'Room 703',
  'BMS_3_B': 'Room 703',
  'BMS_3_C': 'Room 703',
  'BMS_3_D': 'Room 703',
  'BMS_5_A': 'Room 703',
  'BMS_5_B': 'Room 703',
  'BMS_5_C': 'Room 703',
  'BMS_5_D': 'Room 703',
  'BMS_7_A': 'Room 523',
  'BBA FIA_1_A': 'Room 503',
  'BBA FIA_1_B': 'Room 503',
  'BBA FIA_3_A': 'Room 503',
  'BBA FIA_3_B': 'Room 503',
  'BBA FIA_5_A': 'Room 503',
  'BBA FIA_5_B': 'Room 507',
  'BBA FIA_7_A': 'Room 533',
  'Bsc Comp Sci_1_A': 'Room 403',
  'Bsc Comp Sci_3_A': 'Room 407',
  'Bsc Comp Sci_5_A': 'Room 457',
  'Bsc Comp Sci_7_A': 'Room 435'
};

const FACULTY_DIRECTORY = {
  'aa': 'Dr. Anamika Agarwal',
  'ag': 'Anamika Gupta',
  'anamika gupta': 'Anamika Gupta',
  'ayg': 'Ayushi Gupta',
  'ayushi gupta': 'Ayushi Gupta',
  'dd': 'Dr. Deepali Dhaka',
  'deepali': 'Dr. Deepali Dhaka',
  'am': 'Dr. Anuja Mathur',
  'anuja mathur': 'Dr. Anuja Mathur',
  'ta': 'Dr. Tarannum Ahmad',
  'mv': 'Dr. Mona Verma',
  'mona verma': 'Dr. Mona Verma',
  'sj': 'Dr. Saumya Jain',
  'saumya jain': 'Dr. Saumya Jain',
  'skg': 'Dr. Satish Kumar Garg',
  'sk': 'Mr. Praveen SK',
  'ps': 'Mr. Praveen SK',
  'praveen': 'Mr. Praveen SK',
  'kr': 'Kavita Rastogi',
  'krs': 'Dr. Kavita Rastogi',
  'os': 'Dr. Onkar Singh',
  'ng': 'Dr. Nidhi Kesari',
  'nb': 'Dr. Neha Sharma',
  'neha': 'Dr. Neha Sharma',
  'st': 'Dr. Sushmita',
  'ma': 'Dr. Mehak Aggarwal',
  'mn': 'Dr. Mona Verma',
  'azmi': 'Dr. Azmi Ahmad',
  'av': 'Abhimanyu Verma',
  'pa': 'Priyanka',
  'priyanka': 'Priyanka',
  'komal': 'Komal Sharma',
  'garima': 'Dr. Garima Tripathi',
  'sog': 'Dr. Soumya Guliyan',
  'soumya': 'Dr. Soumya Guliyan',
  'vinayak': 'Vinayak Gautam',
  'nisha': 'Ms. Nisha Rajput',
  'vipin': 'Mr. Vipin Patel',
  'ishan': 'Ishan Jain',
  'ankit': 'Ankit',
  'seema': 'Dr. Seema',
  'mt': 'Dr. Madhu Totla',
  'sv': 'Shikha Verma',
  'nks': 'Dr. Nidhi Kesari',
  'mr': 'Mr. Raj Kumar',
  'tm': 'Mr. Tushar Marwaha',
  'paridhi': 'Paridhi',
  'shipra': 'Ms. Shipra Varshney',
  'guncha': 'Dr. Guncha',
  'sp': 'Dr. Shalini Prakash',
  'kb': 'Dr. Kumar Bijoy',
  'nk': 'Dr. Nidhi Kesari',
  'rk': 'Dr. Raj Kumar',
  'rrs': 'Dr. Rishi Rajan Sahay',
  'sanchi': 'Ms. Sanchi Kalra',
  'ayesha': 'Ms. Ayesha S. Ansari',
  'monu': 'Dr. Monu',
  'ritika': 'Ritika',
  'bhavya': 'Bhavya',
  'kajol': 'Kajol',
  'twinkle': 'Twinkle',
  'vineet': 'Vineet',
  'ankita': 'Ankita',
  'rohan': 'Mr. Rohan Gulati',
  'tatkarsh': 'Mr. Tatkarsh',
  'monika': 'Ms. Monika',
  'vp': 'Mr. Vipin Patel',
  'nr': 'Ms. Nisha Rajput',
  'gs': 'Gautam Sharma',
  'rg': 'Mr. Rohan Gulati',
  'sg': 'Dr. Saumya Jain'
};

const NON_TEACHER_KEYS = new Set([
  'pg', 'ee', 'ee1', 'ee2', 'lab', 'room', 'hindi', 'hin', 'aecc', 'vac', 'sec', 'ge', 'evs', 'unsupervised', 'free', 'off', 'active class', 'guest', 'ns'
]);

const PERIOD_COL_MAP = [
  { period: 1, colIdx: 1 },
  { period: 2, colIdx: 2 },
  { period: 3, colIdx: 3 },
  // colIdx 4 is Infinity Hour 12:00 - 1:00 PM
  { period: 4, colIdx: 5 },
  { period: 5, colIdx: 6 },
  { period: 6, colIdx: 7 },
  { period: 7, colIdx: 8 }
];

function cleanTeacherName(rawPart, legendMap = {}) {
  if (!rawPart) return null;
  let cleaned = rawPart
    .replace(/^[:\s\-]+|[:\s\-]+$/g, '')
    .replace(/\b(G[1234]|P[1234]|GI|GII)\b:?/gi, '')
    .replace(/\(((?:G1\s*\+\s*G2)|G1|G2|P[12]?|Practical|Tute|Tutorial|Merged[^\)]*|\d{3}(?:\/\d{3})*|Room[^\)]*|Hin[^\)]*|Python|SEC[^\)]*|Th)\)/gi, '')
    .replace(/merged\s+with\s+[^\)]*/gi, '')
    .replace(/\b(P|Practical|Tute|Tutorial|Lab|L)\b/gi, '')
    .replace(/\b[2-7]\d{2}\b/g, '')
    .replace(/^[():\s\/-]+|[():\s\/-]+$/g, '')
    .replace(/[\s-]+/g, ' ')
    .trim();

  const key = cleaned.toLowerCase();
  if (NON_TEACHER_KEYS.has(key)) return null;

  if (legendMap[key] && legendMap[key].facName) {
    return legendMap[key].facName;
  }
  if (FACULTY_DIRECTORY[key]) {
    return FACULTY_DIRECTORY[key];
  }

  // Handle strings like "Garima (Hin A 607" or "Soumya (Hin C"
  const firstWordKey = key.split(' ')[0];
  if (FACULTY_DIRECTORY[firstWordKey]) {
    return FACULTY_DIRECTORY[firstWordKey];
  }

  if (cleaned.length < 2) return null;
  return cleaned;
}

function buildMasterTimetable() {
  const masterData = {};

  const processFile = (filePath) => {
    if (!fs.existsSync(filePath)) return;
    const wb = xlsx.readFile(filePath);

    wb.SheetNames.forEach(sheetName => {
      const sheet = wb.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      for (let r = 0; r < data.length; r++) {
        const row = data[r] || [];
        const rowStr = row.map(c => String(c || '').trim()).join(' ');

        if (rowStr.includes('CLASS TIME TABLE') || rowStr.includes('Academic Session')) {
          let course = 'BMS';
          let sem = '1';
          let sec = 'A';
          let defaultRoom = '';

          for (let m = Math.max(0, r - 2); m <= r + 4; m++) {
            const mRow = data[m] || [];
            const mStr = mRow.map(c => String(c || '').trim()).join(' ');

            if (/BBA\s*\(?FIA\)?/i.test(mStr)) course = 'BBA FIA';
            else if (/B\.?Sc/i.test(mStr) || /COMPUTER SCIENCE/i.test(mStr)) course = 'Bsc Comp Sci';
            else if (/BMS/i.test(mStr)) course = 'BMS';

            const semMatch = mStr.match(/Sem\s*:?\s*(\d+)(?:st|nd|rd|th)?/i) || mStr.match(/(\d+)(?:st|nd|rd|th)?\s*Sem/i);
            if (semMatch) sem = semMatch[1];

            const secMatch = mStr.match(/Section\s*([A-D])/i);
            if (secMatch) sec = secMatch[1];

            const roomNoMatch = mStr.match(/Room\s*No\.?\s*:?\s*(\d{3})/i) || mStr.match(/Room\s*:?\s*(\d{3})/i);
            if (roomNoMatch) defaultRoom = `Room ${roomNoMatch[1]}`;
          }

          if (!defaultRoom) defaultRoom = DEFAULT_SECTION_ROOMS[`${course}_${sem}_${sec}`] || 'Room 703';

          // Extract section legend table
          const legendMap = {};
          for (let l = r + 8; l < r + 50 && l < data.length; l++) {
            const lRow = data[l] || [];
            const str = lRow.map(c => String(c || '').trim()).join(' ');
            if (str.includes('CLASS TIME TABLE') && l > r + 15) break;

            const nonEmpties = lRow.map(c => String(c || '').trim()).filter(Boolean);
            if (nonEmpties.length >= 3) {
              let paperName = '';
              let facName = '';
              let facCode = '';

              if (nonEmpties[0].match(/^\d+$/)) {
                // BMS/BBA format: S.No | Type | Paper Name | Faculty Name | Code
                paperName = nonEmpties[2] || '';
                facName = nonEmpties[3] || '';
                facCode = nonEmpties[4] || facName;
              } else if (['core', 'ge', 'sec', 'vac', 'dse', 'aec'].includes(nonEmpties[0].toLowerCase())) {
                // CS format: Type | Course Name | Code | Faculty Name | Faculty Code
                paperName = nonEmpties[1] || '';
                facName = nonEmpties[3] || nonEmpties[2] || '';
                facCode = nonEmpties[4] || nonEmpties[3] || facName;
              }

              if (paperName && (facName || facCode)) {
                const info = { paperName, facName: facName || facCode };
                const cleanCode = facCode.replace(/\(.*\)/, '').trim().toLowerCase();
                const cleanName = facName.replace(/\(.*\)/, '').trim().toLowerCase();
                if (cleanCode) legendMap[cleanCode] = info;
                if (cleanName) legendMap[cleanName] = info;
              }
            }
          }

          // Parse grid days
          const daysData = {};
          const dayMap = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday' };

          for (let d = r + 1; d <= r + 20 && d < data.length; d++) {
            const dRow = data[d] || [];
            const firstCell = String(dRow[0] || '').trim();
            const dayMatch = firstCell.match(/^(Mon|Tue|Wed|Thu|Fri)/i);

            if (dayMatch) {
              const mappedDay = dayMap[dayMatch[1]];
              const periodsList = [];

              PERIOD_COL_MAP.forEach(pm => {
                let cellVal = String(dRow[pm.colIdx] || '').trim();

                if (!cellVal || cellVal === '-' || cellVal.toLowerCase() === 'off' || cellVal.toLowerCase() === 'free') {
                  periodsList.push({
                    period: pm.period,
                    subject: 'Free',
                    teacher: '-',
                    room: '-'
                  });
                  return;
                }

                // Parse components divided by '/'
                const splits = cellVal.split('/').map(x => x.trim()).filter(Boolean);
                const parsedSubjects = [];
                const parsedTeachers = [];
                const parsedRooms = [];

                splits.forEach(part => {
                  // Room extraction
                  let compRoom = defaultRoom;
                  const roomMatch = part.match(/\b([2-7]\d{2})\b/) || part.match(/Lab\s*(\d{3})/i);
                  if (roomMatch) {
                    compRoom = `Room ${roomMatch[1]}`;
                  }

                  // Group prefix
                  const grpMatch = part.match(/\b(G[1234])\b/i);
                  const grpPrefix = grpMatch ? `${grpMatch[1].toUpperCase()}: ` : '';

                  // Unsupervised check
                  if (part.toLowerCase().includes('unsupervised')) {
                    parsedTeachers.push(`${grpPrefix}Unsupervised`);
                    parsedSubjects.push(`${grpPrefix}${part}`);
                    parsedRooms.push(compRoom);
                    return;
                  }

                  // Teacher name extraction
                  const teacherName = cleanTeacherName(part, legendMap);

                  // Paper Title extraction
                  const cleanKey = part.replace(/\s*\([^)]*\)/g, '').replace(/\b(G[1234])\b/gi, '').trim().toLowerCase();
                  const matchedInfo = legendMap[cleanKey];
                  const paperTitle = matchedInfo ? matchedInfo.paperName : part;

                  parsedSubjects.push(grpPrefix ? `${grpPrefix}${paperTitle}` : paperTitle);
                  if (teacherName) {
                    parsedTeachers.push(grpPrefix ? `${grpPrefix}${teacherName}` : teacherName);
                  }
                  parsedRooms.push(compRoom);
                });

                // Format deduplicated strings
                const finalSubject = [...new Set(parsedSubjects)].join(' / ');
                const finalTeacher = parsedTeachers.length > 0 ? [...new Set(parsedTeachers)].join(' / ') : '-';
                const finalRoom = [...new Set(parsedRooms)].join(' / ');

                periodsList.push({
                  period: pm.period,
                  subject: finalSubject,
                  teacher: finalTeacher,
                  room: finalRoom
                });
              });

              daysData[mappedDay] = periodsList;
            }
          }

          if (Object.keys(daysData).length > 0) {
            if (!masterData[course]) masterData[course] = {};
            if (!masterData[course][sem]) masterData[course][sem] = {};
            masterData[course][sem][sec] = daysData;
          }
        }
      }
    });
  };

  processFile(FILE_1);
  processFile(FILE_2);

  return masterData;
}

const master = buildMasterTimetable();
fs.writeFileSync('src/data/timetables.json', JSON.stringify(master, null, 2));
console.log('Clean master timetable JSON regenerated successfully!');
