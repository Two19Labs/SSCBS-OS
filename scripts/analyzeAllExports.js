import fs from 'node:fs';
import path from 'node:path';
import { parseAttendanceFile, parseAttendanceEntry, detectExcelFrameset, isTimetableFile } from '../src/lib/waiverParser.js';
import { solveExactBnb, extractTargetParts, extractCandidateDays } from '../src/lib/waiverSolver.js';

const files = fs.readdirSync('.').filter(f => f.startsWith('Student Attandance') && f.endsWith('.xls'));
console.log(`Analyzing ${files.length} attendance files...\n`);

const distinctEntries = {};

files.forEach((fileName, fIdx) => {
  console.log(`================================================================`);
  console.log(`FILE ${fIdx + 1}/${files.length}: ${fileName}`);
  console.log(`================================================================`);

  const filePath = path.resolve(fileName);
  const content = fs.readFileSync(filePath, 'utf-8');

  // 1. Format
  let format = 'Valid HTML attendance export';
  if (detectExcelFrameset(content)) {
    format = 'Re-saved Excel frameset (INVALID)';
  } else if (isTimetableFile(fileName)) {
    format = 'Timetable file (INVALID)';
  } else if (!content.includes('<table')) {
    format = 'Unknown / Non-HTML';
  }
  console.log(`1. Format: ${format}`);

  if (format !== 'Valid HTML attendance export') {
    return;
  }

  // Token collector
  const innerTds = content.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
  innerTds.forEach(td => {
    const text = td.replace(/<[^>]*>/g, '').trim();
    if (text && (text.includes('(') || text.includes('P') || text.includes('A'))) {
      try {
        const parsed = parseAttendanceEntry(text);
        distinctEntries[parsed.raw] = (distinctEntries[parsed.raw] || 0) + 1;
      } catch (e) {
        // Ignored
      }
    }
  });

  try {
    const parsed = parseAttendanceFile(content, fileName);
    
    // 2. Basics
    const dayCols = parsed.dayColumns;
    const firstDate = dayCols[0]?.dateStr;
    const lastDate = dayCols[dayCols.length - 1]?.dateStr;
    console.log(`2. Basics:`);
    console.log(`   - Report Date: ${parsed.reportDate}`);
    console.log(`   - Roll No: ${parsed.rollNo}`);
    console.log(`   - Subjects Count: ${parsed.subjects.length}`);
    console.log(`   - Day Columns Count: ${dayCols.length}`);
    console.log(`   - Inferred Date Range: ${firstDate} to ${lastDate}`);

    // 4. Totals check
    console.log(`4. Totals Check:`);
    let allMatch = true;
    parsed.subjects.forEach(s => {
      const matchP = s.reportedP === s.parsedP;
      const matchA = s.reportedA === s.parsedA;
      if (!matchP || !matchA) {
        allMatch = false;
        console.log(`   MISMATCH in ${s.name}: Reported P=${s.reportedP}, A=${s.reportedA} | Parsed P=${s.parsedP}, A=${s.parsedA}`);
      }
    });
    if (allMatch) {
      console.log(`   All ${parsed.subjects.length} subjects matched reported totals exactly (0 mismatches).`);
    }

    // 5. Dates (Weekends & Month leaps)
    const weekendDays = dayCols.filter(d => d.weekday === 'Sat' || d.weekday === 'Sun');
    console.log(`5. Weekend & Month Leap Check:`);
    console.log(`   - Weekend classes count: ${weekendDays.length}`);
    if (weekendDays.length > 0) {
      console.log(`     Dates: ${weekendDays.map(d => `${d.dateStr} (${d.weekday})`).join(', ')}`);
    }

    // 6. Per-part state
    console.log(`6. Per-part State:`);
    const practicalOnlySubs = [];
    const zeroParts = [];

    parsed.subjects.forEach(s => {
      const thN = s.parts.th.p + s.parts.th.a;
      const tuN = s.parts.tu.p + s.parts.tu.a;
      const prN = s.parts.pr.p + s.parts.pr.a;

      const thPct = thN > 0 ? ((s.parts.th.p / thN) * 100).toFixed(1) + '%' : 'N/A';
      const tuPct = tuN > 0 ? ((s.parts.tu.p / tuN) * 100).toFixed(1) + '%' : 'N/A';
      const prPct = prN > 0 ? ((s.parts.pr.p / prN) * 100).toFixed(1) + '%' : 'N/A';

      if (thN === 0 && tuN === 0 && prN > 0) {
        practicalOnlySubs.push(s.name);
      }
      if (thN > 0 && s.parts.th.p === 0) zeroParts.push(`${s.name} (Theory: 0/${thN})`);
      if (tuN > 0 && s.parts.tu.p === 0) zeroParts.push(`${s.name} (Tute: 0/${tuN})`);

      console.log(`   - ${s.name}: Th=${s.parts.th.p}/${thN} (${thPct}), Tu=${s.parts.tu.p}/${tuN} (${tuPct}), Pr=${s.parts.pr.p}/${prN} (${prPct})`);
    });

    if (practicalOnlySubs.length > 0) {
      console.log(`   Practical-only subjects: ${practicalOnlySubs.join('; ')}`);
    }
    if (zeroParts.length > 0) {
      console.log(`   Parts at 0%: ${zeroParts.join('; ')}`);
    }

    // Candidate Days
    const { targetParts } = extractTargetParts(parsed);
    const candidateDays = extractCandidateDays(parsed, targetParts);
    console.log(`   Target parts count: ${targetParts.length}`);
    console.log(`   Candidate days count (days with Th/Tu absences): ${candidateDays.length}`);

    // 7. Solver Output at T=85
    console.log(`7. Solver Benchmarks (T=85):`);
    [5, 10, 15].forEach(K => {
      const t0 = performance.now();
      const res = solveExactBnb(parsed, 85, K);
      const elapsed = (performance.now() - t0).toFixed(1);
      const dateList = res.chosenDays.map(d => `${d.dateStr} (${d.weekday})`).join(', ');
      console.log(`   - K=${K} [${elapsed}ms]: status=${res.status}, passing=${res.passCount}/${res.totalTargetParts}, used=${res.chosenDays.length} days, lowest=${res.lowestPartPct.toFixed(1)}% (${res.lowestPart})`);
      if (res.chosenDays.length > 0) {
        console.log(`     Dates: ${dateList}`);
      }
    });

    // Unlimited K minimum
    const t0 = performance.now();
    const unlim = solveExactBnb(parsed, 85, candidateDays.length);
    const elapsedUnlim = (performance.now() - t0).toFixed(1);
    console.log(`   - Unlimited K (${candidateDays.length} cand) [${elapsedUnlim}ms]: status=${unlim.status}, passing=${unlim.passCount}/${unlim.totalTargetParts}, min days needed=${unlim.chosenDays.length}, lowest=${unlim.lowestPartPct.toFixed(1)}%`);

    // 8. Unexpected details
    console.log(`8. Anomalies / Notes: None detected.`);
  } catch (err) {
    console.error(`ERROR parsing ${fileName}:`, err.message);
  }
  console.log(`\n`);
});

console.log(`================================================================`);
console.log(`3. DISTINCT ENTRY VALUES ACROSS ALL FILES:`);
console.log(`================================================================`);
Object.entries(distinctEntries).sort((a,b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  "${k}": ${v} occurrences`);
});
