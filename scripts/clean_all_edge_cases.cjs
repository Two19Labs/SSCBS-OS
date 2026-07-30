const fs = require('fs');

const FILE_PATH = 'src/data/timetables.json';
const raw = fs.readFileSync(FILE_PATH, 'utf8');
const data = JSON.parse(raw);

const INITIALS_EXPANSION = {
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

let cleanedRoomsCount = 0;
let cleanedTeachersCount = 0;
let cleanedSubjectsCount = 0;

for (const course in data) {
  for (const sem in data[course]) {
    for (const sec in data[course][sem]) {
      for (const day in data[course][sem][sec]) {
        data[course][sem][sec][day] = data[course][sem][sec][day].map(c => {
          if (!c || c.isBreak) return c;

          let subject = (c.subject || '').trim();
          let teacher = (c.teacher || '').trim();
          let room = (c.room || '').trim();

          // 1. Extract 3-digit room numbers embedded in subject or teacher text
          const embeddedRoomMatch = subject.match(/\b([2-7]\d{2})(?:\/([2-7]\d{2}))?\b/) || teacher.match(/\b([2-7]\d{2})(?:\/([2-7]\d{2}))?\b/);
          if (embeddedRoomMatch) {
            const r1 = embeddedRoomMatch[1];
            const r2 = embeddedRoomMatch[2];
            const extractedRoom = r2 ? `Room ${r1} / Room ${r2}` : `Room ${r1}`;

            if (!room || room === 'P' || room === 'Tute' || room === '-' || room.includes('Merged')) {
              room = extractedRoom;
              cleanedRoomsCount++;
            }

            // Strip 3-digit room number from subject and teacher
            subject = subject.replace(/\s*\b[2-7]\d{2}(?:\/[2-7]\d{2})?\b/g, '').replace(/\(\s*\)/g, '').trim();
            teacher = teacher.replace(/\s*\b[2-7]\d{2}(?:\/[2-7]\d{2})?\b/g, '').replace(/\(\s*\)/g, '').trim();
            cleanedSubjectsCount++;
          }

          // 2. Clean subjects where teacher initials were put in subject field
          if (subject.includes('|')) {
            const parts = subject.split('|').map(p => p.trim());
            const realSubjects = parts.filter(p => !/^(?:g\d+:\s*)?[A-Z]{2,4}$/i.test(p) && !/^(?:g\d+:\s*)?(?:Seema|Komal|Garima|AM|MV|AV|KRS)$/i.test(p));
            if (realSubjects.length > 0 && realSubjects.length < parts.length) {
              subject = realSubjects.join(' | ');
              cleanedSubjectsCount++;
            }
          }

          // 3. Expand teacher initials
          if (teacher && teacher !== '-' && teacher !== 'Unsupervised') {
            const parts = teacher.split(/\/|\band\b|,/gi).map(p => p.trim());
            const expanded = parts.map(p => {
              const cleanP = p.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
              const suffixMatch = p.match(/\s*(\([^)]*\))/);
              const suffix = suffixMatch ? suffixMatch[1] : '';
              if (INITIALS_EXPANSION[cleanP]) {
                cleanedTeachersCount++;
                return INITIALS_EXPANSION[cleanP] + (suffix ? ` ${suffix}` : '');
              }
              return p;
            });
            teacher = expanded.join(' / ');
          }

          // 4. Normalize room strings
          if (room === 'Hin A' || teacher.includes('Garima') && room.includes('Hin')) {
            room = 'Room 607';
          } else if (room === 'Hin C') {
            room = 'Room 644';
          } else if (room === 'Hin D') {
            room = 'Room 648';
          }

          return {
            ...c,
            subject,
            teacher,
            room
          };
        });
      }
    }
  }
}

fs.writeFileSync(FILE_PATH, JSON.stringify(data, null, 2));
console.log(`Deep Cleanup Complete: Cleaned ${cleanedRoomsCount} rooms, ${cleanedTeachersCount} teachers, ${cleanedSubjectsCount} subjects in timetables.json!`);
