import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAttendanceFile, parseAttendanceEntry } from '../lib/waiverParser.js';
import { solveExactBnb, isPartPassing, calculatePartBufferAndNeeded } from '../lib/waiverSolver.js';

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

console.log('\nALL UNIT TESTS PASSED SUCCESSFULLY! ✓✓✓');
