const XLSX = require('xlsx');
const fs = require('fs');

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const FULL_DAYS = {
  "Mon": "Monday",
  "Tue": "Tuesday",
  "Wed": "Wednesday",
  "Thu": "Thursday",
  "Fri": "Friday"
};

const timetables = {};

const clean = (s) => String(s || '').trim();

function splitOutsideParentheses(str) {
  const parts = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    
    if (char === '/' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts.filter(p => p.length > 0);
}

function parseUnifiedCell(cellValue, periodId, facultyMap, defaultRoom) {
  if (!cellValue) {
    return { period: periodId, subject: "Free", teacher: "-", room: "-" };
  }

  const isPracticalCell = /\b\(P\)\b/i.test(cellValue) || /\bPractical\b/i.test(cellValue) || /\bLab\b/i.test(cellValue) || cellValue.trim().endsWith('(P)');

  const parts = splitOutsideParentheses(cellValue);
  if (parts.length > 1) {
    const parsedParts = [];

    parts.forEach(part => {
      let partText = part.trim();
      let partRoom = defaultRoom;

      let groupLabel = "";
      const parenGroupMatch = partText.match(/\(((?:G1\s*\+\s*G2)|G1|G2)\)/i);
      if (parenGroupMatch) {
        groupLabel = parenGroupMatch[1].toUpperCase().replace(/\s+/g, '');
        partText = partText.replace(/\(((?:G1\s*\+\s*G2)|G1|G2)\)/i, '').trim();
      } else {
        const rawGroupMatch = partText.match(/\b((?:G1\s*\+\s*G2)|G1|G2)\b/i);
        if (rawGroupMatch) {
          groupLabel = rawGroupMatch[1].toUpperCase().replace(/\s+/g, '');
          partText = partText.replace(/\b((?:G1\s*\+\s*G2)|G1|G2)\b/i, '').trim();
        }
      }

      const partRoomMatch = partText.match(/\(([^)]+)\)/);
      if (partRoomMatch) {
        const roomVal = partRoomMatch[1].trim();
        if (roomVal.toUpperCase() === 'P' || roomVal.toLowerCase() === 'practical') {
          partText = partText.replace(/\([^)]+\)/, '').trim();
        } else {
          partRoom = roomVal.split('/').map(r => {
            let rClean = r.trim();
            return rClean.match(/^\d+/) ? `Room ${rClean}` : rClean;
          }).join(' / ');
          partText = partText.replace(/\([^)]+\)/, '').trim();
        }
      } else {
        const labRoomMatch = partText.match(/Lab\s*(\d{3})/i) || partText.match(/Room\s*(\d{3})/i) || partText.match(/\s+(\d{3})$/);
        if (labRoomMatch) {
          partRoom = `Room ${labRoomMatch[1]}`;
          partText = partText.replace(/Lab\s*\d{3}/i, '').replace(/Room\s*\d{3}/i, '').replace(/\s+\d{3}$/, '').trim();
        }
      }

      if (partRoom.toUpperCase() === 'ROOM P' || partRoom.toUpperCase() === 'P') {
        partRoom = defaultRoom;
      }

      const teacherCodeLower = partText.trim().toLowerCase();
      let subjectName = partText.trim();
      let teacherName = partText.trim();

      let found = facultyMap[teacherCodeLower];
      if (!found) {
        const keys = Object.keys(facultyMap);
        for (let k of keys) {
          if (teacherCodeLower === k || teacherCodeLower.startsWith(k + ' ') || teacherCodeLower.endsWith(' ' + k) || teacherCodeLower.includes(k)) {
            found = facultyMap[k];
            break;
          }
        }
      }

      if (found) {
        subjectName = found.paperName;
        teacherName = found.facultyName;
      } else {
        if (teacherCodeLower.includes('unsupervised') || teacherCodeLower.includes('unsuprvised')) {
          subjectName = "Free";
          teacherName = "-";
        } else if (teacherCodeLower.includes('free') || teacherCodeLower === 'ei' || teacherCodeLower === 'ee') {
          subjectName = "Unsupervised Class";
          teacherName = "-";
        }
      }

      parsedParts.push({
        group: groupLabel,
        subject: subjectName,
        teacher: teacherName,
        room: partRoom
      });
    });

    let subjectMerged = "";
    let teacherMerged = "";
    let roomMerged = "";

    const allSubjectsSame = parsedParts.every(p => p.subject === parsedParts[0].subject);
    const allRoomsSame = parsedParts.every(p => p.room === parsedParts[0].room);
    const hasAnyGroup = parsedParts.some(p => p.group);

    if (allSubjectsSame) {
      subjectMerged = parsedParts[0].subject;
      teacherMerged = parsedParts.map(p => {
        return hasAnyGroup ? `${p.teacher} (${p.group || 'G?'})` : p.teacher;
      }).join(' / ');
    } else {
      subjectMerged = parsedParts.map(p => {
        return hasAnyGroup ? `${p.group || 'G?'}: ${p.subject}` : p.subject;
      }).join(' | ');
      teacherMerged = parsedParts.map(p => {
        return hasAnyGroup ? `${p.teacher} (${p.group || 'G?'})` : p.teacher;
      }).join(' / ');
    }

    if (allRoomsSame) {
      roomMerged = parsedParts[0].room;
    } else {
      roomMerged = parsedParts.map(p => {
        return hasAnyGroup ? `${p.group || 'G?'}: ${p.room}` : p.room;
      }).join(' / ');
    }

    const res = {
      period: periodId,
      subject: subjectMerged,
      teacher: teacherMerged,
      room: roomMerged
    };
    if (isPracticalCell) {
      res.isPractical = true;
    }
    return res;
  } else {
    // Single part
    let text = cellValue.trim();
    let room = defaultRoom;

    let groupLabel = "";
    const parenGroupMatch = text.match(/\(((?:G1\s*\+\s*G2)|G1|G2)\)/i);
    if (parenGroupMatch) {
      groupLabel = parenGroupMatch[1].toUpperCase().replace(/\s+/g, '');
      text = text.replace(/\(((?:G1\s*\+\s*G2)|G1|G2)\)/i, '').trim();
    } else {
      const rawGroupMatch = text.match(/\b((?:G1\s*\+\s*G2)|G1|G2)\b/i);
      if (rawGroupMatch) {
        groupLabel = rawGroupMatch[1].toUpperCase().replace(/\s+/g, '');
        text = text.replace(/\b((?:G1\s*\+\s*G2)|G1|G2)\b/i, '').trim();
      }
    }

    const roomMatch = text.match(/\(([^)]+)\)/);
    if (roomMatch) {
      const roomVal = roomMatch[1].trim();
      if (roomVal.toUpperCase() === 'P' || roomVal.toLowerCase() === 'practical') {
        text = text.replace(/\([^)]+\)/, '').trim();
      } else {
        room = roomVal.split('/').map(r => {
          let rClean = r.trim();
          return rClean.match(/^\d+/) ? `Room ${rClean}` : rClean;
        }).join(' / ');
        text = text.replace(/\([^)]+\)/, '').trim();
      }
    } else {
      const labRoomMatch = text.match(/Lab\s*(\d{3})/i) || text.match(/Room\s*(\d{3})/i) || text.match(/\s+(\d{3})$/);
      if (labRoomMatch) {
        room = `Room ${labRoomMatch[1]}`;
        text = text.replace(/Lab\s*\d{3}/i, '').replace(/Room\s*\d{3}/i, '').replace(/\s+\d{3}$/, '').trim();
      }
    }

    if (room.toUpperCase() === 'ROOM P' || room.toUpperCase() === 'P') {
      room = defaultRoom;
    }

    const teacherCodeLower = text.toLowerCase();
    let subjectName = text;
    let teacherName = text;

    let found = facultyMap[teacherCodeLower];
    if (!found) {
      const keys = Object.keys(facultyMap);
      for (let k of keys) {
        if (teacherCodeLower === k || teacherCodeLower.startsWith(k + ' ') || teacherCodeLower.endsWith(' ' + k) || teacherCodeLower.includes(k)) {
          found = facultyMap[k];
          break;
        }
      }
    }

    if (found) {
      subjectName = found.paperName;
      teacherName = found.facultyName;
    } else {
      if (teacherCodeLower.includes('unsupervised') || teacherCodeLower.includes('unsuprvised')) {
        subjectName = "Free";
        teacherName = "-";
      } else if (teacherCodeLower.includes('free') || teacherCodeLower === 'ei' || teacherCodeLower === 'ee') {
        subjectName = "Unsupervised Class";
        teacherName = "-";
      }
    }

    if (groupLabel) {
      subjectName = `${subjectName} (${groupLabel})`;
    }

    const res = {
      period: periodId,
      subject: subjectName,
      teacher: teacherName,
      room: room
    };
    if (isPracticalCell) {
      res.isPractical = true;
    }
    return res;
  }
}

// 1. PARSE BBA & BMS WORKBOOK (`TT_wef  05.08.2026.xlsx`)
console.log('--- Processing TT_wef  05.08.2026.xlsx ---');
const wbBBA = XLSX.readFile('TT_wef  05.08.2026.xlsx');

const bbaSheets = [
  { name: 'BMS Sem-1', defaultCourse: 'BMS', defaultSem: '1' },
  { name: 'BBA Sem-1', defaultCourse: 'BBA FIA', defaultSem: '1' },
  { name: 'BMS Sem-3', defaultCourse: 'BMS', defaultSem: '3' },
  { name: 'BBA Sem-3', defaultCourse: 'BBA FIA', defaultSem: '3' },
  { name: 'BMS Sem-5', defaultCourse: 'BMS', defaultSem: '5' },
  { name: 'BBA Sem-5', defaultCourse: 'BBA FIA', defaultSem: '5' },
  { name: 'BMS & BBA Sem-7', defaultCourse: 'BMS', defaultSem: '7' }
];

bbaSheets.forEach(({ name, defaultCourse, defaultSem }) => {
  const sheet = wbBBA.Sheets[name];
  if (!sheet) return;
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const blockStarts = [];
  data.forEach((row, idx) => {
    const rowStr = row.map(c => clean(c)).join(' ');
    if (rowStr.includes('SHAHEED SUKHDEV COLLEGE OF BUSINESS STUDIES') || rowStr.includes('SHAHEED SUKHDEV COLLEGE OF')) {
      blockStarts.push(idx);
    }
  });

  blockStarts.forEach((startRow, bIdx) => {
    let course = defaultCourse;
    let sem = defaultSem;
    let section = 'A';
    let defaultRoom = 'Room 703';

    for (let i = 1; i < 6; i++) {
      const row = data[startRow + i] || [];
      const rowStr = row.map(c => clean(c)).join(' ');

      if (rowStr.includes('BBA(FIA)') || rowStr.includes('BBA (FIA)') || rowStr.includes('BBA')) {
        course = 'BBA FIA';
      } else if (rowStr.includes('BMS')) {
        course = 'BMS';
      }

      const semMatch = rowStr.match(/Sem\s*[-:\s]?\s*(\d+)/i) || rowStr.match(/(\d+)(?:st|nd|rd|th)?\s*Sem/i);
      if (semMatch) {
        sem = semMatch[1];
      }

      const secMatch = rowStr.match(/Section\s*([A-D])/i) || rowStr.match(/Sec\s*([A-D])/i);
      if (secMatch) {
        section = secMatch[1];
      }

      const roomMatch = rowStr.match(/Room\s*No\.?\s*(\d{3})/i) || rowStr.match(/Room\s*No\.?\s*:?\s*([A-Za-z0-9]+)/i);
      if (roomMatch) {
        defaultRoom = `Room ${roomMatch[1].trim()}`;
      }
    }

    let periodRowIdx = -1;
    let timingsRowIdx = -1;

    for (let i = 2; i < 9; i++) {
      const row = data[startRow + i] || [];
      const rowStr = row.map(c => clean(c)).join(' ');
      if (rowStr.includes('Infinity Hour') || (rowStr.includes('I') && rowStr.includes('II') && rowStr.includes('III'))) {
        periodRowIdx = startRow + i;
        timingsRowIdx = periodRowIdx + 1;
        break;
      }
    }

    if (periodRowIdx === -1) return;

    const dayRows = {};
    for (let r = timingsRowIdx + 1; r <= timingsRowIdx + 10; r++) {
      const row = data[r] || [];
      for (let c = 0; c < row.length; c++) {
        const val = clean(row[c]);
        if (DAYS.includes(val)) {
          dayRows[val] = { row, dayCol: c };
          break;
        }
      }
    }

    const facultyMap = {};
    for (let r = timingsRowIdx + 7; r < timingsRowIdx + 35; r++) {
      const row = data[r] || [];
      const rowStr = row.map(c => clean(c)).join(' ');

      if (rowStr.includes('SHAHEED SUKHDEV COLLEGE OF BUSINESS STUDIES')) {
        break;
      }

      let paperName = '';
      let facultyName = '';
      let facultyCode = '';

      for (let c = 0; c < row.length; c++) {
        const val = clean(row[c]);
        if (val.startsWith('Dr.') || val.startsWith('Mr.') || val.startsWith('Ms.') || val.startsWith('Prof.')) {
          facultyName = val;
          for (let p = c - 1; p >= 0; p--) {
            const pVal = clean(row[p]);
            if (pVal && pVal !== 'Core' && pVal !== 'GE' && pVal !== 'SEC' && pVal !== 'VAC' && pVal !== 'AEC' && !pVal.match(/^\d+$/)) {
              paperName = pVal;
              break;
            }
          }
          for (let codeIdx = c + 1; codeIdx < row.length; codeIdx++) {
            const codeVal = clean(row[codeIdx]);
            if (codeVal && !codeVal.includes('Th') && !codeVal.includes('Prac') && !codeVal.includes('Tute') && !codeVal.includes('Load')) {
              facultyCode = codeVal;
              break;
            }
          }
          break;
        }
      }

      if (facultyCode && paperName && facultyName) {
        facultyMap[facultyCode.toLowerCase()] = { facultyName, paperName };
      }
    }

    const weekSchedule = {};
    DAYS.forEach(day => {
      const fullDayName = FULL_DAYS[day];
      const dayInfo = dayRows[day];
      const dayClasses = [];

      const periodColumns = [
        { id: 1, relCol: 1 },
        { id: 2, relCol: 2 },
        { id: 3, relCol: 3 },
        { id: 0, relCol: 4, isBreak: true },
        { id: 4, relCol: 5 },
        { id: 5, relCol: 6 },
        { id: 6, relCol: 7 },
        { id: 7, relCol: 8 }
      ];

      periodColumns.forEach(({ id, relCol, isBreak }) => {
        if (isBreak) {
          dayClasses.push({ period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" });
          return;
        }

        if (!dayInfo) {
          dayClasses.push({ period: id, subject: "Free", teacher: "-", room: "-" });
          return;
        }

        const cellValue = clean(dayInfo.row[dayInfo.dayCol + relCol]);
        const parsedCell = parseUnifiedCell(cellValue, id, facultyMap, defaultRoom);
        dayClasses.push(parsedCell);
      });

      weekSchedule[fullDayName] = dayClasses;
    });

    if (!timetables[course]) timetables[course] = {};
    if (!timetables[course][sem]) timetables[course][sem] = {};
    timetables[course][sem][section] = weekSchedule;
    console.log(`  Parsed ${course} Sem ${sem} Sec ${section} (${defaultRoom}) - Faculty mappings: ${Object.keys(facultyMap).length}`);
  });
});

// 2. PARSE BSC COMP SCI WORKBOOK (`TT_JULY 2026 (1).xlsx`)
console.log('\n--- Processing TT_JULY 2026 (1).xlsx ---');
const wbBSC = XLSX.readFile('TT_JULY 2026 (1).xlsx');
const bscSheet = wbBSC.Sheets['Classwise'];

if (bscSheet) {
  const data = XLSX.utils.sheet_to_json(bscSheet, { header: 1 });
  const blockStarts = [];
  data.forEach((row, idx) => {
    const rowStr = row.map(c => clean(c)).join(' ');
    if (rowStr.includes('SHAHEED SUKHDEV COLLEGE OF BUSINESS STUDIES') || rowStr.includes('SHAHEED SUKHDEV COLLEGE OF')) {
      blockStarts.push(idx);
    }
  });

  blockStarts.forEach((startRow, bIdx) => {
    let sem = '1';
    let defaultRoom = 'Room 607';

    for (let i = 1; i < 6; i++) {
      const row = data[startRow + i] || [];
      const rowStr = row.map(c => clean(c)).join(' ');

      const semMatch = rowStr.match(/Sem\s*[-:\s]?\s*(\d+)/i) || rowStr.match(/(\d+)(?:st|nd|rd|th)?\s*Sem/i);
      if (semMatch) {
        sem = semMatch[1];
      }

      for (let c = 0; c < row.length; c++) {
        const val = clean(row[c]);
        if (val.match(/^\d{3}$/)) {
          defaultRoom = `Room ${val}`;
          break;
        }
      }
    }

    let periodRowIdx = -1;
    let timingsRowIdx = -1;

    for (let i = 2; i < 9; i++) {
      const row = data[startRow + i] || [];
      const rowStr = row.map(c => clean(c)).join(' ');
      if (rowStr.includes('Infinity Hour') || (rowStr.includes('I') && rowStr.includes('II') && rowStr.includes('III'))) {
        periodRowIdx = startRow + i;
        timingsRowIdx = periodRowIdx + 1;
        break;
      }
    }

    if (periodRowIdx === -1) return;

    const dayRows = {};
    for (let r = timingsRowIdx + 1; r <= timingsRowIdx + 10; r++) {
      const row = data[r] || [];
      for (let c = 0; c < row.length; c++) {
        const val = clean(row[c]);
        if (DAYS.includes(val)) {
          dayRows[val] = { row, dayCol: c };
          break;
        }
      }
    }

    const facultyMap = {};
    for (let r = timingsRowIdx + 7; r < timingsRowIdx + 30; r++) {
      const row = data[r] || [];
      const rowStr = row.map(c => clean(c)).join(' ');

      if (rowStr.includes('SHAHEED SUKHDEV COLLEGE OF BUSINESS STUDIES')) {
        break;
      }

      const paperName = clean(row[1]);
      let facultyName = '';
      let facultyCode = '';

      for (let c = 2; c < row.length; c++) {
        const val = clean(row[c]);
        if (val && (val.includes('Dr.') || val.includes('Mr.') || val.includes('Ms.') || val.includes('Prof.') || val.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+/))) {
          if (!val.includes('DSC') && !val.includes('DSE') && !val.includes('AECC') && !val.includes('SEC') && !val.includes('VAC') && !val.includes('Course')) {
            facultyName = val;
            for (let c2 = c + 1; c2 < row.length; c2++) {
              const codeVal = clean(row[c2]);
              if (codeVal && !codeVal.match(/^\d+$/) && codeVal !== 'Classes') {
                facultyCode = codeVal;
                break;
              }
            }
            break;
          }
        }
      }

      if (facultyCode && paperName && facultyName) {
        facultyMap[facultyCode.toLowerCase()] = { facultyName, paperName };
      }
    }

    const weekSchedule = {};
    DAYS.forEach(day => {
      const fullDayName = FULL_DAYS[day];
      const dayInfo = dayRows[day];
      const dayClasses = [];

      const periodColumns = [
        { id: 1, relCol: 1 },
        { id: 2, relCol: 2 },
        { id: 3, relCol: 3 },
        { id: 0, relCol: 4, isBreak: true },
        { id: 4, relCol: 5 },
        { id: 5, relCol: 6 },
        { id: 6, relCol: 7 },
        { id: 7, relCol: 8 }
      ];

      periodColumns.forEach(({ id, relCol, isBreak }) => {
        if (isBreak) {
          dayClasses.push({ period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" });
          return;
        }

        if (!dayInfo) {
          dayClasses.push({ period: id, subject: "Free", teacher: "-", room: "-" });
          return;
        }

        const cellValue = clean(dayInfo.row[dayInfo.dayCol + relCol]);
        const parsedCell = parseUnifiedCell(cellValue, id, facultyMap, defaultRoom);
        dayClasses.push(parsedCell);
      });

      weekSchedule[fullDayName] = dayClasses;
    });

    const course = 'Bsc Comp Sci';
    const section = 'A';
    if (!timetables[course]) timetables[course] = {};
    if (!timetables[course][sem]) timetables[course][sem] = {};
    timetables[course][sem][section] = weekSchedule;
  });
}

console.log('\n--- Writing output to src/data/timetables.json ---');
fs.writeFileSync('src/data/timetables.json', JSON.stringify(timetables, null, 2));
console.log('Successfully updated src/data/timetables.json!');
