const xlsx = require('c:/Users/adity/Downloads/SSCBS OS/node_modules/xlsx');
const fs = require('fs');

const FILE_1 = 'TT_wef _28.07.2026 .xlsx';
const FILE_2 = 'TT_JULY 2026.xlsx';

const timetables = {};

// Default room fallback map if room row isn't parsed cleanly
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

const MASTER_FACULTY_MAP = {
  'aa': 'Dr. Anamika Agarwal',
  'ag': 'Anamika Gupta',
  'ayg': 'Ayushi Gupta',
  'dd': 'Dr. Deepali Dhaka',
  'am': 'Dr. Amit Kumar',
  'ta': 'Dr. Tarannum Ahmad',
  'mv': 'Dr. Mona Verma',
  'sj': 'Dr. Shikha Gupta',
  'skg': 'Dr. Satish Kumar Garg',
  'sk': 'Mr. Praveen SK',
  'ps': 'Mr. Praveen SK',
  'kr': 'Kavita Rastogi',
  'krs': 'Dr. Kavita Rastogi',
  'os': 'Onkar Singh',
  'ng': 'Neha Gupta',
  'nb': 'Dr. Neha Bhatia',
  'st': 'Sonika Thakral',
  'ma': 'Ms. Mohini Rajput',
  'mn': 'Dr. Mona Verma',
  'azmi': 'Mohd. Azmi Khan',
  'av': 'Abhimanyu',
  'pa': 'Dr. Preeti Rajpal',
  'komal': 'Mr. Komal',
  'garima': 'Dr. Garima Tripathi',
  'vinayak': 'Vinayak',
  'nisha': 'Nisha Rajput',
  'vipin': 'Vipin Patel',
  'ishan': 'Dr. Ishan Luthra',
  'ankit': 'Mr. Ankit Bisht',
  'seema': 'Dr. Seema',
  'mt': 'Dr. Madhu Totla',
  'sv': 'Shikha Verma',
  'nks': 'Dr. Nidhi Kesari',
  'mr': 'Mr. Mohd. Rashid',
  'tm': 'Mr. Tushar Marwaha',
  'paridhi': 'Ms. Paridhi',
  'sp': 'Dr. Shalini Prakash',
  'kb': 'Dr. Kumar Bijoy',
  'nk': 'Dr. Nidhi Kesari',
  'rk': 'Dr. Raj Kumar',
  'raj': 'Dr. Raj Kumar',
  'rohan': 'Mr. Rohan Gulati',
  'rg': 'Mr. Rohan Gulati',
  'mehak': 'Dr. Mehak Aggarwal',
  'sog': 'Dr. Soumya Guliyan',
  'pg': 'Pushkar Gole',
  'gs': 'Guncha Sharma',
  'vp': 'Vipin Patel',
  'nr': 'Nisha Rajput',
  'ns': 'Nidhi Seth',
  'gt': 'Dr. Garima Tripathi',
  'sushmita': 'Dr. Sushmita',
  'kajol': 'Kajol',
  'mohini': 'Ms. Mohini Rajput'
};

function parseWorkbook(filePath) {
  if (!fs.existsSync(filePath)) return;
  const wb = xlsx.readFile(filePath);

  wb.SheetNames.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Locate all block header starts (Row with "CLASS TIME TABLE" or "Academic Session")
    for (let r = 0; r < rawData.length; r++) {
      const row = rawData[r] || [];
      const rowStr = row.map(c => String(c || '').trim()).join(' ');

      if (rowStr.includes('CLASS TIME TABLE') || rowStr.includes('Academic Session')) {
        let course = 'BMS';
        let sem = '1';
        let sec = 'A';
        let defaultRoom = '';

        // Read metadata rows around r
        for (let m = Math.max(0, r - 2); m <= r + 4; m++) {
          const mRow = rawData[m] || [];
          const mStr = mRow.map(c => String(c || '').trim()).join(' ');

          // Course
          if (/BBA\s*\(?FIA\)?/i.test(mStr)) course = 'BBA FIA';
          else if (/B\.?Sc/i.test(mStr) || /COMPUTER SCIENCE/i.test(mStr)) course = 'Bsc Comp Sci';
          else if (/BMS/i.test(mStr)) course = 'BMS';

          // Semester
          const semMatch = mStr.match(/(\d)(?:st|nd|rd|th)?\s*Sem/i) || mStr.match(/Sem(?:ester)?\s*(\d)/i);
          if (semMatch) sem = semMatch[1];

          // Section
          const secMatch = mStr.match(/Section\s*([A-D])/i);
          if (secMatch) sec = secMatch[1];

          // Default Room
          const roomNoMatch = mStr.match(/Room\s*No\.?\s*:?\s*(\d{3})/i) || mStr.match(/Room\s*:?\s*(\d{3})/i);
          if (roomNoMatch) defaultRoom = `Room ${roomNoMatch[1]}`;
        }

        const sectionKey = `${course}_${sem}_${sec}`;
        if (!defaultRoom) defaultRoom = DEFAULT_SECTION_ROOMS[sectionKey] || 'Room 703';

        // Find Day rows (Mon, Tue, Wed, Thu, Fri)
        const daysData = {};

        for (let d = r + 1; d <= r + 20 && d < rawData.length; d++) {
          const dRow = rawData[d] || [];
          const firstCell = String(dRow[0] || '').trim();
          const dayMatch = firstCell.match(/^(Mon|Tue|Wed|Thu|Fri|Sat)/i);

          if (dayMatch) {
            const dayName = dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1).toLowerCase();
            const mappedDay = dayName === 'Mon' ? 'Monday' : dayName === 'Tue' ? 'Tuesday' : dayName === 'Wed' ? 'Wednesday' : dayName === 'Thu' ? 'Thursday' : dayName === 'Fri' ? 'Friday' : null;

            if (mappedDay) {
              const periodsList = [];
              const colMapping = [
                { col: 1, p: 1 },
                { col: 2, p: 2 },
                { col: 3, p: 3 },
                { col: 4, p: 0, isBreak: true },
                { col: 5, p: 4 },
                { col: 6, p: 5 },
                { col: 7, p: 6 },
                { col: 8, p: 7 }
              ];

              colMapping.forEach(m => {
                if (m.isBreak) {
                  periodsList.push({
                    period: 0,
                    isBreak: true,
                    subject: 'Infinity Hour (Break)',
                    teacher: '',
                    room: ''
                  });
                  return;
                }

                const cellVal = String(dRow[m.col] || '').trim();

                if (!cellVal || cellVal.toLowerCase() === 'free' || cellVal === '-') {
                  periodsList.push({
                    period: m.p,
                    subject: 'Free',
                    teacher: '-',
                    room: '-'
                  });
                  return;
                }

                // Parse cell content
                let subject = cellVal;
                let teacher = cellVal;
                let room = defaultRoom;

                // Check for embedded 3-digit room numbers (e.g. 648, 607, 703, 361, 534, 523, 651, 326)
                const roomMatch = cellVal.match(/\b([2-7]\d{2})(?:\/([2-7]\d{2}))?\b/);
                if (roomMatch) {
                  room = roomMatch[2] ? `Room ${roomMatch[1]} / Room ${roomMatch[2]}` : `Room ${roomMatch[1]}`;
                }

                // Check for unsupervised
                if (cellVal.toLowerCase().includes('unsupervised')) {
                  teacher = 'Unsupervised';
                } else {
                  // Resolve teacher code via Master Faculty Map
                  const parts = cellVal.split(/\/|\band\b|,/gi).map(x => x.trim());
                  const resolvedTeachers = parts.map(p => {
                    const cleanP = p.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
                    const suffixMatch = p.match(/\s*(\([^)]*\))/);
                    const suffix = suffixMatch ? suffixMatch[1] : '';

                    if (MASTER_FACULTY_MAP[cleanP]) {
                      return MASTER_FACULTY_MAP[cleanP] + (suffix ? ` ${suffix}` : '');
                    }
                    return p;
                  });
                  teacher = resolvedTeachers.join(' / ');
                }

                periodsList.push({
                  period: m.p,
                  subject: subject,
                  teacher: teacher,
                  room: room
                });
              });

              daysData[mappedDay] = periodsList;
            }
          }
        }

        if (Object.keys(daysData).length > 0) {
          if (!timetables[course]) timetables[course] = {};
          if (!timetables[course][sem]) timetables[course][sem] = {};
          timetables[course][sem][sec] = daysData;
        }
      }
    }
  });
}

// Execute parsing on both files
parseWorkbook(FILE_1);
parseWorkbook(FILE_2);

// Save parsed data to src/data/timetables.json
fs.writeFileSync('src/data/timetables.json', JSON.stringify(timetables, null, 2));
console.log('Official Excel parsing complete! timetables.json updated successfully.');
