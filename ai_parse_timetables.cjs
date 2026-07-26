const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read .env file manually if exists
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...vals] = trimmed.split('=');
        const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
        if (key.trim() && !process.env[key.trim()]) {
          process.env[key.trim()] = val;
        }
      }
    });
  }
}

loadEnv();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

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

// Format excel block as text for AI prompt
function formatBlockAsText(sheetName, blockRows) {
  let text = `=== SHEET: ${sheetName} ===\n`;
  blockRows.forEach((row, idx) => {
    const nonEmpties = row.map((c, colIdx) => c !== null && c !== undefined && String(c).trim() !== '' ? `[Col ${colIdx}]: ${String(c).trim()}` : null).filter(Boolean);
    if (nonEmpties.length > 0) {
      text += `Row ${idx}: ${nonEmpties.join(' | ')}\n`;
    }
  });
  return text;
}

// Call Gemini 1.5 Flash / 2.0 Flash API to parse block text into JSON schema
async function parseBlockWithAI(blockText, apiKey) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const systemInstruction = `You are an expert AI academic timetable parser for Shaheed Sukhdev College of Business Studies (SSCBS).
Your task is to parse a raw Excel timetable sheet block (which includes a schedule grid and paper/faculty legend) into a clean, structured JSON object.

RULES:
1. Identify course: "BMS", "BBA FIA", or "Bsc Comp Sci".
2. Identify semester number: "1", "3", "5", or "7".
3. Identify section label: "A", "B", "C", or "D" (Bsc Comp Sci is always "A").
4. Identify default room: e.g., "Room 703", "Room 407", etc.
5. Use the faculty & paper legend table under the grid to resolve faculty codes/initials (e.g., TA -> Dr. Tarannum Ahmad, MV -> Dr. Mona Verma) and paper codes to full Paper Names.
6. Return a complete weekly schedule for Monday, Tuesday, Wednesday, Thursday, Friday.
7. For each day, include 8 period slots in order:
   - Period 1 (9:00am - 10:00am)
   - Period 2 (10:00am - 11:00am)
   - Period 3 (11:00am - 12:00pm)
   - Period 0 (12:00pm - 1:00pm, Infinity Hour Break: { period: 0, isBreak: true, subject: "Infinity Hour (Break)", teacher: "", room: "" })
   - Period 4 (1:00pm - 2:00pm)
   - Period 5 (2:00pm - 3:00pm)
   - Period 6 (3:00pm - 4:00pm)
   - Period 7 (4:00pm - 5:00pm)
8. If a slot has split groups (e.g. G1/G2), merge subjects, teachers, and rooms clearly.
9. If a slot is empty or free, set subject: "Free", teacher: "-", room: "-".

OUTPUT REQUIREMENT:
Return ONLY valid raw JSON matching this structure (no markdown fences, no explanation):
{
  "course": "BMS",
  "semester": "1",
  "section": "A",
  "defaultRoom": "Room 703",
  "weekSchedule": {
    "Monday": [
      { "period": 1, "subject": "...", "teacher": "...", "room": "..." },
      ... 8 period objects ...
    ],
    "Tuesday": [ ... ],
    "Wednesday": [ ... ],
    "Thursday": [ ... ],
    "Friday": [ ... ]
  }
}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: systemInstruction + "\n\nRAW TIMETABLE BLOCK:\n" + blockText }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API Error (${res.status}): ${errText}`);
  }

  const resData = await res.json();
  const rawText = resData.candidates[0].content.parts[0].text;
  return JSON.parse(rawText);
}

// Zero-shot deterministic fallback parser when no API key is provided
function parseBlockFallback(sheetName, blockRows, defaultCourse, defaultSem) {
  let course = defaultCourse;
  let sem = defaultSem;
  let section = 'A';
  let defaultRoom = 'Room 703';

  for (let i = 0; i < Math.min(8, blockRows.length); i++) {
    const rowStr = blockRows[i].map(c => clean(c)).join(' ');
    if (rowStr.includes('BBA(FIA)') || rowStr.includes('BBA (FIA)') || rowStr.includes('BBA FIA')) course = 'BBA FIA';
    else if (rowStr.includes('BMS')) course = 'BMS';
    else if (rowStr.includes('COMPUTER SCIENCE') || rowStr.includes('B.SC.')) course = 'Bsc Comp Sci';

    const semMatch = rowStr.match(/Sem\s*[-:\s]?\s*(\d+)/i) || rowStr.match(/(\d+)(?:st|nd|rd|th)?\s*Sem/i);
    if (semMatch) sem = semMatch[1];

    const secMatch = rowStr.match(/Section\s*([A-D])/i) || rowStr.match(/Sec\s*([A-D])/i);
    if (secMatch) section = secMatch[1];

    for (let c = 0; c < blockRows[i].length; c++) {
      const val = clean(blockRows[i][c]);
      if (val.match(/^\d{3}$/)) {
        defaultRoom = `Room ${val}`;
        break;
      }
    }
  }

  let timingsRowIdx = -1;
  for (let i = 0; i < Math.min(10, blockRows.length); i++) {
    const rowStr = blockRows[i].map(c => clean(c)).join(' ');
    if (rowStr.includes('Infinity Hour') || (rowStr.includes('I') && rowStr.includes('II') && rowStr.includes('III'))) {
      timingsRowIdx = i + 1;
      break;
    }
  }

  if (timingsRowIdx === -1) timingsRowIdx = 6;

  const dayRows = {};
  for (let r = timingsRowIdx; r < Math.min(timingsRowIdx + 12, blockRows.length); r++) {
    const row = blockRows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const val = clean(row[c]);
      if (DAYS.includes(val)) {
        dayRows[val] = { row, dayCol: c };
        break;
      }
    }
  }

  const facultyMap = {};
  for (let r = timingsRowIdx + 6; r < blockRows.length; r++) {
    const row = blockRows[r] || [];
    let paperName = clean(row[1]) || clean(row[3]);
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
          if (codeVal && !codeVal.includes('Th') && !codeVal.includes('Prac') && !codeVal.includes('Tute') && !codeVal.includes('Load') && codeVal !== 'Classes') {
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

      const cellVal = clean(dayInfo.row[dayInfo.dayCol + relCol]);
      if (!cellVal) {
        dayClasses.push({ period: id, subject: "Free", teacher: "-", room: "-" });
        return;
      }

      let teacherCodeLower = cellVal.toLowerCase();
      let subjectName = cellVal;
      let teacherName = cellVal;

      let found = facultyMap[teacherCodeLower];
      if (!found) {
        for (let k of Object.keys(facultyMap)) {
          if (teacherCodeLower.includes(k)) {
            found = facultyMap[k];
            break;
          }
        }
      }

      if (found) {
        subjectName = found.paperName;
        teacherName = found.facultyName;
      }

      dayClasses.push({
        period: id,
        subject: subjectName,
        teacher: teacherName,
        room: defaultRoom
      });
    });

    weekSchedule[fullDayName] = dayClasses;
  });

  return { course, sem, section, defaultRoom, weekSchedule };
}

async function runParser() {
  console.log('🤖 Starting AI-Powered Timetable Parser...\n');
  if (GEMINI_API_KEY) {
    console.log('✨ Gemini API Key detected! Running AI model (gemini-1.5-flash) for dynamic parsing...\n');
  } else {
    console.log('💡 No GEMINI_API_KEY found in .env. Running smart fallback parser...');
    console.log('   To enable 100% AI-driven layout extraction: get a free key at https://aistudio.google.com and add GEMINI_API_KEY=your_key to .env\n');
  }

  // Files to process
  const files = [
    { file: 'TT wef  28.07.2026.xlsx', type: 'BBA_BMS' },
    { file: 'TT_JULY 2026.xlsx', type: 'BSC' }
  ];

  for (const { file, type } of files) {
    if (!fs.existsSync(file)) continue;
    console.log(`--- Processing Excel File: ${file} ---`);
    const wb = XLSX.readFile(file);

    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Find block boundaries
      const blockStarts = [];
      data.forEach((row, idx) => {
        const rowStr = row.map(c => clean(c)).join(' ');
        if (rowStr.includes('SHAHEED SUKHDEV COLLEGE OF BUSINESS STUDIES') || rowStr.includes('SHAHEED SUKHDEV COLLEGE OF')) {
          blockStarts.push(idx);
        }
      });

      if (blockStarts.length === 0) continue;

      for (let bIdx = 0; bIdx < blockStarts.length; bIdx++) {
        const startRow = blockStarts[bIdx];
        const nextStartRow = blockStarts[bIdx + 1] || data.length;
        const blockRows = data.slice(startRow, nextStartRow);

        let parsedBlock = null;

        if (GEMINI_API_KEY) {
          try {
            const blockText = formatBlockAsText(sheetName, blockRows);
            parsedBlock = await parseBlockWithAI(blockText, GEMINI_API_KEY);
            console.log(`  [AI Parsed] ${parsedBlock.course} Sem ${parsedBlock.semester} Sec ${parsedBlock.section} (${parsedBlock.defaultRoom})`);
          } catch (err) {
            console.warn(`  ⚠️ Gemini API parse failed for block ${bIdx + 1} (${err.message}). Using smart fallback...`);
            parsedBlock = parseBlockFallback(sheetName, blockRows, type === 'BSC' ? 'Bsc Comp Sci' : 'BMS', '1');
          }
        } else {
          parsedBlock = parseBlockFallback(sheetName, blockRows, type === 'BSC' ? 'Bsc Comp Sci' : 'BMS', '1');
          console.log(`  [Smart Parsed] ${parsedBlock.course} Sem ${parsedBlock.sem || parsedBlock.semester} Sec ${parsedBlock.section} (${parsedBlock.defaultRoom})`);
        }

        if (parsedBlock) {
          const course = parsedBlock.course;
          const sem = String(parsedBlock.sem || parsedBlock.semester);
          const section = parsedBlock.section;
          const schedule = parsedBlock.weekSchedule || parsedBlock.schedule;

          if (!timetables[course]) timetables[course] = {};
          if (!timetables[course][sem]) timetables[course][sem] = {};
          timetables[course][sem][section] = schedule;
        }
      }
    }
  }

  console.log('\n💾 Writing structured timetables to src/data/timetables.json...');
  fs.writeFileSync('src/data/timetables.json', JSON.stringify(timetables, null, 2));
  console.log('✅ Successfully updated src/data/timetables.json!');
}

runParser().catch(err => {
  console.error('Fatal parser error:', err);
  process.exit(1);
});
