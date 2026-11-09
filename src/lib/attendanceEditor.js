/**
 * SSCBS OS - Attendance Editor Engine
 * Pure functions for manual attendance customizations (cell class additions/edits/deletions,
 * date additions/deletions, subject totals recomputation, and diff detection).
 */

import { WEEKDAYS, MONTH_NAMES } from './waiverParser.js';

/**
 * Deep clones the parsedData object to maintain immutability.
 */
export function cloneParsedData(parsedData) {
  if (!parsedData) return null;
  return {
    ...parsedData,
    dayColumns: (parsedData.dayColumns || []).map(col => ({ ...col })),
    subjects: (parsedData.subjects || []).map(sub => ({
      ...sub,
      parts: {
        th: { ...(sub.parts?.th || { p: 0, a: 0 }) },
        tu: { ...(sub.parts?.tu || { p: 0, a: 0 }) },
        pr: { ...(sub.parts?.pr || { p: 0, a: 0 }) }
      },
      dayClasses: Object.fromEntries(
        Object.entries(sub.dayClasses || {}).map(([d, list]) => [
          d,
          (list || []).map(c => ({ ...c }))
        ])
      )
    }))
  };
}

/**
 * Recalculates subject totals (parts.th, parts.tu, parts.pr, parsedP, parsedA)
 * from all entries in its dayClasses mapping.
 */
export function recalculateSubjectTotals(subject) {
  let totalP = 0;
  let totalA = 0;
  const partsStats = {
    th: { p: 0, a: 0 },
    tu: { p: 0, a: 0 },
    pr: { p: 0, a: 0 }
  };

  const dayClasses = subject.dayClasses || {};
  Object.keys(dayClasses).forEach(dateStr => {
    const list = dayClasses[dateStr] || [];
    list.forEach(c => {
      if (c && !c.ignore) {
        const type = c.type === 'th' || c.type === 'tu' || c.type === 'pr' ? c.type : 'th';
        if (c.attended) {
          totalP++;
          partsStats[type].p++;
        } else {
          totalA++;
          partsStats[type].a++;
        }
      }
    });
  });

  return {
    ...subject,
    parsedP: totalP,
    parsedA: totalA,
    parts: partsStats
  };
}

/**
 * Edits the classes for a specific subject and date.
 * If newClasses is empty, removes that date entry from the subject's dayClasses.
 * Automatically recalculates subject totals.
 */
export function editCellClasses(parsedData, subjectName, dateStr, newClasses) {
  const cloned = cloneParsedData(parsedData);
  const subIdx = cloned.subjects.findIndex(s => s.name === subjectName);
  if (subIdx === -1) return cloned;

  const sub = cloned.subjects[subIdx];
  if (!sub.dayClasses) sub.dayClasses = {};

  const cleanClasses = (newClasses || [])
    .filter(c => c && (c.type === 'th' || c.type === 'tu' || c.type === 'pr'))
    .map(c => ({
      type: c.type,
      attended: Boolean(c.attended),
      raw: `${c.attended ? 'P' : 'A'}(${c.type.toUpperCase()})`,
      ignore: false,
      isCustom: true
    }));

  if (cleanClasses.length === 0) {
    delete sub.dayClasses[dateStr];
  } else {
    sub.dayClasses[dateStr] = cleanClasses;
  }

  cloned.subjects[subIdx] = recalculateSubjectTotals(sub);
  return cloned;
}

/**
 * Adds a new date column into parsedData.dayColumns in strict chronological order.
 * If the date already exists, returns parsedData unchanged.
 */
export function addDateColumn(parsedData, newDateStr) {
  if (!newDateStr) return parsedData;
  const cloned = cloneParsedData(parsedData);
  const exists = cloned.dayColumns.some(d => d.dateStr === newDateStr);
  if (exists) return cloned;

  const parts = newDateStr.split('-');
  if (parts.length < 3) return parsedData;

  const curYear = parseInt(parts[0], 10);
  const curMonth = parseInt(parts[1], 10);
  const dayNum = parseInt(parts[2], 10);
  if (isNaN(curYear) || isNaN(curMonth) || isNaN(dayNum)) return parsedData;

  const dateObj = new Date(Date.UTC(curYear, curMonth - 1, dayNum));
  const weekday = WEEKDAYS[dateObj.getUTCDay()];
  const monthLabel = MONTH_NAMES[curMonth - 1];

  const newCol = {
    colIdx: cloned.dayColumns.length + 1000,
    dayNum,
    year: curYear,
    month: curMonth,
    dateStr: newDateStr,
    weekday,
    label: `${dayNum} ${monthLabel}`,
    fullLabel: `${weekday} ${dayNum} ${monthLabel}`,
    isCustom: true
  };

  cloned.dayColumns.push(newCol);
  cloned.dayColumns.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  return cloned;
}

/**
 * Deletes an entire date column from dayColumns and purges it from all subject dayClasses.
 * Recalculates subject totals for all affected subjects.
 */
export function deleteDateColumn(parsedData, dateStr) {
  if (!dateStr) return parsedData;
  const cloned = cloneParsedData(parsedData);
  cloned.dayColumns = cloned.dayColumns.filter(d => d.dateStr !== dateStr);

  cloned.subjects = cloned.subjects.map(sub => {
    if (sub.dayClasses && sub.dayClasses[dateStr]) {
      const nextClasses = { ...sub.dayClasses };
      delete nextClasses[dateStr];
      return recalculateSubjectTotals({ ...sub, dayClasses: nextClasses });
    }
    return sub;
  });

  return cloned;
}

/**
 * Compares raw baseline parsedData against the customized active parsedData
 * to produce sets of customized cells, added dates, and deleted dates.
 */
export function diffCustomizations(rawParsedData, currentParsedData) {
  const customizedCells = new Set();
  const addedDates = new Set();
  const deletedDates = new Set();

  if (!rawParsedData || !currentParsedData) {
    return {
      customizedCells,
      addedDates,
      deletedDates,
      hasCustomizations: false,
      totalChanges: 0
    };
  }

  const rawDateMap = new Map();
  (rawParsedData.dayColumns || []).forEach(d => rawDateMap.set(d.dateStr, true));

  const curDateMap = new Map();
  (currentParsedData.dayColumns || []).forEach(d => curDateMap.set(d.dateStr, true));

  // Check added dates
  curDateMap.forEach((_, dateStr) => {
    if (!rawDateMap.has(dateStr)) {
      addedDates.add(dateStr);
    }
  });

  // Check deleted dates
  rawDateMap.forEach((_, dateStr) => {
    if (!curDateMap.has(dateStr)) {
      deletedDates.add(dateStr);
    }
  });

  // Check cell diffs
  const rawSubjectMap = new Map();
  (rawParsedData.subjects || []).forEach(s => rawSubjectMap.set(s.name, s));

  (currentParsedData.subjects || []).forEach(curSub => {
    const rawSub = rawSubjectMap.get(curSub.name);
    const allDates = new Set([
      ...Object.keys(curSub.dayClasses || {}),
      ...(rawSub ? Object.keys(rawSub.dayClasses || {}) : [])
    ]);

    allDates.forEach(dateStr => {
      // If date was deleted or added as a whole column, we already track it in date sets
      const curClasses = curSub.dayClasses?.[dateStr] || [];
      const rawClasses = rawSub?.dayClasses?.[dateStr] || [];

      // Check if classes differ
      let differs = curClasses.length !== rawClasses.length;
      if (!differs) {
        for (let i = 0; i < curClasses.length; i++) {
          const c1 = curClasses[i];
          const c2 = rawClasses[i];
          if (c1.type !== c2.type || c1.attended !== c2.attended) {
            differs = true;
            break;
          }
        }
      }

      if (differs) {
        customizedCells.add(`${curSub.name}:::${dateStr}`);
      }
    });
  });

  const totalChanges = customizedCells.size + addedDates.size + deletedDates.size;

  return {
    customizedCells,
    addedDates,
    deletedDates,
    hasCustomizations: totalChanges > 0,
    totalChanges
  };
}
