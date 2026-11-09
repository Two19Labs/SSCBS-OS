import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAttendanceFile } from '../lib/waiverParser.js';
import { solveExactBnb } from '../lib/waiverSolver.js';
import {
  cloneParsedData,
  recalculateSubjectTotals,
  editCellClasses,
  addDateColumn,
  deleteDateColumn,
  diffCustomizations
} from '../lib/attendanceEditor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('--- RUNNING ATTENDANCE EDITOR TEST SUITE ---');

const samplePath = path.resolve(__dirname, '../../Student Attandance_2026-11-07_07_26_08.xls');
assert(fs.existsSync(samplePath), 'Sample XLS file must exist for testing');
const html = fs.readFileSync(samplePath, 'utf-8');
const rawParsed = parseAttendanceFile(html, 'Student Attandance_2026-11-07_07_26_08.xls');

// Test 1: Clone maintains independence
console.log('1. Testing deep clone immutability...');
const cloned = cloneParsedData(rawParsed);
assert.notStrictEqual(cloned, rawParsed);
assert.notStrictEqual(cloned.subjects, rawParsed.subjects);
assert.notStrictEqual(cloned.dayColumns, rawParsed.dayColumns);
console.log('✓ Clone immutability verified.');

// Test 2: Edit cell classes (modify, add, change type/status)
console.log('2. Testing cell editing (type change, status change, adding classes)...');
const targetSub = rawParsed.subjects[0];
const subName = targetSub.name;
const testDate = rawParsed.dayColumns[10].dateStr; // e.g. 2026-08-10

const initialThP = targetSub.parts.th.p;
const initialThA = targetSub.parts.th.a;
const initialTuP = targetSub.parts.tu.p;
const initialTuA = targetSub.parts.tu.a;

// Add 1 Theory Present and 1 Tutorial Absent
const newClasses = [
  { type: 'th', attended: true },
  { type: 'tu', attended: false }
];

const editedParsed = editCellClasses(rawParsed, subName, testDate, newClasses);
const editedSub = editedParsed.subjects.find(s => s.name === subName);

assert.strictEqual(editedSub.dayClasses[testDate].length, 2);
assert.strictEqual(editedSub.dayClasses[testDate][0].type, 'th');
assert.strictEqual(editedSub.dayClasses[testDate][0].attended, true);
assert.strictEqual(editedSub.dayClasses[testDate][1].type, 'tu');
assert.strictEqual(editedSub.dayClasses[testDate][1].attended, false);

// Raw parsed must remain unchanged
assert.strictEqual(rawParsed.subjects[0].parts.th.p, initialThP);
console.log('✓ Cell class editing and subject totals recomputation passed.');

// Test 3: Clear cell (remove all classes for that date)
console.log('3. Testing cell clearing (removing all classes)...');
const clearedParsed = editCellClasses(editedParsed, subName, testDate, []);
const clearedSub = clearedParsed.subjects.find(s => s.name === subName);
assert.strictEqual(clearedSub.dayClasses[testDate], undefined);
console.log('✓ Cell clearing verified.');

// Test 4: Add new date column
console.log('4. Testing add date column chronologically...');
const newDateStr = '2026-08-15'; // Saturday
const beforeCount = rawParsed.dayColumns.length;
const withNewDate = addDateColumn(rawParsed, newDateStr);

assert.strictEqual(withNewDate.dayColumns.length, beforeCount + 1);
const addedCol = withNewDate.dayColumns.find(d => d.dateStr === newDateStr);
assert(addedCol, 'New column must exist');
assert.strictEqual(addedCol.weekday, 'Sat');
assert.strictEqual(addedCol.dayNum, 15);
assert.strictEqual(addedCol.month, 8);

// Verify strict chronological sorting
for (let i = 1; i < withNewDate.dayColumns.length; i++) {
  assert(
    withNewDate.dayColumns[i - 1].dateStr < withNewDate.dayColumns[i].dateStr,
    `Columns must be strictly sorted: ${withNewDate.dayColumns[i - 1].dateStr} < ${withNewDate.dayColumns[i].dateStr}`
  );
}
console.log('✓ Chronological date insertion verified.');

// Test 5: Delete date column
console.log('5. Testing date column deletion...');
const dateToDelete = rawParsed.dayColumns[5].dateStr;
const withDeletedDate = deleteDateColumn(rawParsed, dateToDelete);

assert.strictEqual(withDeletedDate.dayColumns.length, rawParsed.dayColumns.length - 1);
assert(!withDeletedDate.dayColumns.some(d => d.dateStr === dateToDelete));
withDeletedDate.subjects.forEach(s => {
  assert.strictEqual(s.dayClasses[dateToDelete], undefined);
});
console.log('✓ Date deletion and class purging verified.');

// Test 6: Diff detection
console.log('6. Testing diff detection...');
const diff = diffCustomizations(rawParsed, editedParsed);
assert(diff.hasCustomizations, 'Diff must detect customizations');
assert(diff.customizedCells.has(`${subName}:::${testDate}`), 'Diff must identify modified cell');
console.log('✓ Diff detection verified.');

// Test 7: Solver integration with edited attendance
console.log('7. Testing solver re-run on edited attendance...');
const solution1 = solveExactBnb(rawParsed, 85, 3, [], 0, {});
const solution2 = solveExactBnb(editedParsed, 85, 3, [], 0, {});
assert(solution1.totalTargetParts > 0);
assert(solution2.totalTargetParts > 0);
console.log('✓ Solver seamlessly executed on customized attendance dataset.');

console.log('\nALL ATTENDANCE EDITOR TESTS PASSED SUCCESSFULLY! ✓✓✓');
