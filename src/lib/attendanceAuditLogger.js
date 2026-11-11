/**
 * SSCBS OS - Attendance Plan & Audit Logger
 * Compiles a comprehensive, human-readable changelog of every modification, waiver,
 * CDC day, blacklist, priority, and manual edit made in the attendance tool.
 */

import { diffCustomizations } from './attendanceEditor.js';

function formatClassType(type) {
  if (type === 'th') return 'Theory';
  if (type === 'tu') return 'Tutorial';
  if (type === 'pr') return 'Practical';
  return type?.toUpperCase() || 'Class';
}

function formatDateDisplay(dateStr, dayColumns = []) {
  const col = dayColumns.find(d => d.dateStr === dateStr);
  if (col) {
    return `${col.label || dateStr} (${col.weekday || ''})`;
  }
  const parts = (dateStr || '').split('-');
  if (parts.length === 3) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m = months[parseInt(parts[1], 10) - 1] || parts[1];
    return `${parseInt(parts[2], 10)} ${m} ${parts[0]}`;
  }
  return dateStr;
}

/**
 * Calculates the total count of active user modifications
 */
export function countTotalAuditChanges({
  selectedWaivers = new Set(),
  selectedCdcDays = new Set(),
  priorityDates = new Set(),
  blacklistedDates = new Set(),
  creditOverrides = {},
  specialAttendanceAdjustment = { attended: 0, held: 0 },
  customizationDiff = null
} = {}) {
  let count = selectedWaivers.size + selectedCdcDays.size + priorityDates.size + blacklistedDates.size;
  if (Object.keys(creditOverrides || {}).length > 0) {
    count += Object.keys(creditOverrides).length;
  }
  if ((specialAttendanceAdjustment?.attended || 0) !== 0 || (specialAttendanceAdjustment?.held || 0) !== 0) {
    count += 1;
  }
  if (customizationDiff?.totalChanges) {
    count += customizationDiff.totalChanges;
  }
  return count;
}

/**
 * Compiles the complete, detailed text changelog
 */
export function compileAttendanceChangelog({
  rawParsedData = null,
  currentParsedData = null,
  selectedWaivers = new Set(),
  selectedCdcDays = new Set(),
  priorityDates = new Set(),
  blacklistedDates = new Set(),
  creditOverrides = {},
  specialAttendanceAdjustment = { attended: 0, held: 0 },
  totalsSummary = null,
  aggregateMarks = null,
  fileMeta = null
} = {}) {
  const activeParsed = currentParsedData || rawParsedData;
  const dayColumns = activeParsed?.dayColumns || [];
  const subjects = activeParsed?.subjects || [];
  const rollNo = activeParsed?.subjects?.[0]?.rollNo || activeParsed?.studentRoll || '';
  const now = new Date();
  const dateStrFormatted = now.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const timeStrFormatted = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const lines = [];

  // Header Banner
  lines.push('==================================================');
  lines.push('SSCBS ATTENDANCE PLAN & AUDIT LOG');
  lines.push('==================================================');
  lines.push(`Student Roll No: ${rollNo || 'N/A'}`);
  lines.push(`Source Sheet: ${fileMeta?.name || 'Attendance Sheet'}`);
  lines.push(`Generated: ${dateStrFormatted}, ${timeStrFormatted}`);
  lines.push('');

  // Section 0: Impact Summary (if totals exist)
  if (totalsSummary?.overall) {
    const o = totalsSummary.overall;
    const basePct = o.basePct ?? o.pct;
    const finalPct = o.pct;
    const pctDiff = finalPct - basePct;
    const baseAtt = o.baseAtt ?? o.att;
    const baseHeld = o.baseHeld ?? o.held;

    lines.push('--------------------------------------------------');
    lines.push('IMPACT SUMMARY');
    lines.push('--------------------------------------------------');
    lines.push(
      `• Overall Attendance: ${basePct.toFixed(1)}% (${baseAtt}/${baseHeld}) ➔ ${finalPct.toFixed(1)}% (${o.att}/${o.held}) [${pctDiff >= 0 ? `+${pctDiff.toFixed(1)}%` : `${pctDiff.toFixed(1)}%`}]`
    );

    if (aggregateMarks && aggregateMarks.maxMarks > 0) {
      const baseM = aggregateMarks.baseEarned ?? aggregateMarks.earned;
      const finalM = aggregateMarks.earned;
      const mDiff = finalM - baseM;
      const maxM = Number(aggregateMarks.maxMarks).toFixed(1);
      lines.push(
        `• Continuous Assessment Marks: ${baseM.toFixed(1)} / ${maxM} M ➔ ${finalM.toFixed(1)} / ${maxM} M [${mDiff >= 0 ? `+${mDiff.toFixed(1)} M` : `${mDiff.toFixed(1)} M`}]`
      );
    }

    if (totalsSummary.theory) {
      const t = totalsSummary.theory;
      const tBase = t.basePct ?? t.pct;
      lines.push(`• Theory Attendance: ${tBase.toFixed(1)}% ➔ ${t.pct.toFixed(1)}%`);
    }

    if (totalsSummary.tutorial && (totalsSummary.tutorial.held > 0 || (totalsSummary.tutorial.baseHeld ?? 0) > 0)) {
      const tu = totalsSummary.tutorial;
      const tuBase = tu.basePct ?? tu.pct;
      lines.push(`• Tutorial Attendance: ${tuBase.toFixed(1)}% ➔ ${tu.pct.toFixed(1)}%`);
    }

    lines.push('');
  }

  // Section 1: Allocated Society Waivers
  const sortedWaivers = Array.from(selectedWaivers).sort();
  lines.push('--------------------------------------------------');
  lines.push(`1. ALLOCATED SOCIETY WAIVERS (${sortedWaivers.length} Date${sortedWaivers.length === 1 ? '' : 's'})`);
  lines.push('--------------------------------------------------');

  if (sortedWaivers.length === 0) {
    lines.push('• None allocated');
  } else {
    sortedWaivers.forEach((dStr, idx) => {
      const isPriority = priorityDates.has(dStr);
      const dateDisp = formatDateDisplay(dStr, dayColumns);
      const tag = isPriority ? ' [★ Approved Society Priority Date]' : '';

      // Find which classes were missed/waived on this date
      const waivedClassesList = [];
      let totalDayAbsences = 0;
      subjects.forEach(sub => {
        const classes = sub.dayClasses?.[dStr] || [];
        const absentClasses = classes.filter(c => !c.attended);
        if (absentClasses.length > 0) {
          const typesCount = {};
          absentClasses.forEach(c => {
            const t = formatClassType(c.type);
            typesCount[t] = (typesCount[t] || 0) + 1;
          });
          const breakdown = Object.entries(typesCount)
            .map(([tName, cnt]) => `${cnt} ${tName}`)
            .join(', ');
          waivedClassesList.push(`    - ${sub.name}: ${breakdown}`);
          totalDayAbsences += absentClasses.length;
        }
      });

      lines.push(`${idx + 1}. ${dateDisp}${tag}`);
      lines.push(`   Total Absences Waived: ${totalDayAbsences} class${totalDayAbsences === 1 ? '' : 'es'}`);
      if (waivedClassesList.length > 0) {
        waivedClassesList.forEach(wLine => lines.push(wLine));
      }
    });
  }
  lines.push('');

  // Section 2: Claimed CDC Attendance Days
  const sortedCdc = Array.from(selectedCdcDays).sort();
  lines.push('--------------------------------------------------');
  lines.push(`2. CLAIMED CDC ATTENDANCE DAYS (${sortedCdc.length} Date${sortedCdc.length === 1 ? '' : 's'})`);
  lines.push('--------------------------------------------------');

  if (sortedCdc.length === 0) {
    lines.push('• None claimed');
  } else {
    sortedCdc.forEach((dStr, idx) => {
      const dateDisp = formatDateDisplay(dStr, dayColumns);
      const cdcClassesList = [];
      let totalDayConverted = 0;
      subjects.forEach(sub => {
        const classes = sub.dayClasses?.[dStr] || [];
        const absentClasses = classes.filter(c => !c.attended);
        if (absentClasses.length > 0) {
          const typesCount = {};
          absentClasses.forEach(c => {
            const t = formatClassType(c.type);
            typesCount[t] = (typesCount[t] || 0) + 1;
          });
          const breakdown = Object.entries(typesCount)
            .map(([tName, cnt]) => `${cnt} ${tName}`)
            .join(', ');
          cdcClassesList.push(`    - ${sub.name}: ${breakdown}`);
          totalDayConverted += absentClasses.length;
        }
      });

      lines.push(`${idx + 1}. ${dateDisp}`);
      lines.push(`   Converted to Present: ${totalDayConverted} class${totalDayConverted === 1 ? '' : 'es'}`);
      if (cdcClassesList.length > 0) {
        cdcClassesList.forEach(cLine => lines.push(cLine));
      }
    });
  }
  lines.push('');

  // Section 3: Manual Attendance Edits & Speculation
  const diff = diffCustomizations(rawParsedData, currentParsedData);
  lines.push('--------------------------------------------------');
  lines.push(`3. MANUAL ATTENDANCE EDITS & SPECULATION (${diff.totalChanges} Modification${diff.totalChanges === 1 ? '' : 's'})`);
  lines.push('--------------------------------------------------');

  if (!diff.hasCustomizations) {
    lines.push('• No manual cell edits or timetable changes made');
  } else {
    // 3A. Added Dates
    if (diff.addedDates.size > 0) {
      lines.push(`• Added Dates (${diff.addedDates.size}):`);
      Array.from(diff.addedDates).sort().forEach(dStr => {
        const isFuture = diff.futureDates.has(dStr);
        const dateDisp = formatDateDisplay(dStr, dayColumns);
        const tag = isFuture ? ' [🔮 Speculative Future Date]' : '';
        let pCount = 0;
        let aCount = 0;
        subjects.forEach(sub => {
          (sub.dayClasses?.[dStr] || []).forEach(c => {
            if (c.attended) pCount++;
            else aCount++;
          });
        });
        lines.push(`  - ${dateDisp}${tag}: ${pCount + aCount} classes added (${pCount} Present, ${aCount} Absent)`);
      });
    }

    // 3B. Deleted Dates
    if (diff.deletedDates.size > 0) {
      lines.push(`• Deleted Dates (${diff.deletedDates.size}):`);
      Array.from(diff.deletedDates).sort().forEach(dStr => {
        const dateDisp = formatDateDisplay(dStr, rawParsedData?.dayColumns || []);
        lines.push(`  - ${dateDisp}: Removed from timetable`);
      });
    }

    // 3C. Cell Status Changes
    if (diff.customizedCells.size > 0) {
      lines.push(`• Individual Cell Changes (${diff.customizedCells.size}):`);
      const rawSubMap = new Map();
      (rawParsedData?.subjects || []).forEach(s => rawSubMap.set(s.name, s));

      Array.from(diff.customizedCells).sort().forEach(key => {
        const [subjName, dStr] = key.split(':::');
        const dateDisp = formatDateDisplay(dStr, dayColumns);
        const rawSub = rawSubMap.get(subjName);
        const curSub = (currentParsedData?.subjects || []).find(s => s.name === subjName);

        const rawClasses = rawSub?.dayClasses?.[dStr] || [];
        const curClasses = curSub?.dayClasses?.[dStr] || [];

        const formatClasses = list => {
          if (!list || list.length === 0) return 'No classes';
          return list.map(c => `${c.attended ? 'P' : 'A'}(${formatClassType(c.type)})`).join(', ');
        };

        lines.push(`  - ${dateDisp} | ${subjName}:`);
        lines.push(`    Original: ${formatClasses(rawClasses)} ➔ Current: ${formatClasses(curClasses)}`);
      });
    }
  }
  lines.push('');

  // Section 4: Configured Rules & Priorities
  lines.push('--------------------------------------------------');
  lines.push('4. CONFIGURED RULES, PRIORITIES & OVERRIDES');
  lines.push('--------------------------------------------------');

  let hasRules = false;

  // Priority Dates
  if (priorityDates.size > 0) {
    hasRules = true;
    const pList = Array.from(priorityDates).sort().map(d => formatDateDisplay(d, dayColumns));
    lines.push(`• Approved Society Priority Dates (${priorityDates.size}):`);
    pList.forEach(pStr => lines.push(`  - ${pStr}`));
  }

  // Blacklisted Dates
  if (blacklistedDates.size > 0) {
    hasRules = true;
    const bList = Array.from(blacklistedDates).sort().map(d => formatDateDisplay(d, dayColumns));
    lines.push(`• Blacklisted / Blocked Dates (${blacklistedDates.size}) — Protected from waivers:`);
    bList.forEach(bStr => lines.push(`  - ${bStr}`));
  }

  // Credit Overrides
  const overrideEntries = Object.entries(creditOverrides || {});
  if (overrideEntries.length > 0) {
    hasRules = true;
    lines.push(`• Course Credit Weight Overrides (${overrideEntries.length}):`);
    overrideEntries.forEach(([sName, cVal]) => {
      lines.push(`  - ${sName}: Configured Theory Max = ${cVal} M`);
    });
  }

  // Special Attendance Adjustment
  if ((specialAttendanceAdjustment?.attended || 0) !== 0 || (specialAttendanceAdjustment?.held || 0) !== 0) {
    hasRules = true;
    const att = specialAttendanceAdjustment.attended || 0;
    const hld = specialAttendanceAdjustment.held || 0;
    lines.push(
      `• Special Institutional Adjustment: ${att >= 0 ? `+${att}` : att} Attended / ${hld >= 0 ? `+${hld}` : hld} Held classes`
    );
  }

  if (!hasRules) {
    lines.push('• Standard default rules and timetable hours applied (no special overrides)');
  }
  lines.push('');

  // Footer
  lines.push('==================================================');
  lines.push('Compiled via SSCBS OS - Attendance Planner');
  lines.push('==================================================');

  return lines.join('\n');
}
