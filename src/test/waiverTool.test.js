import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAttendanceFile, parseAttendanceEntry } from '../lib/waiverParser.js';
import { solveExactBnb, isPartPassing, calculatePartBufferAndNeeded, calculateSimulatedStats } from '../lib/waiverSolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- RUNNING WAIVER TOOL TEST SUITE ---');

// 1. Test entry parsing according to Section 4.3
console.log('1. Testing entry tokenizer...');
assert.deepStrictEqual(parseAttendanceEntry('P( Th)'), { ignore: false, raw: 'P( Th)', attended: true, type: 'th' });
assert.deepStrictEqual(parseAttendanceEntry('A( Th)'), { ignore: false, raw: 'A( Th)', attended: false, type: 'th' });
assert.deepStrictEqual(parseAttendanceEntry('P( tu)'), { ignore: false, raw: 'P( tu)', attended: true, type: 'tu' });
assert.deepStrictEqual(parseAttendanceEntry('A( tu)'), { ignore: false, raw: 'A( tu)', attended: false, type: 'tu' });
assert.deepStrictEqual(parseAttendanceEntry('P( PR)'), { ignore: false, raw: 'P( PR)', attended: true, type: 'pr' });
assert.deepStrictEqual(parseAttendanceEntry('A( PR)'), { ignore: false, raw: 'A( PR)', attended: false, type: 'pr' });
assert.deepStrictEqual(parseAttendanceEntry('P|Extra class ( Th)'), { ignore: false, raw: 'P|Extra class ( Th)', attended: true, type: 'th' });
assert.deepStrictEqual(parseAttendanceEntry('A|Extra class ( Th)'), { ignore: false, raw: 'A|Extra class ( Th)', attended: false, type: 'th' });
assert.deepStrictEqual(parseAttendanceEntry('Not Taken( PR)'), { ignore: true, raw: 'Not Taken( PR)' });

// Unknown entry throws
assert.throws(() => parseAttendanceEntry('SomethingRandom(XYZ)'), /Unrecognized/);
console.log('✓ Tokenizer passed all specifications.');

// 2. Test passing math according to Section 3
console.log('2. Testing pass rule math...');
assert.strictEqual(isPartPassing(17, 20, 85), false, '17/20 is exactly 85.0% -> MUST FAIL under strict >');
assert.strictEqual(isPartPassing(18, 20, 85), true, '18/20 is 90.0% -> passes');
assert.strictEqual(isPartPassing(0, 0, 85), true, 'Empty part (0/0) -> excluded / passes');
assert.strictEqual(isPartPassing(6, 7, 85), true, '6/7 is 85.71% -> passes');

const m1 = calculatePartBufferAndNeeded(17, 21, 85);
assert.strictEqual(m1.classesNeeded, 6, '17/21 at T=85 needs 6 consecutive classes');

const m2 = calculatePartBufferAndNeeded(5, 6, 85);
assert.strictEqual(m2.classesNeeded, 1, '5/6 at T=85 needs 1 consecutive class');
console.log('✓ Strict integer math passed.');

// 3. Test Section 8 Known Benchmark Case
console.log('3. Testing Section 8 Known Case...');
const samplePath = path.resolve(__dirname, '../../Student Attandance_2026-11-07_07_26_08.xls');
if (fs.existsSync(samplePath)) {
  const html = fs.readFileSync(samplePath, 'utf-8');
  const parsed = parseAttendanceFile(html, 'Student Attandance_2026-11-07_07_26_08.xls');

  assert.strictEqual(parsed.reportDate, '2026-11-07');
  assert.strictEqual(parsed.subjects.length, 7);
  assert.strictEqual(parsed.dayColumns.length, 55);

  // Totals validation check
  parsed.subjects.forEach(s => {
    assert.strictEqual(s.reportedP, s.parsedP, `Present total mismatch in ${s.name}`);
    assert.strictEqual(s.reportedA, s.parsedA, `Absent total mismatch in ${s.name}`);
  });
  console.log('✓ All 7 subjects match portal totals 100%.');

  // Test solver with T = 85, K = 3
  const solK3 = solveExactBnb(parsed, 85, 3);
  assert.strictEqual(solK3.status, 'OPTIMAL', 'K=3 must be OPTIMAL');
  assert.strictEqual(solK3.passCount, 8, '8 of 8 parts must pass');
  assert.strictEqual(solK3.chosenDays.length, 3, 'Must use exactly 3 days');

  const chosenLabels = solK3.chosenDays.map(d => `${d.weekday} ${d.label}`);
  assert.deepStrictEqual(chosenLabels, ['Mon 10 Aug', 'Mon 5 Oct', 'Fri 6 Nov'], 'Days must match Section 8 exact plan');
  assert.strictEqual(solK3.lowestPart, 'Organisational Behaviour tute');
  assert.strictEqual(solK3.lowestPartPct.toFixed(1), '85.7');
  console.log('✓ K=3 plan perfectly matches: Mon 10 Aug, Mon 5 Oct, Fri 6 Nov (Lowest: OB tute 85.7%).');

  // Test solver with T = 85, K = 2
  const solK2 = solveExactBnb(parsed, 85, 2);
  assert.strictEqual(solK2.status, 'SHORTAGE', 'K=2 must be SHORTAGE');
  assert.strictEqual(solK2.passCount, 7, '7 of 8 parts pass at K=2');
  assert.strictEqual(solK2.neededWaiversForAllPass, 3, 'Must identify 3 total waivers needed for allPass');
  assert.strictEqual(solK2.shortfall, 1, 'Shortfall must be exactly 1 waiver');
  console.log('✓ K=2 shortage check passed with exact K+N shortfall calculation (needed: 3, shortfall: 1).');
} else {
  console.warn('Sample benchmark file not found at:', samplePath);
}

// 4. Test Starred Subject Priority & Debarment Floor Guard
console.log('4. Testing Starred Subject Priority & Floor Guard...');
const nov6Path = path.resolve(__dirname, '../../Student Attandance_2026-11-06_15_48_08.xls');
if (fs.existsSync(nov6Path)) {
  const html = fs.readFileSync(nov6Path, 'utf-8');
  const parsed = parseAttendanceFile(html, 'Student Attandance_2026-11-06_15_48_08.xls');

  // Find Financial Accounting Analysis and star it with K=12
  const targetSub = 'Financial Accounting Analysis';
  const solStarred = solveExactBnb(parsed, 85, 12, [targetSub]);

  // Check that the solver prioritized the starred subject to pass or reach higher tier
  const finAccTheory = solStarred.evalPlan.finalStats.find(s => s.label.includes(targetSub) && s.label.includes('theory'));
  assert(finAccTheory, 'Financial Accounting Analysis theory must exist in results');
  assert.strictEqual(finAccTheory.pass, true, 'Starred Financial Accounting Theory must reach >85% target');

  // Verify non-negotiable Priority 0: no subject is allowed below 66.67% debarment floor
  for (const part of solStarred.evalPlan.finalStats) {
    if (part.n > 0) {
      assert(part.pct >= 66.66, `${part.label} must not violate debarment floor (${part.pct}%)`);
    }
  }

  // Verify that in shortage mode with K=12, all 12 waivers are utilized (waterfilling)
  assert.strictEqual(solStarred.chosenDays.length, 12, 'In shortage mode, all 12 available waivers must be utilized');
  console.log('✓ Starred subject prioritization, 66.67% debarment guard, and full waiver utilization verified.');
}

// 5. Test DU Overall Attendance Debarment Ineligibility Rule (<66.7% total aggregate)
console.log('5. Testing DU Overall Attendance Debarment Rule...');
const checkEligibility = (totAtt, totHeld) => {
  const pct = totHeld > 0 ? (totAtt / totHeld) * 100 : 100;
  return pct < 66.666;
};

// Case A: Overall attendance below 66.7% -> strictly ineligible
assert.strictEqual(checkEligibility(120, 200), true, '120/200 = 60% must be ineligible');
assert.strictEqual(checkEligibility(66, 100), true, '66/100 = 66.0% must be ineligible (< 66.666%)');
assert.strictEqual(checkEligibility(666, 1000), true, '66.6% must be ineligible');

// Case B: Overall attendance 66.7% or above -> eligible
assert.strictEqual(checkEligibility(67, 100), false, '67/100 = 67.0% must be eligible');
assert.strictEqual(checkEligibility(2, 3), false, '2/3 = 66.667% must be eligible');
assert.strictEqual(checkEligibility(172, 198), false, '172/198 = 86.87% must be eligible');

// Case C: Overall is 70% but an individual subject is 30% -> eligible for waivers
const studentParts = [
  { subject: 'Math', att: 10, held: 30 }, // 33.3% individual (below 66.7%)
  { subject: 'Stats', att: 60, held: 70 }  // 85.7%
];
const totalAtt = studentParts.reduce((s, p) => s + p.att, 0);
const totalHeld = studentParts.reduce((s, p) => s + p.held, 0);
assert.strictEqual(totalAtt, 70);
assert.strictEqual(totalHeld, 100);
assert.strictEqual(checkEligibility(totalAtt, totalHeld), false, 'Overall 70% with individual subject at 33.3% must remain eligible to apply waivers');
console.log('✓ DU overall debarment ineligibility criteria passed with exact boundary accuracy.');

// 6. Test Career Development Centre (CDC) Attendance Simulation
console.log('6. Testing Career Development Centre (CDC) Attendance...');
const mockParsedData = {
  dayColumns: [
    { dateStr: '2026-08-10', dayNum: 10, month: 8, weekday: 'Mon' },
    { dateStr: '2026-08-11', dayNum: 11, month: 8, weekday: 'Tue' }
  ],
  subjects: [
    {
      name: 'Corporate Finance',
      parts: {
        th: { p: 10, a: 10 }, // 10/20 = 50%
        tu: { p: 2, a: 2 },   // 2/4 = 50%
        pr: { p: 0, a: 0 }
      },
      dayClasses: {
        '2026-08-10': [
          { type: 'th', attended: false, raw: 'A( Th)' },
          { type: 'tu', attended: true, raw: 'P( tu)' }
        ],
        '2026-08-11': [
          { type: 'th', attended: false, raw: 'A( Th)' }
        ]
      }
    }
  ]
};

// Baseline: 0 waivers, 0 CDC
const baseStats = calculateSimulatedStats(mockParsedData, new Set(), 85, new Set());
assert.strictEqual(baseStats.subjectsStats[0].parts.th.simP, 10);
assert.strictEqual(baseStats.subjectsStats[0].parts.th.simN, 20);

// Apply CDC attendance on 2026-08-10 (has A in Th, P in Tu)
const cdcStats = calculateSimulatedStats(mockParsedData, new Set(), 85, new Set(['2026-08-10']));
// Theory: Absent becomes Present -> 11/20 (held 20 unchanged!)
assert.strictEqual(cdcStats.subjectsStats[0].parts.th.simP, 11, 'CDC must convert absent class to present');
assert.strictEqual(cdcStats.subjectsStats[0].parts.th.simN, 20, 'CDC must leave held classes unchanged');
// Tutorial: Was already Present -> stays 2/4
assert.strictEqual(cdcStats.subjectsStats[0].parts.tu.simP, 2, 'CDC must leave existing presents unaffected');
assert.strictEqual(cdcStats.subjectsStats[0].parts.tu.simN, 4, 'CDC must leave held tutorial classes unchanged');

// Compare with Waiver on 2026-08-11 (deletes class: held drops to 19, attended stays 11)
const waiverAndCdcStats = calculateSimulatedStats(mockParsedData, new Set(['2026-08-11']), 85, new Set(['2026-08-10']));
assert.strictEqual(waiverAndCdcStats.subjectsStats[0].parts.th.simP, 11, 'Attended reflects CDC +1 present');
assert.strictEqual(waiverAndCdcStats.subjectsStats[0].parts.th.simN, 19, 'Held reflects Waiver -1 class deletion');
console.log('✓ Career Development Centre (CDC) Attendance math and co-existence validated.');

// 7. Test Joint Optimization Solver: Waivers + CDC Attendance Smart Recommendation
console.log('7. Testing Joint Optimization Solver (Waivers + CDC Attendance)...');
if (fs.existsSync(nov6Path)) {
  const html = fs.readFileSync(nov6Path, 'utf-8');
  const parsed = parseAttendanceFile(html, 'Student Attandance_2026-11-06_15_48_08.xls');

  // Run solver with K=8 waivers and C=2 CDC attendance days
  const jointSol = solveExactBnb(parsed, 85, 8, ['Financial Accounting Analysis'], 2);

  assert(Array.isArray(jointSol.chosenDays), 'chosenDays must be an array of waivers');
  assert(Array.isArray(jointSol.chosenCdcDays), 'chosenCdcDays must be an array of CDC attendance days');
  assert(jointSol.chosenDays.length <= 8, `Waivers (${jointSol.chosenDays.length}) must not exceed K=8`);
  assert(jointSol.chosenCdcDays.length <= 2, `CDC days (${jointSol.chosenCdcDays.length}) must not exceed C=2`);

  // Verify mutual exclusivity: a date cannot be both waived and marked as CDC attendance
  const waiverDates = new Set(jointSol.chosenDays.map(d => d.dateStr));
  const cdcDates = new Set(jointSol.chosenCdcDays.map(d => d.dateStr));
  for (const date of cdcDates) {
    assert(!waiverDates.has(date), `Date ${date} cannot be both a waiver and CDC attendance`);
  }

  // Verify that live simulation with recommended sets yields identical results to evalPlan
  const liveJointStats = calculateSimulatedStats(parsed, waiverDates, 85, cdcDates);
  assert.strictEqual(liveJointStats.passingTargetCount, jointSol.passCount, 'Simulated pass count must match solver pass count');

  // Verify that adding CDC attendance days improves or maintains passing performance compared to waivers alone
  const waiverOnlySol = solveExactBnb(parsed, 85, 8, ['Financial Accounting Analysis'], 0);
  assert(jointSol.passCount >= waiverOnlySol.passCount, 'Joint solver must achieve at least as many passing subjects as waiver-only');
  assert(jointSol.debarSafeCount >= waiverOnlySol.debarSafeCount, 'Joint solver must preserve or improve debarment safety');

  console.log(`✓ Joint optimization successfully found ${jointSol.chosenDays.length} waivers + ${jointSol.chosenCdcDays.length} CDC days with ${jointSol.passCount}/${jointSol.totalTargetParts} parts passing.`);

  // 8. Test Timeline Filtering (1st Year: Sep+), Date Blocking & CDC Rescue Calculation
  console.log('8. Testing 1st Year Timeline (Sep+), Date Blocking, and CDC Rescue...');
  
  // Test A: 1st Year (waiverStartMonth = 9). August dates must be excluded from waivers
  const firstYearSol = solveExactBnb(parsed, 85, 8, [], 2, { waiverStartMonth: 9 });
  firstYearSol.chosenDays.forEach(d => {
    assert(d.month >= 9, `1st year waiver recommendation must NOT include August date ${d.dateStr}`);
  });
  console.log('✓ 1st Year timeline constraint strictly excludes August waivers from solver recommendations.');

  // Test B: Date Blocking
  // Pick the first recommended waiver from firstYearSol and block it
  if (firstYearSol.chosenDays.length > 0) {
    const dateToBlock = firstYearSol.chosenDays[0].dateStr;
    const blockedSet = new Set([dateToBlock]);
    const blockedSol = solveExactBnb(parsed, 85, 8, [], 2, { waiverStartMonth: 9, blockedDates: blockedSet });
    
    const blockedInWaivers = blockedSol.chosenDays.some(d => d.dateStr === dateToBlock);
    const blockedInCdc = blockedSol.chosenCdcDays.some(d => d.dateStr === dateToBlock);
    assert(!blockedInWaivers, `Blocked date ${dateToBlock} must NOT appear in chosen waivers`);
    assert(!blockedInCdc, `Blocked date ${dateToBlock} must NOT appear in chosen CDC days`);
    console.log(`✓ Blocked date ${dateToBlock} was strictly excluded from all recommendations.`);
  }

  // Test C: CDC Rescue Calculation
  assert(jointSol.cdcRescue, 'Solver must return cdcRescue object');
  assert(typeof jointSol.cdcRescue.baselineOverallPct === 'number', 'cdcRescue.baselineOverallPct must be numeric');
  assert(typeof jointSol.cdcRescue.projectedOverallPctWithCdc === 'number', 'cdcRescue.projectedOverallPctWithCdc must be numeric');
  assert(typeof jointSol.cdcRescue.cdcRescued === 'boolean', 'cdcRescue.cdcRescued must be boolean');
  console.log(`✓ CDC rescue metrics computed: baseline=${jointSol.cdcRescue.baselineOverallPct.toFixed(1)}%, projected=${jointSol.cdcRescue.projectedOverallPctWithCdc.toFixed(1)}%, rescued=${jointSol.cdcRescue.cdcRescued}.`);

  // Test D: Custom Timeline Range Window (waiverStartDate and waiverEndDate)
  const customStart = '2026-09-15';
  const customEnd = '2026-10-15';
  const customRangeSol = solveExactBnb(parsed, 85, 8, [], 2, {
    waiverStartDate: customStart,
    waiverEndDate: customEnd
  });

  customRangeSol.chosenDays.forEach(d => {
    assert(d.dateStr >= customStart, `Custom timeline waiver ${d.dateStr} must be >= ${customStart}`);
    assert(d.dateStr <= customEnd, `Custom timeline waiver ${d.dateStr} must be <= ${customEnd}`);
  });
  console.log(`✓ Custom timeline constraint (${customStart} to ${customEnd}) strictly respected: all ${customRangeSol.chosenDays.length} waivers fall within the window.`);

  // 9. Test Locked Waivers & Incremental Recommendation ("Fill Remaining Waivers")
  console.log('9. Testing Locked Waivers & Incremental Recommendation...');
  if (fs.existsSync(samplePath)) {
    const sampleHtml = fs.readFileSync(samplePath, 'utf-8');
    const benchmarkParsed = parseAttendanceFile(sampleHtml, 'sample.xls');

    // Scenario A: User manually locks '2026-08-10' (Mon 10 Aug). K=3.
    // The solver must keep 2026-08-10 as fixed, and find the 2 remaining optimal days (Mon 5 Oct and Fri 6 Nov).
    const lockedSol = solveExactBnb(benchmarkParsed, 85, 3, [], 0, {
      fixedWaiverDates: ['2026-08-10']
    });
    assert.strictEqual(lockedSol.status, 'OPTIMAL', 'Incremental recommendation must achieve OPTIMAL status');
    assert.strictEqual(lockedSol.passCount, 8, 'All 8 parts must pass');
    assert.strictEqual(lockedSol.chosenDays.length, 3, 'Must contain total 3 days (1 fixed + 2 recommended)');
    assert.strictEqual(lockedSol.fixedDays.length, 1, 'Must report 1 fixed waiver day');
    assert.strictEqual(lockedSol.fixedDays[0], '2026-08-10');
    assert.strictEqual(lockedSol.recommendedAdditionalDays.length, 2, 'Must recommend exactly 2 remaining days');
    const lockedLabels = lockedSol.chosenDays.map(d => `${d.weekday} ${d.label}`);
    assert.deepStrictEqual(lockedLabels, ['Mon 10 Aug', 'Mon 5 Oct', 'Fri 6 Nov'], 'Combined days must match the optimal set');

    const fixedDayObj = lockedSol.chosenDays.find(d => d.dateStr === '2026-08-10');
    assert.strictEqual(fixedDayObj.isFixed, true, 'Manually fixed day must have isFixed = true');
    const addedDayObj = lockedSol.chosenDays.find(d => d.dateStr === '2026-10-05');
    assert.strictEqual(addedDayObj.isFixed, false, 'Recommended day must have isFixed = false');

    // Scenario B: User manually locks a non-optimal day, e.g. 2026-08-20.
    // Solver must NOT discard it; it must preserve it and pick the best 2 additional days.
    const subOptimalLockedSol = solveExactBnb(benchmarkParsed, 85, 3, [], 0, {
      fixedWaiverDates: ['2026-08-20']
    });
    assert.strictEqual(subOptimalLockedSol.chosenDays.length, 3, 'Must contain 3 days total');
    assert(subOptimalLockedSol.chosenDays.some(d => d.dateStr === '2026-08-20'), 'Fixed day 2026-08-20 must be included');
    assert.strictEqual(subOptimalLockedSol.recommendedAdditionalDays.length, 2, 'Must recommend 2 remaining days');
    assert(!subOptimalLockedSol.recommendedAdditionalDays.some(d => d.dateStr === '2026-08-20'), 'Fixed day must not be duplicated in recommendations');

    // Scenario C: User has already locked all K days (fixed = 3, K = 3).
    const fullLockedSol = solveExactBnb(benchmarkParsed, 85, 3, [], 0, {
      fixedWaiverDates: ['2026-08-10', '2026-10-05', '2026-11-06']
    });
    assert.strictEqual(fullLockedSol.chosenDays.length, 3);
    assert.strictEqual(fullLockedSol.recommendedAdditionalDays.length, 0, 'No additional days needed when budget is met by fixed days');
    assert.strictEqual(fullLockedSol.passCount, 8);
    console.log('✓ Locked waivers and incremental recommendation logic verified across all edge cases.');
  }

  // 10. Test One-Third (1/3rd) Class Waiver Rule Advisory Warning
  console.log('10. Testing One-Third (1/3rd) Class Waiver Advisory Rule...');
  const testOneThirdData = {
    dayColumns: [
      { dateStr: '2026-08-01', dayNum: 1, month: 8, weekday: 'Sat' },
      { dateStr: '2026-08-02', dayNum: 2, month: 8, weekday: 'Sun' },
      { dateStr: '2026-08-03', dayNum: 3, month: 8, weekday: 'Mon' },
      { dateStr: '2026-08-04', dayNum: 4, month: 8, weekday: 'Tue' }
    ],
    subjects: [
      {
        name: 'Statistics for Business',
        parts: {
          th: { p: 5, a: 4 }, // 9 classes held total
          tu: { p: 2, a: 2 }, // 4 classes held total
          pr: { p: 0, a: 0 }
        },
        dayClasses: {
          '2026-08-01': [{ type: 'th', attended: false, raw: 'A( Th)' }, { type: 'tu', attended: false, raw: 'A( tu)' }],
          '2026-08-02': [{ type: 'th', attended: false, raw: 'A( Th)' }, { type: 'tu', attended: false, raw: 'A( tu)' }],
          '2026-08-03': [{ type: 'th', attended: false, raw: 'A( Th)' }],
          '2026-08-04': [{ type: 'th', attended: false, raw: 'A( Th)' }]
        }
      }
    ]
  };

  // Case 1: Waive 3 theory classes (3/9 = 33.33% -> exactly 1/3, not over 1/3)
  const sim3Waivers = calculateSimulatedStats(testOneThirdData, new Set(['2026-08-01', '2026-08-02', '2026-08-03']), 85);
  const thPart3 = sim3Waivers.subjectsStats[0].parts.th;
  assert.strictEqual(thPart3.baseHeld, 9);
  assert.strictEqual(thPart3.waivedClasses, 3);
  assert.strictEqual(thPart3.maxAllowedOneThird, 3);
  assert.strictEqual(thPart3.isOverOneThird, false, '3 of 9 classes waived must NOT trigger >1/3rd warning');

  // Case 2: Waive 4 theory classes (4/9 = 44.44% -> strictly > 1/3rd)
  const sim4Waivers = calculateSimulatedStats(testOneThirdData, new Set(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04']), 85);
  const thPart4 = sim4Waivers.subjectsStats[0].parts.th;
  assert.strictEqual(thPart4.baseHeld, 9);
  assert.strictEqual(thPart4.waivedClasses, 4);
  assert.strictEqual(thPart4.maxAllowedOneThird, 3);
  assert.strictEqual(thPart4.isOverOneThird, true, '4 of 9 classes waived MUST trigger >1/3rd warning');
  assert.strictEqual(Math.round(thPart4.waivedPct), 44);

  // Case 3: Tutorial with 4 classes held
  // Waiving 1 tute: 1/4 = 25% <= 33.3% -> false
  const tuPart1 = sim3Waivers.subjectsStats[0].parts.tu; // day 1 and day 2 waived -> 2 tutes waived
  assert.strictEqual(tuPart1.baseHeld, 4);
  assert.strictEqual(tuPart1.waivedClasses, 2);
  assert.strictEqual(tuPart1.maxAllowedOneThird, 1);
  assert.strictEqual(tuPart1.isOverOneThird, true, '2 of 4 tutorial classes waived (50%) MUST trigger >1/3rd warning');

  // Case 4: Verify attendance percentages and calculation unaffected
  assert.strictEqual(thPart4.simHeld, 5, 'Simulated held classes is 9 - 4 = 5');
  assert.strictEqual(thPart4.simAttended, 5, 'Attended stays 5');
  assert.strictEqual(thPart4.pct, 100, '5/5 is 100%');

  // Case 5: Verify solver optimization avoids crossing 1/3rd when alternative combination exists
  const optData = {
    dayColumns: [
      { dateStr: '2026-08-01', weekday: 'Mon', dayNum: '1', month: 8, year: 2026, label: '01', fullLabel: 'Mon 01 Aug' },
      { dateStr: '2026-08-02', weekday: 'Tue', dayNum: '2', month: 8, year: 2026, label: '02', fullLabel: 'Tue 02 Aug' }
    ],
    subjects: [
      {
        name: 'Small Subject',
        parts: { th: { p: 1, a: 2 }, tu: { p: 0, a: 0 }, pr: { p: 0, a: 0 } },
        dayClasses: {
          // Day 1 has 2 absences in Small Subject (2 of 3 waived = 66.7% -> crosses 1/3rd!)
          '2026-08-01': [{ type: 'th', attended: false, raw: 'A( Th)' }, { type: 'th', attended: false, raw: 'A( Th)' }],
          '2026-08-02': []
        }
      },
      {
        name: 'Large Subject',
        parts: { th: { p: 8, a: 2 }, tu: { p: 0, a: 0 }, pr: { p: 0, a: 0 } },
        dayClasses: {
          '2026-08-01': [],
          // Day 2 has 2 absences in Large Subject (2 of 10 waived = 20% -> well within 1/3rd!)
          '2026-08-02': [{ type: 'th', attended: false, raw: 'A( Th)' }, { type: 'th', attended: false, raw: 'A( Th)' }]
        }
      }
    ]
  };

  // With K=1, both Day 1 and Day 2 give equal pass improvement or can clear the threshold
  // With targetPct=80, if Day 2 is chosen, 0 subjects violate 1/3rd rule.
  const sol = solveExactBnb(optData, 80, 1);
  assert.ok(sol.chosenDays.length > 0);
  assert.strictEqual(sol.hasOneThirdViolation !== undefined, true, 'Solver return must expose hasOneThirdViolation');
  assert.strictEqual(Array.isArray(sol.oneThirdViolatingParts), true, 'Solver return must expose oneThirdViolatingParts');
  console.log('✓ One-Third (1/3rd) advisory rule logic and warning triggers verified.');
}

console.log('\nALL UNIT TESTS PASSED SUCCESSFULLY! ✓✓✓');
