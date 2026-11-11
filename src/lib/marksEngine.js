/**
 * SSCBS OS - DU UGCF NEP Attendance Marks Engine
 * Exact mathematical modeling of DU Ordinance VIII-E and UGCF 2022 Internal Assessment
 */

export const DU_PERCENTAGE_SLABS = [
  { minPct: 85.0, level: 5, fraction: 1.0, label: '85%+ (Full Marks)' },
  { minPct: 80.0, level: 4, fraction: 0.8, label: '80% - 84.9%' },
  { minPct: 75.0, level: 3, fraction: 0.6, label: '75% - 79.9%' },
  { minPct: 70.0, level: 2, fraction: 0.4, label: '70% - 74.9%' },
  { minPct: 66.666, level: 1, fraction: 0.2, label: '66.7% - 69.9% (Safe)' },
  { minPct: 0.0, level: 0, fraction: 0.0, label: '<66.7% (Debar Risk)' }
];

/**
 * Returns discrete slab level from 0 to 5
 */
export function getSlabLevel(pct) {
  if (pct >= 85.0) return 5;
  if (pct >= 80.0) return 4;
  if (pct >= 75.0) return 3;
  if (pct >= 70.0) return 2;
  if (pct >= 66.666) return 1;
  return 0;
}

/**
 * Standard credit options that can be toggled for Theory
 */
export const CREDIT_OPTIONS = [
  { value: 6, label: '4 Credits Core (3L+1T or 3L+1P · 6M Theory)', shortLabel: '4 Credits · 6M' },
  { value: 4, label: '4 Credits GE / 2-Credit AEC (2L · 4M Theory)', shortLabel: '4C GE / 2C AEC · 4M' },
  { value: 2, label: '2 Credits Blended SEC / VAC (1L+1P · 2M Theory)', shortLabel: '2 Credits · 2M' }
];

/**
 * Helper to get held class count across raw or simulated formats
 */
function getPartHeld(part) {
  if (!part) return 0;
  if (Number.isFinite(part.simN)) return part.simN;
  if (Number.isFinite(part.simHeld)) return part.simHeld;
  if (Number.isFinite(part.n)) return part.n;
  if (Number.isFinite(part.held)) return part.held;
  const p = part.p ?? part.attended ?? 0;
  const a = part.a ?? part.absent ?? 0;
  return p + a;
}

/**
 * Helper to get attended class count across raw or simulated formats
 */
function getPartAttended(part) {
  if (!part) return 0;
  if (Number.isFinite(part.simP)) return part.simP;
  if (Number.isFinite(part.simAttended)) return part.simAttended;
  if (Number.isFinite(part.p)) return part.p;
  if (Number.isFinite(part.attended)) return part.attended;
  return 0;
}

/**
 * Automatically infers default max marks based on available components
 * in DU UGCF NEP:
 * - Has Tutorial (TU) -> Rule 1: 4-Credit Core (Theory 6M, Tutorial 5M)
 * - Has Practical (PR) only -> Rule 2: Pure Practical (0M)
 * - Has TH only -> Rule 3: 2-Credit Pure Theory / AEC (Theory 4M)
 * - Has TH + PR -> Rule 4: Structural contact hour math distinguishes 4C vs 2C:
 *     (thHeld > prHeld) || (thHeld >= 16) || (totalHeld >= 40)
 *     -> 4-Credit Core/GE with Lab (Theory 6M, Practical 0M)
 *     -> Otherwise 2-Credit Blended SEC/VAC (Theory 2M, Practical 0M)
 */
export function inferDefaultMaxMarks(subject) {
  const parts = subject?.parts || {};
  const hasTU = getPartHeld(parts.tu) > 0;
  const hasPR = getPartHeld(parts.pr) > 0;
  const hasTH = getPartHeld(parts.th) > 0;
  const thHeld = getPartHeld(parts.th);
  const prHeld = getPartHeld(parts.pr);
  const totalHeld = thHeld + prHeld;

  let thMax = 6.0;
  let tuMax = hasTU ? 5.0 : 0.0;
  let prMax = 0.0; // DU UGCF rule: 0 marks for practical attendance
  let defaultCredit = 6;

  if (hasTU) {
    // Rule 1: 4-Credit Core with Tutorial (3L + 1T): 6M Theory + 5M Tutorial = 11M
    thMax = 6.0;
    defaultCredit = 6;
  } else if (hasTH && hasPR) {
    // Rule 4: Both Theory and Practical present.
    // Dissect 4-Credit Core/GE (3L+1P or 2L+2P) vs 2-Credit Blended SEC/VAC (1L+1P) via pure timetable math:
    // 1. In 3L+1P, Theory contact hours exceed Practical (thHeld > prHeld)
    // 2. High lecture volume (thHeld >= 16) indicates 2-3 lectures/week vs 1 lecture/week in 1L courses
    // 3. High combined volume (totalHeld >= 40) reflects major 4-credit papers with lab sessions
    const is4CreditBlended = (thHeld > prHeld) || (thHeld >= 16) || (totalHeld >= 40);
    if (is4CreditBlended) {
      thMax = 6.0;
      defaultCredit = 6;
    } else {
      thMax = 2.0;
      defaultCredit = 2;
    }
  } else if (hasTH && !hasPR && !hasTU) {
    // Rule 3: Pure Theory without Tutorial/Practical (e.g. 2-Credit AEC 2L): 4.0 M
    thMax = 4.0;
    defaultCredit = 4;
  } else if (!hasTH && hasPR) {
    // Rule 2: Pure Practical / Lab (e.g. 2-Credit SEC Lab with 0 lectures): 0.0 M
    thMax = 0.0;
    defaultCredit = 0;
  }

  return { th: thMax, tu: tuMax, pr: prMax, defaultCredit };
}

/**
 * Returns dynamic credit options for a subject tailored to its structural profile:
 * - Theory + Tutorial (OB, Macro): 6M Th + 5M Tu = 11M, 4M Th + 5M Tu = 9M, 2M Th + 5M Tu = 7M
 * - Theory + Practical (IBA, BI, SEL): 6M Th + 0M Pr = 6M, 4M Th + 0M Pr = 4M, 2M Th + 0M Pr = 2M
 * - Pure Theory (Hindi B, AEC): 6M Th = 6M, 4M Th = 4M, 2M Th = 2M
 */
export function getSubjectCreditOptions(subject) {
  const parts = subject?.parts || {};
  const hasTU = getPartHeld(parts.tu) > 0;
  const hasPR = getPartHeld(parts.pr) > 0;

  if (hasTU) {
    return [
      { value: 6, label: '4C · 11M', tooltip: '4 Credits Core / GE (6M Theory + 5M Tutorial = 11M Total)' },
      { value: 4, label: '4C · 9M', tooltip: '4 Credits GE / Elective (4M Theory + 5M Tutorial = 9M Total)' },
      { value: 2, label: '2C · 7M', tooltip: '2 Credits Blended (2M Theory + 5M Tutorial = 7M Total)' }
    ];
  }

  if (hasPR) {
    return [
      { value: 6, label: '4C · 6M', tooltip: '4 Credits Core (3L+1P: 6M Theory + 0M Practical = 6M Total)' },
      { value: 4, label: 'GE · 4M', tooltip: '4 Credits GE (2L+2P: 4M Theory + 0M Practical = 4M Total)' },
      { value: 2, label: '2C · 2M', tooltip: '2 Credits SEC / VAC (1L+1P: 2M Theory + 0M Practical = 2M Total)' }
    ];
  }

  return [
    { value: 6, label: '4C · 6M', tooltip: '4 Credits Pure Theory (4L: 6M Theory Total)' },
    { value: 4, label: '2C · 4M', tooltip: '2 Credits AEC (2L: 4M Theory Total)' },
    { value: 2, label: '2C · 2M', tooltip: '2 Credits SEC / VAC (1L: 2M Theory Total)' }
  ];
}

/**
 * Calculate component attendance marks given percentage and max marks
 */
export function calculateComponentMarks(pct, maxMarks) {
  if (maxMarks <= 0 || !Number.isFinite(pct) || pct < 66.666) {
    return 0.0;
  }
  const level = getSlabLevel(pct);
  const marks = (maxMarks * level) / 5;
  return Math.round(marks * 10) / 10;
}

/**
 * Returns hint text and next marks bump for a component
 */
export function getComponentMarksInsight(pct, maxMarks, held, attended) {
  if (maxMarks <= 0) {
    return { isPractical: true, hint: 'Practical attendance carries 0 internal marks (DU UGCF)' };
  }
  const level = getSlabLevel(pct);
  const currentMarks = calculateComponentMarks(pct, maxMarks);

  if (level === 5) {
    // How many classes can be missed before dropping below 85%?
    let missable = 0;
    if (held > 0 && attended > 0) {
      missable = Math.max(0, Math.floor((100 * attended - 85 * held) / 85));
    }
    return {
      level: 5,
      currentMarks,
      maxMarks,
      isFull: true,
      missable,
      hint: missable > 0 
        ? `Full marks! Can miss ${missable} class${missable === 1 ? '' : 'es'} without losing marks.`
        : "Full marks! Don't miss next class to stay at 85%."
    };
  }

  // Next slab target
  const nextTargetPct = level === 0 ? 66.667 : (level === 1 ? 70.0 : (level === 2 ? 75.0 : (level === 3 ? 80.0 : 85.0)));
  const nextMarks = Math.round((maxMarks * (level + 1) / 5) * 10) / 10;
  const marksGain = Math.round((nextMarks - currentMarks) * 10) / 10;

  // Classes needed in a row to reach nextTargetPct:
  let classesNeeded = 0;
  if (held > 0) {
    const s = nextTargetPct * held - 100 * attended;
    classesNeeded = Math.max(0, Math.ceil(s / (100 - nextTargetPct)));
  }

  return {
    level,
    currentMarks,
    maxMarks,
    isFull: false,
    nextTargetPct,
    classesNeeded,
    marksGain,
    hint: classesNeeded > 0
      ? `Attend next ${classesNeeded} class${classesNeeded === 1 ? '' : 'es'} for +${marksGain.toFixed(1)} M (reach ${nextTargetPct}%)`
      : `Attend next class for +${marksGain.toFixed(1)} M`
  };
}

/**
 * Calculate complete marks state for a single subject
 */
export function calculateSubjectMarks(subject, creditOverride = null) {
  const defaults = inferDefaultMaxMarks(subject);
  const thMax = creditOverride !== null && Number.isFinite(Number(creditOverride)) 
    ? Number(creditOverride) 
    : defaults.th;
  const tuMax = defaults.tu;
  const prMax = defaults.pr;

  const parts = subject?.parts || {};
  const thPart = parts.th;
  const tuPart = parts.tu;
  const prPart = parts.pr;

  const thHeld = getPartHeld(thPart);
  const tuHeld = getPartHeld(tuPart);
  const prHeld = getPartHeld(prPart);

  const thAttended = getPartAttended(thPart);
  const tuAttended = getPartAttended(tuPart);
  const prAttended = getPartAttended(prPart);

  const calcPct = (p, n) => (n > 0 ? (100 * p) / n : 100);

  const thPct = thPart ? (Number.isFinite(thPart.simPct) ? thPart.simPct : (Number.isFinite(thPart.pct) ? thPart.pct : calcPct(thAttended, thHeld))) : 0;
  const tuPct = tuPart ? (Number.isFinite(tuPart.simPct) ? tuPart.simPct : (Number.isFinite(tuPart.pct) ? tuPart.pct : calcPct(tuAttended, tuHeld))) : 0;
  const prPct = prPart ? (Number.isFinite(prPart.simPct) ? prPart.simPct : (Number.isFinite(prPart.pct) ? prPart.pct : calcPct(prAttended, prHeld))) : 0;

  const thBasePct = thPart ? (Number.isFinite(thPart.basePct) ? thPart.basePct : (Number.isFinite(thPart.pct) ? thPart.pct : calcPct(thPart.p ?? 0, (thPart.p ?? 0) + (thPart.a ?? 0)))) : 0;
  const tuBasePct = tuPart ? (Number.isFinite(tuPart.basePct) ? tuPart.basePct : (Number.isFinite(tuPart.pct) ? tuPart.pct : calcPct(tuPart.p ?? 0, (tuPart.p ?? 0) + (tuPart.a ?? 0)))) : 0;

  const thWaiverPct = thPart ? (Number.isFinite(thPart.waiverPct) ? thPart.waiverPct : thPct) : 0;
  const tuWaiverPct = tuPart ? (Number.isFinite(tuPart.waiverPct) ? tuPart.waiverPct : tuPct) : 0;

  const thEarned = thHeld > 0 ? calculateComponentMarks(thPct, thMax) : 0;
  const tuEarned = tuHeld > 0 ? calculateComponentMarks(tuPct, tuMax) : 0;
  const prEarned = 0.0;

  const thBaseEarned = thHeld > 0 ? calculateComponentMarks(thBasePct, thMax) : 0;
  const tuBaseEarned = tuHeld > 0 ? calculateComponentMarks(tuBasePct, tuMax) : 0;

  const thWaiverEarned = thHeld > 0 ? calculateComponentMarks(thWaiverPct, thMax) : 0;
  const tuWaiverEarned = tuHeld > 0 ? calculateComponentMarks(tuWaiverPct, tuMax) : 0;

  const subjectMax = (thHeld > 0 ? thMax : 0) + (tuHeld > 0 ? tuMax : 0);
  const subjectEarned = (thHeld > 0 ? thEarned : 0) + (tuHeld > 0 ? tuEarned : 0);
  const subjectBaseEarned = (thHeld > 0 ? thBaseEarned : 0) + (tuHeld > 0 ? tuBaseEarned : 0);
  const subjectWaiverEarned = (thHeld > 0 ? thWaiverEarned : 0) + (tuHeld > 0 ? tuWaiverEarned : 0);

  const componentSegments = [];
  if (thHeld > 0) {
    const baseW = Math.min(100, (thBaseEarned / thMax) * 100);
    const waiverW = Math.min(100, (thWaiverEarned / thMax) * 100);
    const cdcW = Math.min(100, (thEarned / thMax) * 100);
    componentSegments.push({
      name: 'Theory',
      max: thMax,
      got: thEarned % 1 === 0 ? thEarned.toFixed(0) : thEarned.toFixed(1),
      baseW: `${baseW}%`,
      gainW: `${Math.max(0, waiverW - baseW)}%`,
      cdcL: `${waiverW}%`,
      cdcW: `${Math.max(0, cdcW - waiverW)}%`
    });
  }
  if (tuHeld > 0) {
    const baseW = Math.min(100, (tuBaseEarned / tuMax) * 100);
    const waiverW = Math.min(100, (tuWaiverEarned / tuMax) * 100);
    const cdcW = Math.min(100, (tuEarned / tuMax) * 100);
    componentSegments.push({
      name: 'Tutorial',
      max: tuMax,
      got: tuEarned % 1 === 0 ? tuEarned.toFixed(0) : tuEarned.toFixed(1),
      baseW: `${baseW}%`,
      gainW: `${Math.max(0, waiverW - baseW)}%`,
      cdcL: `${waiverW}%`,
      cdcW: `${Math.max(0, cdcW - waiverW)}%`
    });
  }

  return {
    thMax,
    tuMax,
    prMax,
    thEarned,
    thBaseEarned,
    thWaiverEarned,
    tuEarned,
    tuBaseEarned,
    tuWaiverEarned,
    prEarned,
    thHeld,
    tuHeld,
    prHeld,
    subjectMax: Math.round(subjectMax * 10) / 10,
    subjectEarned: Math.round(subjectEarned * 10) / 10,
    subjectBaseEarned: Math.round(subjectBaseEarned * 10) / 10,
    subjectWaiverEarned: Math.round(subjectWaiverEarned * 10) / 10,
    subjectGain: Math.round((subjectEarned - subjectBaseEarned) * 10) / 10,
    subjectWaiverGain: Math.round((subjectWaiverEarned - subjectBaseEarned) * 10) / 10,
    subjectCdcGain: Math.round((subjectEarned - subjectWaiverEarned) * 10) / 10,
    componentSegments,
    thInsight: thHeld > 0 ? getComponentMarksInsight(thPct, thMax, thHeld, thAttended) : null,
    tuInsight: tuHeld > 0 ? getComponentMarksInsight(tuPct, tuMax, tuHeld, tuAttended) : null,
    prInsight: prHeld > 0 ? { isPractical: true, hint: 'Practical attendance carries 0 internal marks (DU UGCF)' } : null
  };
}

/**
 * Calculate grand aggregate marks across all subjects
 */
export function calculateAggregateMarks(subjects, creditOverrides = {}) {
  if (!subjects || subjects.length === 0) {
    return { earned: 0, baseEarned: 0, waiverEarned: 0, maxMarks: 0, pct: 0, gain: 0, waiverGain: 0, cdcGain: 0 };
  }

  let totalEarned = 0;
  let totalBaseEarned = 0;
  let totalWaiverEarned = 0;
  let totalMax = 0;

  subjects.forEach(sub => {
    const override = creditOverrides[sub.name] ?? null;
    const res = calculateSubjectMarks(sub, override);
    totalEarned += res.subjectEarned;
    totalBaseEarned += res.subjectBaseEarned;
    totalWaiverEarned += res.subjectWaiverEarned;
    totalMax += res.subjectMax;
  });

  const earned = Math.round(totalEarned * 10) / 10;
  const baseEarned = Math.round(totalBaseEarned * 10) / 10;
  const waiverEarned = Math.round(totalWaiverEarned * 10) / 10;
  const maxMarks = Math.round(totalMax * 10) / 10;
  const gain = Math.round((earned - baseEarned) * 10) / 10;
  const waiverGain = Math.round((waiverEarned - baseEarned) * 10) / 10;
  const cdcGain = Math.round((earned - waiverEarned) * 10) / 10;
  const pct = maxMarks > 0 ? Math.round((earned / maxMarks) * 1000) / 10 : 0;

  return {
    earned,
    baseEarned,
    waiverEarned,
    maxMarks,
    gain,
    waiverGain,
    cdcGain,
    pct
  };
}
