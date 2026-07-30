const xlsx = require('c:/Users/adity/Downloads/SSCBS OS/node_modules/xlsx');
const fs = require('fs');

const FILE_1 = 'c:/Users/adity/Downloads/SSCBS OS/TT_wef _28.07.2026 .xlsx';
const FILE_2 = 'c:/Users/adity/Downloads/SSCBS OS/TT_JULY 2026.xlsx';

const DEFAULT_SECTION_ROOMS = {
  'BMS_Sem1_SecA': 'Room 703',
  'BMS_Sem1_SecB': 'Room 703',
  'BMS_Sem1_SecC': 'Room 703',
  'BMS_Sem1_SecD': 'Room 703',
  'BMS_Sem3_SecA': 'Room 703',
  'BMS_Sem3_SecB': 'Room 703',
  'BMS_Sem3_SecC': 'Room 703',
  'BMS_Sem3_SecD': 'Room 703',
  'BMS_Sem5_SecA': 'Room 703',
  'BMS_Sem5_SecB': 'Room 703',
  'BMS_Sem5_SecC': 'Room 703',
  'BMS_Sem5_SecD': 'Room 703',
  'BMS_Sem7_SecA': 'Room 523',
  'BBA FIA_Sem1_SecA': 'Room 503',
  'BBA FIA_Sem1_SecB': 'Room 503',
  'BBA FIA_Sem3_SecA': 'Room 503',
  'BBA FIA_Sem3_SecB': 'Room 503',
  'BBA FIA_Sem5_SecA': 'Room 503',
  'BBA FIA_Sem5_SecB': 'Room 507',
  'BBA FIA_Sem7_SecA': 'Room 533',
  'Bsc Comp Sci_Sem1_SecA': 'Room 403',
  'Bsc Comp Sci_Sem3_SecA': 'Room 407',
  'Bsc Comp Sci_Sem5_SecA': 'Room 457',
  'Bsc Comp Sci_Sem7_SecA': 'Room 435'
};

// Global Faculty Directory for clean display names
const FACULTY_DIRECTORY = {
  'aa': 'Dr. Anamika Agarwal',
  'ag': 'Anamika Gupta',
  'ayg': 'Ayushi Gupta',
  'dd': 'Dr. Deepali Dhaka',
  'am': 'Dr. Amit Kumar',
  'ta': 'Dr. Tarannum Ahmad',
  'mv': 'Dr. Mona Verma',
  'sj': 'Dr. Saumya Jain',
  'skg': 'Dr. Satish Kumar Garg',
  'sk': 'Mr. Praveen SK',
  'ps': 'Mr. Praveen SK',
  'kr': 'Kavita Rastogi',
  'krs': 'Dr. Kavita Rastogi',
  'os': 'Dr. Onkar Singh',
  'ng': 'Dr. Nidhi Kesari',
  'nb': 'Dr. Neha Sharma',
  'st': 'Dr. Sushmita',
  'ma': 'Dr. Mehak Aggarwal',
  'mn': 'Dr. Mona Verma',
  'azmi': 'Dr. Azmi Ahmad',
  'av': 'Dr. Amit Verma',
  'pa': 'Priyanka',
  'komal': 'Komal Sharma',
  'garima': 'Dr. Garima Tripathi',
  'vinayak': 'Vinayak',
  'nisha': 'Ms. Nisha Rajput',
  'vipin': 'Mr. Vipin Patel',
  'ishan': 'Ishan Jain',
  'ankit': 'Ankit',
  'seema': 'Seema',
  'mt': 'Dr. Madhu Totla',
  'sv': 'Shikha Verma',
  'nks': 'Dr. Narander Kumar Nigam',
  'mr': 'Mr. Raj Kumar',
  'tm': 'Mr. Tushar Marwaha',
  'paridhi': 'Paridhi',
  'shipra': 'Ms. Shipra Varshney',
  'guncha': 'Dr. Guncha',
  'sp': 'Dr. Shalini Prakash',
  'kb': 'Dr. Kumar Bijoy',
  'rk': 'Dr. Raj Kumar',
  'rohan': 'Mr. Rohan Gulati',
  'soumya': 'Dr. Soumya Guliyan',
  'monu': 'Dr. Monu',
  'ritika': 'Ritika',
  'bhavya': 'Bhavya',
  'kajol': 'Kajol',
  'twinkle': 'Twinkle',
  'vineet': 'Vineet',
  'ankita': 'Ankita',
  'ayesha': 'Ayesha',
  'tatkarsh': 'Mr. Tatkarsh',
  'monika': 'Ms. Monika',
  'vp': 'Mr. Vipin Patel',
  'nr': 'Ms. Nisha Rajput',
  'gs': 'Gautam Sharma',
  'rg': 'Mr. Rohan Gulati',
  'sg': 'Dr. Saumya Jain'
};

function buildMasterTimetable() {
  const masterData = {};

  const processFile = (filePath) => {
    const wb = xlsx.readFile(filePath);
    wb.SheetNames.forEach(sheetName => {
      const sheet = wb.Sheets[sheetName];
      const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

      // First pass: extract all blocks in this sheet
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

          const sectionKey = `${course}_Sem${sem}_Sec${sec}`;
          if (!defaultRoom) defaultRoom = DEFAULT_SECTION_ROOMS[`${course}_${sem}_${sec}`] || 'Room 703';

          // Extract section legend table
          const legendMap = {}; // code/name -> { paperName, facName }
          for (let l = r + 10; l < r + 45 && l < data.length; l++) {
            const lRow = data[l] || [];
            if (lRow.length >= 3) {
              const str = lRow.map(c => String(c || '').trim()).join(' ');
              if (str.includes('CLASS TIME TABLE')) break; // Next block start

              // Look for S. No. numeric rows
              const c0 = String(lRow[0] || '').trim();
              if (c0.match(/^\d+$/)) {
                // S. No | Paper Type | Paper Name | [empty] | Faculty Name | Faculty Code
                const nonEmpties = lRow.map(c => String(c || '').trim()).filter(Boolean);
                if (nonEmpties.length >= 3) {
                  let paperName = nonEmpties[2] || '';
                  let facName = nonEmpties[3] || '';
                  let facCode = nonEmpties[4] || facName;

                  if (paperName && facName) {
                    const cleanCode = facCode.replace(/\(.*\)/, '').trim().toLowerCase();
                    const cleanName = facName.replace(/\(.*\)/, '').trim().toLowerCase();
                    const info = { paperName, facName };
                    if (cleanCode) legendMap[cleanCode] = info;
                    if (cleanName) legendMap[cleanName] = info;
                  }
                }
              }
            }
          }

          // Parse grid days
          const daysData = {};
          const dayMap = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday' };
          const periodsMeta = [
            { p: 1, s: '09:00', e: '10:00' },
            { p: 2, s: '10:00', e: '11:00' },
            { p: 3, s: '11:00', e: '12:00' },
            { p: 4, s: '13:00', e: '14:00' },
            { p: 5, s: '14:00', e: '15:00' },
            { p: 6, s: '15:00', e: '16:00' },
            { p: 7, s: '16:00', e: '17:00' }
          ];

          for (let d = r + 1; d <= r + 20 && d < data.length; d++) {
            const dRow = data[d] || [];
            const firstCell = String(dRow[0] || '').trim();
            const dayMatch = firstCell.match(/^(Mon|Tue|Wed|Thu|Fri)/i);

            if (dayMatch) {
              const mappedDay = dayMap[dayMatch[1]];
              const periodCells = dRow.slice(1);
              const periodsList = [];

              // Skip Infinity Hour column (usually index 3)
              let cellIdx = 0;
              periodsMeta.forEach(m => {
                let cellVal = String(periodCells[cellIdx] || '').trim();
                cellIdx++;

                // Skip Infinity Hour if matched
                if (cellVal.toLowerCase().includes('infinity hour')) {
                  cellVal = String(periodCells[cellIdx] || '').trim();
                  cellIdx++;
                }

                if (!cellVal || cellVal === '-' || cellVal.toLowerCase() === 'off' || cellVal.toLowerCase() === 'free') {
                  periodsList.push({
                    period: m.p,
                    subject: 'Free',
                    teacher: '-',
                    room: '-'
                  });
                  return;
                }

                // Parse cell with '/' splits
                const splits = cellVal.split('/').map(x => x.trim()).filter(Boolean);
                const parsedSubjects = [];
                const parsedTeachers = [];
                const parsedRooms = [];

                splits.forEach(part => {
                  // Extract 3-digit room or specific room like 237, 607, 644, 648, 534, 361, 523, 651, Lab 460
                  let compRoom = defaultRoom;
                  const roomMatch = part.match(/\b([2-7]\d{2})\b/) || part.match(/Lab\s*(\d{3})/i);
                  if (roomMatch) {
                    compRoom = `Room ${roomMatch[1]}`;
                  }

                  // Extract group tag e.g. G1, G2
                  const grpMatch = part.match(/\b(G[1234])\b/i);
                  const grpPrefix = grpMatch ? `${grpMatch[1].toUpperCase()}: ` : '';

                  // Unsupervised check
                  if (part.toLowerCase().includes('unsupervised')) {
                    parsedTeachers.push(`${grpPrefix}Unsupervised`);
                    parsedSubjects.push(`${grpPrefix}Lab (Unsupervised)`);
                    parsedRooms.push(compRoom);
                    return;
                  }

                  // Match Legend Table for Paper Name & Teacher Name
                  let cleanPartKey = part.replace(/\s*\([^)]*\)/g, '').replace(/\b(G[1234])\b/gi, '').trim().toLowerCase();
                  let matchedInfo = legendMap[cleanPartKey];

                  // Fallback match in Global Directory
                  let facName = FACULTY_DIRECTORY[cleanPartKey] || part;
                  let paperName = matchedInfo ? matchedInfo.paperName : (cleanPartKey.length > 5 ? part : 'Active Class');

                  if (matchedInfo) {
                    facName = matchedInfo.facName || facName;
                    paperName = matchedInfo.paperName || paperName;
                  }

                  parsedSubjects.push(grpPrefix ? `${grpPrefix}${paperName}` : paperName);
                  parsedTeachers.push(grpPrefix ? `${grpPrefix}${facName}` : facName);
                  parsedRooms.push(compRoom);
                });

                // Deduplicate subjects and rooms for clean display
                const finalSubject = [...new Set(parsedSubjects)].join(' / ');
                const finalTeacher = [...new Set(parsedTeachers)].join(' / ');
                const finalRoom = [...new Set(parsedRooms)].join(' / ');

                periodsList.push({
                  period: m.p,
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
console.log('Build perfect timetable parser complete!');
