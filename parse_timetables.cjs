const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('Time Table wef 9-2-2026 students.xlsx');

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const FULL_DAYS = {
  "Mon": "Monday",
  "Tue": "Tuesday",
  "Wed": "Wednesday",
  "Thu": "Thursday",
  "Fri": "Friday"
};

// Course subjects database for fallbacks
const SUBJECT_FALLBACKS = {
  "BMS": {
    "2": "Management Studies Core",
    "4": "Management Studies Core",
    "6": "Management Studies Core",
    "8": "Management Studies Core"
  },
  "BBA(FIA)": {
    "2": "Financial Investment Analysis",
    "4": "Financial Investment Analysis",
    "6": "Financial Investment Analysis",
    "8": "Financial Investment Analysis"
  }
};

const timetables = {};

// Helper to clean strings
const clean = (s) => String(s || '').trim();

// Sheets to parse
const sheetsToParse = [
  { name: 'BBA(FIA) Sem2', defaultCourse: 'BBA FIA', defaultSem: '2' },
  { name: 'BMS Sem2', defaultCourse: 'BMS', defaultSem: '2' },
  { name: 'BBA(FIA) Sem4', defaultCourse: 'BBA FIA', defaultSem: '4' },
  { name: 'BMS Sem-4', defaultCourse: 'BMS', defaultSem: '4' },
  { name: 'BBA(FIA) Sem6', defaultCourse: 'BBA FIA', defaultSem: '6' },
  { name: 'BMS Sem6', defaultCourse: 'BMS', defaultSem: '6' },
  { name: 'BMS BBA Sem8', defaultCourse: 'BMS', defaultSem: '8' } // Combined sheet
];

sheetsToParse.forEach(({ name, defaultCourse, defaultSem }) => {
  const sheet = workbook.Sheets[name];
  if (!sheet) return;
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Find all start rows of timetable blocks
  const blockStarts = [];
  data.forEach((row, idx) => {
    const rowStr = row.map(c => clean(c)).join(' ');
    if (rowStr.includes('SHAHEED SUKHDEV COLLEGE OF BUSINESS STUDIES') || rowStr.includes('SHAHEED SUKHDEV COLLEGE OF')) {
      blockStarts.push(idx);
    }
  });

  console.log(`Sheet: ${name}, Blocks found at rows:`, blockStarts);

  blockStarts.forEach((startRow, bIdx) => {
    // Look ahead 10 rows to determine course, sem, and section
    let course = defaultCourse;
    let sem = defaultSem;
    let section = 'A';
    
    // Inspect next 5 rows for metadata
    for (let i = 1; i < 5; i++) {
      const row = data[startRow + i] || [];
      const rowStr = row.map(c => clean(c)).join(' ');
      
      // Course check
      if (rowStr.includes('BBA(FIA)') || rowStr.includes('BBA (FIA)')) {
        course = 'BBA FIA';
      } else if (rowStr.includes('BMS')) {
        course = 'BMS';
      }
      
      // Semester check
      const semMatch = rowStr.match(/(\d+)(?:st|nd|rd|th)?\s*Sem/i) || rowStr.match(/Sem\s*[-]?\s*(\d+)/i) || rowStr.match(/(\d+)\s*Year/i);
      if (semMatch) {
        sem = semMatch[1];
      }
      
      // Section check
      const secMatch = rowStr.match(/Section\s*([A-D])/i) || rowStr.match(/Sec\s*([A-D])/i) || rowStr.match(/\b([A-D])\b/);
      if (secMatch) {
        section = secMatch[1];
      }
    }

    console.log(`  Block ${bIdx}: Mapped to ${course} Sem ${sem} Section ${section}`);

    // Find the period headers row (has "Infinity Hour" or "I", "II", "III")
    let periodRowIdx = -1;
    let timingsRowIdx = -1;

    for (let i = 2; i < 8; i++) {
      const row = data[startRow + i] || [];
      const rowStr = row.map(c => clean(c)).join(' ');
      if (rowStr.includes('Infinity Hour') || (rowStr.includes('I') && rowStr.includes('II') && rowStr.includes('III'))) {
        periodRowIdx = startRow + i;
        timingsRowIdx = periodRowIdx + 1;
        break;
      }
    }

    if (periodRowIdx === -1) {
      console.log(`    Could not find period headers row for Block ${bIdx}`);
      return;
    }

    // Read classes for Mon-Fri
    const dayRows = {};
    for (let i = 1; i <= 8; i++) {
      const row = data[timingsRowIdx + i] || [];
      const dayLabel = clean(row[0]);
      if (DAYS.includes(dayLabel)) {
        dayRows[dayLabel] = row;
      }
    }

    // Find paper mappings under the table (typically starts within 10-35 rows after timingsRowIdx)
    const facultyMap = {};
    const paperNameMap = {}; // mapping of code/shorthand to paper name
    
    // Scan rows from timingsRowIdx + 8 to timingsRowIdx + 30
    for (let r = timingsRowIdx + 7; r < timingsRowIdx + 32; r++) {
      const row = data[r] || [];
      const rowStr = row.map(c => clean(c)).join(' ');
      
      // Skip if we hit the next block
      if (rowStr.includes('SHAHEED SUKHDEV COLLEGE OF BUSINESS STUDIES')) {
        break;
      }

      // Check if it looks like a paper mapping row
      // Example row: ['Core', 'Cost and Management Accounting', '', '', '', 'Dr. Paridhi', '', 'Paridhi', '3 Th, 2 Tute']
      const nonEmpties = row.map(c => clean(c)).filter(Boolean);
      if (nonEmpties.length >= 3) {
        const type = clean(row[0]);
        const paperName = clean(row[1]);
        
        // Find faculty code and faculty name
        let facultyName = '';
        let facultyCode = '';
        
        // Walk through cells to find teacher information
        for (let c = 2; c < row.length; c++) {
          const val = clean(row[c]);
          if (val.startsWith('Dr.') || val.startsWith('Mr.') || val.startsWith('Ms.') || val.startsWith('Prof.')) {
            facultyName = val;
            // The code is usually the next non-empty cell
            for (let c2 = c + 1; c2 < row.length; c2++) {
              const codeVal = clean(row[c2]);
              if (codeVal && !codeVal.includes('Th') && !codeVal.includes('Prac') && !codeVal.includes('Tute')) {
                facultyCode = codeVal;
                break;
              }
            }
            break;
          }
        }

        if (facultyCode && paperName) {
          facultyMap[facultyCode.toLowerCase()] = { facultyName, paperName };
        }
      }
    }

    console.log(`    Found ${Object.keys(facultyMap).length} faculty mappings`);

    // Process daily timetable
    const weekSchedule = {};
    DAYS.forEach(day => {
      const fullDayName = FULL_DAYS[day];
      const row = dayRows[day] || [];
      const dayClasses = [];

      // Columns map:
      // Column 1 -> Period I
      // Column 2 -> Period II
      // Column 3 -> Period III
      // Column 4 -> Infinity Hour
      // Column 5 -> Period IV
      // Column 6 -> Period V
      // Column 7 -> Period VI
      // Column 8 -> Period VII
      const periodColumns = [
        { id: 1, col: 1 },
        { id: 2, col: 2 },
        { id: 3, col: 3 },
        { id: 0, col: 4, isBreak: true },
        { id: 4, col: 5 },
        { id: 5, col: 6 },
        { id: 6, col: 7 },
        { id: 7, col: 8 }
      ];

      periodColumns.forEach(({ id, col, isBreak }) => {
        if (isBreak) {
          dayClasses.push({ period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" });
          return;
        }

        const cellValue = clean(row[col]);
        
        if (!cellValue) {
          dayClasses.push({ period: id, subject: "Free / Study Slot", teacher: "-", room: "-" });
          return;
        }

        // Parse cellValue (e.g. "Raj (703/326)" or "Krishna" or "SP G1 /Paridhi G2(236)")
        let teacherCode = cellValue;
        let room = "Room 703"; // Default room if not specified
        
        // Extract room number in parentheses, e.g. (703) or (236)
        const roomMatch = cellValue.match(/\(([^)]+)\)/);
        if (roomMatch) {
          const roomVal = roomMatch[1];
          room = roomVal.match(/^\d+/) ? `Room ${roomVal}` : roomVal;
          teacherCode = cellValue.replace(/\([^)]+\)/, '').trim();
        }

        // Check if there are multiple teachers split by slash, e.g. "SP G1 /Paridhi G2"
        const teacherCodeLower = teacherCode.toLowerCase();
        let matchedSubject = "";
        let matchedTeacher = teacherCode;

        // Try to match teacher code in our extracted mappings
        // First try exact match
        let foundMatch = facultyMap[teacherCodeLower];
        if (!foundMatch) {
          // Try partial match (e.g. "paridhi g2" contains "paridhi")
          const keys = Object.keys(facultyMap);
          for (let k of keys) {
            if (teacherCodeLower.includes(k) || k.includes(teacherCodeLower)) {
              foundMatch = facultyMap[k];
              break;
            }
          }
        }

        if (foundMatch) {
          matchedSubject = foundMatch.paperName;
          matchedTeacher = foundMatch.facultyName;
        } else {
          // Fallbacks for general/unsupervised activities
          if (teacherCodeLower.includes('unsupervised') || teacherCodeLower.includes('unsuprvised')) {
            matchedSubject = "Self Study Slot";
            matchedTeacher = "-";
          } else if (teacherCodeLower.includes('free') || teacherCodeLower === 'ei' || teacherCodeLower === 'ee') {
            matchedSubject = "General Activity / Core Seminar";
            matchedTeacher = "-";
          } else {
            matchedSubject = teacherCode; // Fallback to raw code
          }
        }

        dayClasses.push({
          period: id,
          subject: matchedSubject,
          teacher: matchedTeacher,
          room: room
        });
      });

      weekSchedule[fullDayName] = dayClasses;
    });

    // Save in master object
    if (!timetables[course]) timetables[course] = {};
    if (!timetables[course][sem]) timetables[course][sem] = {};
    timetables[course][sem][section] = weekSchedule;
  });
});

// Add BSc Computer Science realistic timetables as mock backup (since not in XLSX)
const csSubjects = {
  2: [
    { name: "Data Structures", code: "Core" },
    { name: "Discrete Mathematical Structures", code: "Core" },
    { name: "Computer System Architecture", code: "Core" },
    { name: "GE - Numerical Methods", code: "GE" },
    { name: "SEC - Web Design and Development", code: "SEC" },
    { name: "VAC - Digital Empowerment", code: "VAC" }
  ],
  4: [
    { name: "Design & Analysis of Algorithms", code: "Core" },
    { name: "Database Management Systems", code: "Core" },
    { name: "Computer Networks", code: "Core" },
    { name: "DSE - Artificial Intelligence", code: "DSE" },
    { name: "SEC - Programming with Python", code: "SEC" },
    { name: "VAC - Cyber Security", code: "VAC" }
  ],
  6: [
    { name: "Software Engineering", code: "Core" },
    { name: "Operating Systems", code: "Core" },
    { name: "Theory of Computation", code: "Core" },
    { name: "DSE - Machine Learning", code: "DSE" },
    { name: "GE - Data Science using R", code: "GE" }
  ],
  8: [
    { name: "Information Security", code: "Core" },
    { name: "DSE - Cloud Computing", code: "DSE" },
    { name: "DSE - Internet of Things (IoT)", code: "DSE" },
    { name: "SEC - Capstone Project", code: "SEC" }
  ]
};

timetables["Bsc Comp Sci"] = {};
const csTeachers = ["Dr. Mona Verma", "Dr. Amit Kumar", "Dr. Tarannum Ahmad", "Mr. Tatkarsh", "Dr. Narander Kumar Nigam", "Ms. Monika"];
const csRooms = ["Room 651", "Room 644", "Room 326", "Room 237"];

["2", "4", "6", "8"].forEach(sem => {
  timetables["Bsc Comp Sci"][sem] = {};
  
  // Section A
  const weekSchedule = {};
  const subjects = csSubjects[sem];
  
  ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].forEach((day, dIdx) => {
    const dayClasses = [];
    const seed = parseInt(sem) + dIdx;
    
    const periodColumns = [
      { id: 1 }, { id: 2 }, { id: 3 }, { id: 0, isBreak: true }, { id: 4 }, { id: 5 }, { id: 6 }, { id: 7 }
    ];

    periodColumns.forEach(({ id, isBreak }) => {
      if (isBreak) {
        dayClasses.push({ period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" });
        return;
      }

      const classSeed = seed + id;
      const isFree = (classSeed % 6 === 0) && (id > 5 || id === 1);
      
      if (isFree) {
        dayClasses.push({ period: id, subject: "Free / Study Slot", teacher: "-", room: "-" });
      } else {
        const subIndex = classSeed % subjects.length;
        const teachIndex = (classSeed + 2) % csTeachers.length;
        const roomIndex = (classSeed + 4) % csRooms.length;
        
        dayClasses.push({
          period: id,
          subject: subjects[subIndex].name,
          teacher: csTeachers[teachIndex],
          room: csRooms[roomIndex]
        });
      }
    });

    weekSchedule[day] = dayClasses;
  });

  timetables["Bsc Comp Sci"][sem]["A"] = weekSchedule;
});

// Output the full database into src/data/timetables.json
fs.writeFileSync('src/data/timetables.json', JSON.stringify(timetables, null, 2));
console.log('Successfully wrote parsed timetables into src/data/timetables.json');
