import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAttendanceFile, parseAttendanceEntry } from '../lib/waiverParser.js';
import {
  solveExactBnb,
  solveKPlusOne,
  isPartPassing,
  calculatePartBufferAndNeeded,
  calculateSimulatedStats,
  extractTargetParts,
  extractCandidateDays
} from '../lib/waiverSolver.js';
import {
  findRecentDaySchedule,
  batchAddDates,
  clearFutureDates,
  diffCustomizations
} from '../lib/attendanceEditor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=====================================================');
console.log('  ATTENDANCE TOOL DEEP END-TO-END AUDIT & STRESS TEST');
console.log('=====================================================\n');

let totalTests = 0;
let passedTests = 0;
let warnings = [];
let issuesFound = [];

function test(description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${description}`);
  } catch (err) {
    issuesFound.push({ test: description, error: err.message, stack: err.stack });
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`    -> ${err.message}`);
  }
}

// -------------------------------------------------------------
// SECTION 1: PARSER EDGE CASES & ROBUSTNESS
// -------------------------------------------------------------
console.log('--- SECTION 1: Parser Edge Cases & File Robustness ---');

test('BOM handling: File with UTF-8 BOM must parse cleanly', () => {
  const samplePath = path.resolve(__dirname, '../../Student Attandance_2026-11-07_07_26_08.xls');
  if (fs.existsSync(samplePath)) {
    const raw = fs.readFileSync(samplePath, 'utf-8');
    const withBom = '\uFEFF' + raw;
    const parsed = parseAttendanceFile(withBom, 'with_bom.xls');
    assert.strictEqual(parsed.subjects.length, 7);
    assert.strictEqual(parsed.dayColumns.length, 55);
  }
});

test('Whitespace & HTML entities in subject names and cells', () => {
  assert.deepStrictEqual(parseAttendanceEntry('  P(&nbsp;Th)&nbsp; '), { ignore: false, raw: 'P( Th)', attended: true, type: 'th' });
  assert.deepStrictEqual(parseAttendanceEntry('A(  Th  )'), { ignore: false, raw: 'A( Th )', attended: false, type: 'th' });
  assert.deepStrictEqual(parseAttendanceEntry('P(tu)'), { ignore: false, raw: 'P(tu)', attended: true, type: 'tu' });
  assert.deepStrictEqual(parseAttendanceEntry('A(pr)'), { ignore: false, raw: 'A(pr)', attended: false, type: 'pr' });
});

test('Multiple attendance tags in one cell (e.g. double class in a day)', () => {
  const multiClassHtml = `
    <html><body>
    <table>
      <tr><td></td><td>Student Attendance</td></tr>
      <tr><td>REPORT ON 2026-11-10</td></tr>
      <tr>
        <th>sno</th>
        <th>Subject</th>
        <th>Roll No</th>
        <th>10</th>
        <th>Total Present</th>
        <th>Total Absent</th>
      </tr>
      <tr>
        <td>1</td>
        <td>Corporate Law</td>
        <td>25001</td>
        <td><table><tr><td>P( Th)</td></tr><tr><td>A( Th)</td></tr></table></td>
        <td>1</td>
        <td>1</td>
      </tr>
    </table>
    </body></html>
  `;
  const parsed = parseAttendanceFile(multiClassHtml, 'Student_Attandance_2026-11-10_10_00_00.xls');
  assert.strictEqual(parsed.subjects.length, 1);
  const dayClasses = parsed.subjects[0].dayClasses['2026-11-10'];
  assert.strictEqual(dayClasses.length, 2, 'Must record both classes on the same day');
  assert.strictEqual(dayClasses[0].attended, true);
  assert.strictEqual(dayClasses[1].attended, false);
});

// -------------------------------------------------------------
// SECTION 2: SOLVER MATHEMATICS & BOUNDARY CONDITIONS
// -------------------------------------------------------------
console.log('\n--- SECTION 2: Solver Mathematics & Boundary Conditions ---');

const baseMockData = {
  dayColumns: [
    { dateStr: '2026-09-01', dayNum: 1, month: 9, weekday: 'Tue', year: 2026, label: '01', fullLabel: 'Tue 01 Sep' },
    { dateStr: '2026-09-02', dayNum: 2, month: 9, weekday: 'Wed', year: 2026, label: '02', fullLabel: 'Wed 02 Sep' },
    { dateStr: '2026-09-03', dayNum: 3, month: 9, weekday: 'Thu', year: 2026, label: '03', fullLabel: 'Thu 03 Sep' },
    { dateStr: '2026-09-04', dayNum: 4, month: 9, weekday: 'Fri', year: 2026, label: '04', fullLabel: 'Fri 04 Sep' },
    { dateStr: '2026-09-05', dayNum: 5, month: 9, weekday: 'Sat', year: 2026, label: '05', fullLabel: 'Sat 05 Sep' }
  ],
  subjects: [
    {
      name: 'Financial Management',
      parts: { th: { p: 8, a: 4 }, tu: { p: 2, a: 1 }, pr: { p: 0, a: 0 } }, // 8/12 = 66.7% Th, 2/3 = 66.7% Tu
      dayClasses: {
        '2026-09-01': [{ type: 'th', attended: false, raw: 'A( Th)' }],
        '2026-09-02': [{ type: 'th', attended: false, raw: 'A( Th)' }],
        '2026-09-03': [{ type: 'th', attended: false, raw: 'A( Th)' }],
        '2026-09-04': [{ type: 'th', attended: false, raw: 'A( Th)' }],
        '2026-09-05': [{ type: 'tu', attended: false, raw: 'A( tu)' }]
      }
    },
    {
      name: 'Marketing Research',
      parts: { th: { p: 10, a: 0 }, tu: { p: 3, a: 0 }, pr: { p: 0, a: 0 } }, // 100% already
      dayClasses: {
        '2026-09-01': [],
        '2026-09-02': [],
        '2026-09-03': [],
        '2026-09-04': [],
        '2026-09-05': []
      }
    }
  ]
};

test('Solver with K = 0 (zero waivers allowed)', () => {
  const sol = solveExactBnb(baseMockData, 85, 0);
  assert.strictEqual(sol.chosenDays.length, 0);
  assert.strictEqual(sol.status, 'SHORTAGE');
  assert.strictEqual(sol.passCount, 2); // Marketing Th and Tu pass
});

test('Solver with K > totalMissed (more waivers than absences)', () => {
  const sol = solveExactBnb(baseMockData, 85, 20); // only 5 missed classes across all days
  assert.ok(sol.chosenDays.length <= 5, 'Cannot choose more days than have absences');
  assert.strictEqual(sol.status, 'OPTIMAL');
  assert.strictEqual(sol.passCount, 4); // All 4 parts pass
});

test('Solver when student already has 100% attendance (0 absences)', () => {
  const perfectData = {
    dayColumns: [{ dateStr: '2026-09-01', dayNum: 1, month: 9, weekday: 'Tue', year: 2026, label: '01', fullLabel: 'Tue 01 Sep' }],
    subjects: [
      {
        name: 'Ethics',
        parts: { th: { p: 15, a: 0 }, tu: { p: 0, a: 0 }, pr: { p: 0, a: 0 } },
        dayClasses: { '2026-09-01': [{ type: 'th', attended: true, raw: 'P( Th)' }] }
      }
    ]
  };
  const sol = solveExactBnb(perfectData, 85, 3);
  assert.strictEqual(sol.status, 'OPTIMAL');
  assert.strictEqual(sol.chosenDays.length, 0, 'No waivers needed when attendance is 100%');
  assert.strictEqual(sol.passCount, 1);
});

test('Subject with 0 total classes held (e.g. unheld practical)', () => {
  const zeroHeldData = {
    dayColumns: [{ dateStr: '2026-09-01', dayNum: 1, month: 9, weekday: 'Tue', year: 2026, label: '01', fullLabel: 'Tue 01 Sep' }],
    subjects: [
      {
        name: 'Computer Applications',
        parts: { th: { p: 5, a: 0 }, tu: { p: 0, a: 0 }, pr: { p: 0, a: 0 } }, // pr is 0/0
        dayClasses: { '2026-09-01': [] }
      }
    ]
  };
  const sim = calculateSimulatedStats(zeroHeldData, new Set(), 85);
  assert.strictEqual(sim.subjectsStats[0].parts.pr.passes, true, '0/0 part is excluded and counts as passing');
  assert.strictEqual(sim.totalTargetParts, 1, 'Only theory counts as target part');
});

// -------------------------------------------------------------
// SECTION 3: PRIORITY DATES STRESS TESTING
// -------------------------------------------------------------
console.log('\n--- SECTION 3: Priority Dates (Approved Society Dates) Stress Test ---');

test('Priority dates containing a date with 0 absences', () => {
  // '2026-09-01' has an absence, but what if user picks a weekend or holiday with no class?
  const priorityWithNoClass = ['2026-09-01', '2026-09-10']; // 2026-09-10 not in dayColumns
  const sol = solveExactBnb(baseMockData, 85, 3, [], 0, {
    priorityWaiverDates: priorityWithNoClass
  });
  // Should pick 2026-09-01, ignore non-existent 2026-09-10 safely without crashing
  assert.ok(sol.chosenDays.some(d => d.dateStr === '2026-09-01'));
  assert.strictEqual(sol.chosenDays.some(d => d.dateStr === '2026-09-10'), false);
});

test('Priority dates count M exceeds budget K', () => {
  // Base mock data has 5 absent dates: 09-01 to 09-05.
  // Set all 5 as priority dates, but budget K=2.
  const all5Priority = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'];
  const sol = solveExactBnb(baseMockData, 85, 2, [], 0, {
    priorityWaiverDates: all5Priority
  });
  assert.strictEqual(sol.chosenDays.length, 2, 'Must pick exactly K=2 days');
  sol.chosenDays.forEach(d => {
    assert.ok(all5Priority.includes(d.dateStr), 'Every chosen day must be one of the priority dates');
    assert.strictEqual(d.isPriorityDate, true);
  });
});

test('Priority dates count M < budget K', () => {
  // Set 2 priority dates with budget K=4.
  const twoPriority = ['2026-09-01', '2026-09-02'];
  const sol = solveExactBnb(baseMockData, 85, 4, [], 0, {
    priorityWaiverDates: twoPriority
  });
  assert.strictEqual(sol.chosenDays.length, 4, 'Must pick 4 days total');
  twoPriority.forEach(pd => {
    assert.ok(sol.chosenDays.some(d => d.dateStr === pd), `Priority date ${pd} must be in chosen days`);
  });
});

// -------------------------------------------------------------
// SECTION 4: LOCKED WAIVERS & INCREMENTAL RECOMMENDATION
// -------------------------------------------------------------
console.log('\n--- SECTION 4: Locked Waivers & Incremental Recommendation ---');

test('Locking dates that already satisfy target', () => {
  // If user locked 2026-09-01, 2026-09-02, 2026-09-03, 2026-09-04 and K=5
  const sol = solveExactBnb(baseMockData, 85, 5, [], 0, {
    fixedWaiverDates: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']
  });
  assert.strictEqual(sol.chosenDays.length, 5);
  assert.strictEqual(sol.fixedDays.length, 4);
  assert.strictEqual(sol.recommendedAdditionalDays.length, 1);
  assert.strictEqual(sol.recommendedAdditionalDays[0].dateStr, '2026-09-05');
});

test('Locking more dates than K (fixed > K)', () => {
  // If user locks 4 dates but K=2, solver should preserve all 4 fixed dates gracefully
  const sol = solveExactBnb(baseMockData, 85, 2, [], 0, {
    fixedWaiverDates: ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']
  });
  assert.strictEqual(sol.chosenDays.length, 4, 'All fixed dates must be kept even if > K');
  assert.strictEqual(sol.recommendedAdditionalDays.length, 0, 'No additional days added');
});

// -------------------------------------------------------------
// SECTION 5: REAL DATA END-TO-END STRESS TEST
// -------------------------------------------------------------
console.log('\n--- SECTION 5: Real User Data End-to-End Stress Test ---');

const realUserFiles = [
  'Student Attandance_2026-11-07_07_26_08.xls',
  'Student Attandance_2026-11-06_15_48_08.xls',
  'src/test/fixtures/macro_starred_case.html'
];

realUserFiles.forEach(fileRel => {
  const filePath = path.resolve(fileRel);
  if (fs.existsSync(filePath)) {
    test(`Real file stress test: ${path.basename(fileRel)}`, () => {
      const html = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseAttendanceFile(html, path.basename(fileRel));

      assert.ok(parsed.subjects.length > 0, 'Must parse subjects');
      assert.ok(parsed.dayColumns.length > 0, 'Must parse dayColumns');

      // Test multiple parameter combinations:
      // 1. K=0
      const sol0 = solveExactBnb(parsed, 85, 0);
      assert.ok(sol0);

      // 2. K=5 with starring first subject
      const firstSubName = parsed.subjects[0].name;
      const solStar = solveExactBnb(parsed, 85, 5, [firstSubName]);
      assert.ok(solStar);

      // 3. K=6 with CDC=2
      const solCdc = solveExactBnb(parsed, 85, 6, [], 2);
      assert.ok(solCdc);

      // 4. Solve K+1 in shortage
      if (solCdc.status === 'SHORTAGE') {
        const kPlusOne = solveKPlusOne(parsed, 85, 6, [], 2);
        assert.ok(kPlusOne);
      }

      // 5. Simulation stats consistency
      const waiverDates = new Set(solCdc.chosenDays.map(d => d.dateStr));
      const cdcDates = new Set(solCdc.chosenCdcDays.map(d => d.dateStr));
      const sim = calculateSimulatedStats(parsed, waiverDates, 85, cdcDates);
      assert.strictEqual(sim.passingTargetCount, solCdc.passCount);
    });
  }
});

// -------------------------------------------------------------
// SECTION 6: PRACTICAL CLASSES & AGGREGATE MATHEMATICS
// -------------------------------------------------------------
console.log('\n--- SECTION 6: Practical Classes & Aggregate Mathematics ---');

const practicalMockData = {
  dayColumns: [
    { dateStr: '2026-09-01', dayNum: 1, month: 9, weekday: 'Tue', year: 2026, label: '01', fullLabel: 'Tue 01 Sep' },
    { dateStr: '2026-09-02', dayNum: 2, month: 9, weekday: 'Wed', year: 2026, label: '02', fullLabel: 'Wed 02 Sep' },
    { dateStr: '2026-09-03', dayNum: 3, month: 9, weekday: 'Thu', year: 2026, label: '03', fullLabel: 'Thu 03 Sep' }
  ],
  subjects: [
    {
      name: 'Python for Data Analysis',
      parts: { th: { p: 10, a: 0 }, tu: { p: 0, a: 0 }, pr: { p: 2, a: 8 } }, // 10/10 Th (100%), 2/10 Pr (20%)
      dayClasses: {
        '2026-09-01': [{ type: 'pr', attended: false, raw: 'A( pr)' }],
        '2026-09-02': [{ type: 'pr', attended: false, raw: 'A( pr)' }],
        '2026-09-03': [{ type: 'th', attended: true, raw: 'P( Th)' }]
      }
    }
  ]
};

test('Practical classes are strictly excluded from targetParts', () => {
  const { targetParts, allParts } = extractTargetParts(practicalMockData);
  assert.strictEqual(targetParts.length, 1, 'Only Theory should be a target part');
  assert.strictEqual(targetParts[0].type, 'th');
  assert.strictEqual(targetParts[0].subject, 'Python for Data Analysis');
  assert.ok(allParts.some(p => p.type === 'pr'), 'Practical exists in allParts list');
  assert.ok(!targetParts.some(p => p.type === 'pr'), 'Practical must never be in targetParts');
});

test('Days with ONLY practical absences are never candidate days for waivers', () => {
  const { targetParts } = extractTargetParts(practicalMockData);
  const candidateDays = extractCandidateDays(practicalMockData, targetParts);
  assert.strictEqual(candidateDays.length, 0, 'No candidate days when absences are only in practicals');
});

test('Solver NEVER allocates waivers to rescue or target practicals', () => {
  const sol = solveExactBnb(practicalMockData, 85, 5);
  assert.strictEqual(sol.chosenDays.length, 0, '0 waivers must be allocated when theory is already passing');
  assert.strictEqual(sol.status, 'OPTIMAL');
  assert.strictEqual(sol.passCount, 1); // 1 target part (theory) passing
});

test('Practical classes ARE included in Total Attendance (Aggregate)', () => {
  const sim = calculateSimulatedStats(practicalMockData, new Set());
  // 10 theory attended + 2 practical attended = 12 attended
  // 10 theory held + 10 practical held = 20 held
  assert.strictEqual(sim.totals.overall.att, 12, 'Total aggregate attended must include practical attended');
  assert.strictEqual(sim.totals.overall.held, 20, 'Total aggregate held must include practical held');
  assert.strictEqual(sim.totals.overall.pct, 60, '12 / 20 = 60.0% aggregate');
  // Individual component status:
  const prPart = sim.subjectsStats[0].parts.pr;
  assert.strictEqual(prPart.status, 'info', 'Practical status must be info');
  assert.strictEqual(prPart.isTarget, false, 'Practical isTarget must be false');
});

test('Waiving a day with co-occurring practical absence correctly removes practical class without prioritizing it', () => {
  const coOccurringData = {
    dayColumns: [
      { dateStr: '2026-09-01', dayNum: 1, month: 9, weekday: 'Tue', year: 2026, label: '01', fullLabel: 'Tue 01 Sep' }
    ],
    subjects: [
      {
        name: 'Database Management',
        parts: { th: { p: 8, a: 2 }, tu: { p: 0, a: 0 }, pr: { p: 2, a: 8 } },
        dayClasses: {
          '2026-09-01': [
            { type: 'th', attended: false, raw: 'A( Th)' },
            { type: 'pr', attended: false, raw: 'A( pr)' }
          ]
        }
      }
    ]
  };

  const sol = solveExactBnb(coOccurringData, 85, 1);
  assert.strictEqual(sol.chosenDays.length, 1);
  assert.strictEqual(sol.chosenDays[0].dateStr, '2026-09-01');

  const sim = calculateSimulatedStats(coOccurringData, new Set(['2026-09-01']));
  // Theory went from 8/10 (80%) -> 8/9 (88.9%)
  assert.strictEqual(sim.subjectsStats[0].parts.th.simP, 8);
  assert.strictEqual(sim.subjectsStats[0].parts.th.simN, 9);
  // Practical went from 2/10 (20%) -> 2/9 (22.2%) because day was waived
  assert.strictEqual(sim.subjectsStats[0].parts.pr.simP, 2);
  assert.strictEqual(sim.subjectsStats[0].parts.pr.simN, 9);
  assert.strictEqual(sim.subjectsStats[0].parts.pr.status, 'info');
  // Overall aggregate: (8 + 2) / (9 + 9) = 10 / 18 = 55.55%
  assert.strictEqual(sim.totals.overall.att, 10);
  assert.strictEqual(sim.totals.overall.held, 18);
});

// -------------------------------------------------------------
// SECTION 7: FUTURE ATTENDANCE SPECULATION & TIMETABLE AUTOFILL
// -------------------------------------------------------------
console.log('\n--- SECTION 7: Future Attendance Speculation & Timetable Autofill ---');

const futureBaseDataset = {
  reportDate: '2026-11-06',
  dayColumns: [
    { dateStr: '2026-11-02', dayNum: 2, month: 11, year: 2026, weekday: 'Mon', label: '02 Nov', fullLabel: 'Mon 02 Nov' },
    { dateStr: '2026-11-03', dayNum: 3, month: 11, year: 2026, weekday: 'Tue', label: '03 Nov', fullLabel: 'Tue 03 Nov' },
    { dateStr: '2026-11-04', dayNum: 4, month: 11, year: 2026, weekday: 'Wed', label: '04 Nov', fullLabel: 'Wed 04 Nov' }
  ],
  subjects: [
    {
      name: 'Financial Management',
      parts: { th: { p: 2, a: 1 }, tu: { p: 0, a: 1 }, pr: { p: 0, a: 0 } },
      dayClasses: {
        '2026-11-02': [{ type: 'th', attended: true, raw: 'P(Th)' }],
        '2026-11-03': [
          { type: 'th', attended: false, raw: 'A(Th)' },
          { type: 'tu', attended: false, raw: 'A(Tu)' }
        ],
        '2026-11-04': [{ type: 'th', attended: true, raw: 'P(Th)' }]
      }
    }
  ]
};

test('findRecentDaySchedule finds matching weekday with classes recorded', () => {
  const tuesdaySched = findRecentDaySchedule(futureBaseDataset, 'Tue');
  assert.ok(tuesdaySched, 'Must find Tuesday schedule');
  assert.strictEqual(tuesdaySched.dateStr, '2026-11-03');
  assert.strictEqual(tuesdaySched.totalClasses, 2);
  assert.strictEqual(tuesdaySched.classesBySubject['Financial Management'].length, 2);
});

test('batchAddDates single future date with copy_weekday (default P for 100% attendance)', () => {
  // 2026-11-10 is next Tuesday (strictly after reportDate 2026-11-06)
  const updated = batchAddDates(futureBaseDataset, ['2026-11-10'], 'copy_weekday', 'p');
  const futureCol = updated.dayColumns.find(d => d.dateStr === '2026-11-10');
  assert.ok(futureCol, 'Future column must be present in dayColumns');
  assert.strictEqual(futureCol.isFuture, true, 'Must be flagged isFuture: true');
  assert.strictEqual(futureCol.weekday, 'Tue');

  const classes = updated.subjects[0].dayClasses['2026-11-10'];
  assert.strictEqual(classes.length, 2, 'Must copy 2 classes from Tuesday');
  assert.strictEqual(classes[0].attended, true, 'Both classes must be marked Present');
  assert.strictEqual(classes[1].attended, true, 'Both classes must be marked Present');

  // Baseline was P:2, A:1 for Th and P:0, A:1 for Tu
  // Adding 1 Th Present and 1 Tu Present makes it P:3 for Th and P:1 for Tu
  assert.strictEqual(updated.subjects[0].parts.th.p, 3);
  assert.strictEqual(updated.subjects[0].parts.tu.p, 1);
});

test('batchAddDates date range with copy_weekday (default A for upcoming fest/duty leave)', () => {
  // Add upcoming Tuesday and Wednesday marked Absent
  const updated = batchAddDates(futureBaseDataset, ['2026-11-10', '2026-11-11'], 'copy_weekday', 'a');
  assert.strictEqual(updated.dayColumns.length, 5);

  const tueClasses = updated.subjects[0].dayClasses['2026-11-10'];
  assert.ok(tueClasses.every(c => c.attended === false), 'All simulated upcoming classes must be absent');

  // Solver synergy: Verify that solver now evaluates these upcoming absences for waivers
  const sol = solveExactBnb(updated, 85, 2);
  assert.ok(sol.chosenDays.length > 0, 'Solver must find optimal waivers');
});

test('diffCustomizations correctly tracks futureDates set and futureClassesStats', () => {
  const updated = batchAddDates(futureBaseDataset, ['2026-11-10', '2026-11-11'], 'copy_weekday', 'p');
  const diff = diffCustomizations(futureBaseDataset, updated);
  assert.strictEqual(diff.futureDates.size, 2, 'Must detect exactly 2 future dates');
  assert.ok(diff.futureDates.has('2026-11-10'));
  assert.ok(diff.futureDates.has('2026-11-11'));
  assert.strictEqual(diff.futureClassesStats.total, 3); // 2 on Tue + 1 on Wed = 3
  assert.strictEqual(diff.futureClassesStats.p, 3);
  assert.strictEqual(diff.futureClassesStats.a, 0);
});

test('clearFutureDates purges only future dates without affecting historical dates', () => {
  const updated = batchAddDates(futureBaseDataset, ['2026-11-10', '2026-11-11'], 'copy_weekday', 'p');
  assert.strictEqual(updated.dayColumns.length, 5);

  const cleared = clearFutureDates(updated, futureBaseDataset.reportDate);
  assert.strictEqual(cleared.dayColumns.length, 3, 'Must restore exactly 3 original day columns');
  assert.deepStrictEqual(
    cleared.dayColumns.map(d => d.dateStr),
    ['2026-11-02', '2026-11-03', '2026-11-04']
  );
  // Subject totals must revert to baseline
  assert.strictEqual(cleared.subjects[0].parts.th.p, 2);
  assert.strictEqual(cleared.subjects[0].parts.th.a, 1);
  assert.strictEqual(cleared.subjects[0].parts.tu.p, 0);
  assert.strictEqual(cleared.subjects[0].parts.tu.a, 1);
});

// -------------------------------------------------------------
// SECTION 8: SUMMARY & AUDIT RESULTS
// -------------------------------------------------------------
console.log('\n=====================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${issuesFound.length}`);
if (warnings.length > 0) {
  console.log(`WARNINGS: ${warnings.length}`);
  warnings.forEach(w => console.warn(`  ! ${w}`));
}
if (issuesFound.length > 0) {
  console.log('FAILURES:');
  issuesFound.forEach(f => console.error(`  ✗ ${f.test}: ${f.error}`));
}
console.log('=====================================================\n');

if (issuesFound.length > 0) {
  process.exit(1);
}
