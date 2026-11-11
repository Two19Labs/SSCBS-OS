import assert from 'node:assert';
import {
  getSubjectCreditOptions,
  calculateSubjectMarks,
  calculateAggregateMarks
} from '../lib/marksEngine.js';

console.log('--- RUNNING MARKS ENGINE TESTS ---');

// 1. Profile 1: Theory + Tutorial (e.g., OB, Macro, Cost Accounting)
const subTutorial = {
  name: 'Organisational Behaviour',
  parts: {
    th: { p: 20, a: 5, held: 25 },
    tu: { p: 8, a: 2, held: 10 }
  }
};

const tuOptions = getSubjectCreditOptions(subTutorial);
assert.strictEqual(tuOptions.length, 3, 'Must have 3 credit options');
assert.strictEqual(tuOptions[0].value, 6);
assert.strictEqual(tuOptions[0].label, '4C · 11M');
assert.strictEqual(tuOptions[1].value, 4);
assert.strictEqual(tuOptions[1].label, '4C · 9M');
assert.strictEqual(tuOptions[2].value, 2);
assert.strictEqual(tuOptions[2].label, '2C · 7M');

// Default marks for OB (4 credits core)
const obDefaultMarks = calculateSubjectMarks(subTutorial);
assert.strictEqual(obDefaultMarks.thMax, 6.0);
assert.strictEqual(obDefaultMarks.tuMax, 5.0);
assert.strictEqual(obDefaultMarks.subjectMax, 11.0, 'Total max marks must be 11M matching 4C · 11M');

// Overridden marks for OB (e.g. 4 credits GE: 4M Theory + 5M Tutorial = 9M)
const obGeMarks = calculateSubjectMarks(subTutorial, 4);
assert.strictEqual(obGeMarks.thMax, 4.0);
assert.strictEqual(obGeMarks.tuMax, 5.0);
assert.strictEqual(obGeMarks.subjectMax, 9.0, 'Total max marks must be 9M matching 4C · 9M');

// 2. Profile 2: Theory + Practical (e.g., IBA, BI, SEL)
const subPractical = {
  name: 'Introduction to Business Analytics',
  parts: {
    th: { p: 18, a: 2, held: 20 },
    pr: { p: 8, a: 2, held: 10 }
  }
};

const prOptions = getSubjectCreditOptions(subPractical);
assert.strictEqual(prOptions.length, 3, 'Must have 3 credit options');
assert.strictEqual(prOptions[0].value, 6);
assert.strictEqual(prOptions[0].label, '4C · 6M');
assert.strictEqual(prOptions[1].value, 4);
assert.strictEqual(prOptions[1].label, 'GE · 4M');
assert.strictEqual(prOptions[2].value, 2);
assert.strictEqual(prOptions[2].label, '2C · 2M');

const ibaDefaultMarks = calculateSubjectMarks(subPractical);
assert.strictEqual(ibaDefaultMarks.thMax, 6.0);
assert.strictEqual(ibaDefaultMarks.prMax, 0.0);
assert.strictEqual(ibaDefaultMarks.subjectMax, 6.0, 'Total max marks must be 6M matching 4C · 6M');

// 3. Profile 3: Pure Theory (e.g., Hindi B BMS, AEC)
const subTheoryOnly = {
  name: 'Hindi B',
  parts: {
    th: { p: 15, a: 5, held: 20 }
  }
};

const thOptions = getSubjectCreditOptions(subTheoryOnly);
assert.strictEqual(thOptions.length, 3, 'Must have 3 credit options');
assert.strictEqual(thOptions[0].value, 6);
assert.strictEqual(thOptions[0].label, '4C · 6M');
assert.strictEqual(thOptions[1].value, 4);
assert.strictEqual(thOptions[1].label, '2C · 4M');
assert.strictEqual(thOptions[2].value, 2);
assert.strictEqual(thOptions[2].label, '2C · 2M');

const hindiDefaultMarks = calculateSubjectMarks(subTheoryOnly);
assert.strictEqual(hindiDefaultMarks.thMax, 4.0, 'Hindi B defaults to 2C AEC (4M)');
assert.strictEqual(hindiDefaultMarks.subjectMax, 4.0, 'Total max marks must be 4M matching 2C · 4M');

// 4. Aggregate marks test
const agg = calculateAggregateMarks([subTutorial, subPractical, subTheoryOnly], {
  'Organisational Behaviour': 6,
  'Introduction to Business Analytics': 6,
  'Hindi B': 4
});
assert.strictEqual(agg.maxMarks, 11 + 6 + 4, 'Aggregate max marks must be 21M');

console.log('ALL MARKS ENGINE TESTS PASSED SUCCESSFULLY!');
