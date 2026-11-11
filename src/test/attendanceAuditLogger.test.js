import assert from 'node:assert';
import {
  compileAttendanceChangelog,
  countTotalAuditChanges
} from '../lib/attendanceAuditLogger.js';

console.log('--- RUNNING ATTENDANCE AUDIT LOGGER TESTS ---');

const baseRawData = {
  reportDate: '2026-11-07',
  dayColumns: [
    { dateStr: '2026-08-10', dayNum: 10, label: '10 Aug', weekday: 'Mon' },
    { dateStr: '2026-09-15', dayNum: 15, label: '15 Sep', weekday: 'Tue' },
    { dateStr: '2026-09-22', dayNum: 22, label: '22 Sep', weekday: 'Tue' },
    { dateStr: '2026-10-05', dayNum: 5, label: '5 Oct', weekday: 'Mon' }
  ],
  subjects: [
    {
      name: 'Organisational Behaviour',
      rollNo: '2026-1049',
      dayClasses: {
        '2026-08-10': [{ attended: false, type: 'tu' }],
        '2026-09-15': [{ attended: true, type: 'th' }],
        '2026-09-22': [{ attended: false, type: 'th' }],
        '2026-10-05': [{ attended: false, type: 'tu' }]
      }
    },
    {
      name: 'Macro Economics',
      rollNo: '2026-1049',
      dayClasses: {
        '2026-08-10': [{ attended: false, type: 'th' }],
        '2026-09-15': [{ attended: false, type: 'th' }],
        '2026-09-22': [{ attended: true, type: 'th' }],
        '2026-10-05': [{ attended: true, type: 'th' }]
      }
    }
  ]
};

// Simulate customized active data:
// 1. One cell edited: OB on 2026-09-22 changed from Absent to Present
// 2. One date added: 2026-11-10 (speculative future date)
const currentData = {
  ...baseRawData,
  dayColumns: [
    ...baseRawData.dayColumns,
    { dateStr: '2026-11-10', dayNum: 10, label: '10 Nov', weekday: 'Tue' }
  ],
  subjects: [
    {
      ...baseRawData.subjects[0],
      dayClasses: {
        ...baseRawData.subjects[0].dayClasses,
        '2026-09-22': [{ attended: true, type: 'th' }], // Edited A -> P
        '2026-11-10': [{ attended: true, type: 'tu' }] // Added future class
      }
    },
    {
      ...baseRawData.subjects[1],
      dayClasses: {
        ...baseRawData.subjects[1].dayClasses,
        '2026-11-10': [{ attended: false, type: 'th' }] // Added future class
      }
    }
  ]
};

const selectedWaivers = new Set(['2026-08-10', '2026-10-05']);
const selectedCdcDays = new Set(['2026-09-15']);
const priorityDates = new Set(['2026-08-10']);
const blacklistedDates = new Set(['2026-09-22']);
const creditOverrides = { 'Organisational Behaviour': 6 };
const specialAttendanceAdjustment = { attended: 1, held: 1 };
const totalsSummary = {
  overall: {
    basePct: 60.0,
    pct: 75.0,
    att: 15,
    held: 20,
    baseAtt: 12,
    baseHeld: 20
  },
  theory: { basePct: 62.5, pct: 75.0 },
  tutorial: { basePct: 50.0, pct: 75.0, held: 8, baseHeld: 8 }
};
const aggregateMarks = {
  baseEarned: 10.0,
  earned: 16.5,
  maxMarks: 22.0
};

// Test count
const totalCount = countTotalAuditChanges({
  selectedWaivers,
  selectedCdcDays,
  priorityDates,
  blacklistedDates,
  creditOverrides,
  specialAttendanceAdjustment,
  customizationDiff: { totalChanges: 2 }
});
assert.strictEqual(totalCount, 2 + 1 + 1 + 1 + 1 + 1 + 2, 'Total change count must be exact');

// Test changelog output
const changelog = compileAttendanceChangelog({
  rawParsedData: baseRawData,
  currentParsedData: currentData,
  selectedWaivers,
  selectedCdcDays,
  priorityDates,
  blacklistedDates,
  creditOverrides,
  specialAttendanceAdjustment,
  totalsSummary,
  aggregateMarks,
  fileMeta: { name: 'Student_Attendance_Test.xls' }
});

assert(changelog.includes('SSCBS ATTENDANCE PLAN & AUDIT LOG'), 'Must have title');
assert(changelog.includes('Overall Attendance: 60.0%'), 'Must report base attendance');
assert(changelog.includes('➔ 75.0%'), 'Must report final attendance');
assert(changelog.includes('Continuous Assessment Marks: 10.0 / 22.0 M ➔ 16.5 / 22.0 M'), 'Must report marks');
assert(changelog.includes('10 Aug (Mon) [★ Approved Society Priority Date]'), 'Must note priority on waiver');
assert(changelog.includes('15 Sep (Tue)'), 'Must list CDC date');
assert(changelog.includes('10 Nov (Tue) [🔮 Speculative Future Date]'), 'Must note future date added');
assert(changelog.includes('22 Sep (Tue)'), 'Must report blacklisted date');
assert(changelog.includes('Blacklisted / Blocked Dates (1) — Protected from waivers:'), 'Must report blacklisted section');
assert(changelog.includes('Special Institutional Adjustment: +1 Attended / +1 Held'), 'Must report duty leave');

console.log('ALL AUDIT LOGGER TESTS PASSED SUCCESSFULLY! ✓');
