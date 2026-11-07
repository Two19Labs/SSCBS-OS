/**
 * SSCBS OS - Waiver Tool Solver
 * Exact integer math and branch-and-bound solver implementing Sections 3, 5, and 6.
 */

/**
 * Strict passing rule: strictly over T (Section 3).
 * Exactly T fails. Whole-number maths only:
 * pass(p, n) := 100 * p > T * n
 * A part with 0 classes left is left out of pass/fail (counts as passing).
 */
export function isPartPassing(p, n, T) {
  if (n <= 0) return true;
  return 100 * p > T * n;
}

/**
 * Per-part numbers using whole-number math (Section 6.4)
 */
export function calculatePartBufferAndNeeded(p, n, T) {
  if (n <= 0) {
    return { missableBuffer: 0, classesNeeded: 0, pct: 100, passes: true };
  }

  const passes = 100 * p > T * n;
  const pct = (100 * p) / n;

  // Classes they can still miss and stay passing: ceil((100p - T*n) / T) - 1
  let missableBuffer = 0;
  if (passes) {
    missableBuffer = Math.max(0, Math.ceil((100 * p - T * n) / T) - 1);
  }

  // Classes they must attend in a row to pass: floor((T*n - 100p) / (100 - T)) + 1
  let classesNeeded = 0;
  if (!passes && T < 100) {
    classesNeeded = Math.max(0, Math.floor((T * n - 100 * p) / (100 - T)) + 1);
  }

  return {
    missableBuffer,
    classesNeeded,
    pct,
    passes
  };
}

/**
 * Extract target parts: keys with type th or tu and n > 0 (Section 5)
 */
export function extractTargetParts(parsedData) {
  const targetParts = [];
  const allParts = [];

  (parsedData.subjects || []).forEach(sub => {
    ['th', 'tu', 'pr'].forEach(type => {
      const stats = sub.parts?.[type] || { p: 0, a: 0 };
      const n = stats.p + stats.a;
      const partObj = {
        subject: sub.name,
        type,
        key: `${sub.name}__${type}`,
        label: `${sub.name} ${type === 'th' ? 'theory' : type === 'tu' ? 'tute' : 'practical'}`,
        shortType: type === 'th' ? 'Theory' : type === 'tu' ? 'Tutorial' : 'Practical',
        p: stats.p,
        a: stats.a,
        n
      };
      allParts.push(partObj);
      if ((type === 'th' || type === 'tu') && n > 0) {
        partObj.targetIdx = targetParts.length;
        targetParts.push(partObj);
      }
    });
  });

  return { targetParts, allParts };
}

/**
 * Extract candidate days: only days with at least one Theory or Tute ABSENCE can help (Section 5).
 */
export function extractCandidateDays(parsedData, targetParts) {
  const numParts = targetParts.length;
  const candidateDays = [];

  (parsedData.dayColumns || []).forEach(d => {
    let thOrTuAbsences = 0;
    let totalAbsences = 0;
    let totalPresents = 0;
    let practicalAbsences = 0;
    let practicalPresents = 0;

    const pDeltas = new Int32Array(numParts);
    const nDeltas = new Int32Array(numParts);
    const missedSubjectsSet = new Set();

    (parsedData.subjects || []).forEach(sub => {
      const classes = sub.dayClasses?.[d.dateStr] || [];
      classes.forEach(c => {
        if (!c.attended) {
          missedSubjectsSet.add(sub.name);
        }
        if (c.type === 'th' || c.type === 'tu') {
          const tp = targetParts.find(p => p.subject === sub.name && p.type === c.type);
          if (tp) {
            if (c.attended) {
              pDeltas[tp.targetIdx]++;
              nDeltas[tp.targetIdx]++;
              totalPresents++;
            } else {
              nDeltas[tp.targetIdx]++;
              thOrTuAbsences++;
              totalAbsences++;
            }
          }
        } else if (c.type === 'pr') {
          if (c.attended) practicalPresents++;
          else practicalAbsences++;
        }
      });
    });

    if (thOrTuAbsences > 0) {
      candidateDays.push({
        dateStr: d.dateStr,
        weekday: d.weekday,
        dayNum: d.dayNum,
        month: d.month,
        year: d.year,
        label: d.label,
        fullLabel: d.fullLabel,
        pDeltas,
        nDeltas,
        thOrTuAbsences,
        totalAbsences,
        totalPresents,
        practicalAbsences,
        practicalPresents,
        missedSubjects: Array.from(missedSubjectsSet)
      });
    }
  });

  return candidateDays;
}

/**
 * Ultra-fast exact branch-and-bound solver adhering to Sections 6.1 and 6.2.
 */
export function solveExactBnb(parsedData, targetPct = 85, maxWaiversK = 12) {
  const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const T = targetPct;

  const { targetParts } = extractTargetParts(parsedData);
  const numParts = targetParts.length;

  if (numParts === 0) {
    return {
      status: 'OPTIMAL',
      chosenDays: [],
      passCount: 0,
      totalTargetParts: 0,
      lowestPartPct: 100,
      lowestPart: null,
      durationMs: 0
    };
  }

  const candidateDays = extractCandidateDays(parsedData, targetParts);
  const numCandidates = candidateDays.length;
  const K = Math.min(maxWaiversK, numCandidates);

  // w_cd = T * n_cd - 100 * p_cd
  // rhs_c = T * n_c - 100 * p_c + 1
  const rhs = new Int32Array(numParts);
  for (let c = 0; c < numParts; c++) {
    rhs[c] = T * targetParts[c].n - 100 * targetParts[c].p + 1;
  }

  const wMatrix = Array.from({ length: numParts }, () => new Int32Array(numCandidates));
  for (let c = 0; c < numParts; c++) {
    for (let d = 0; d < numCandidates; d++) {
      wMatrix[c][d] = T * candidateDays[d].nDeltas[c] - 100 * candidateDays[d].pDeltas[c];
    }
  }

  // Sort candidate days by thOrTuAbsences descending to reach good solutions early
  const sortedDayIndices = Array.from({ length: numCandidates }, (_, i) => i)
    .sort((a, b) => candidateDays[b].thOrTuAbsences - candidateDays[a].thOrTuAbsences);

  const orderedCandidates = sortedDayIndices.map(idx => candidateDays[idx]);
  const orderedW = Array.from({ length: numParts }, (_, c) =>
    new Int32Array(numCandidates).map((_, d) => wMatrix[c][sortedDayIndices[d]])
  );

  // Suffix tables for bounding:
  // suffixMaxW[c][i][R] = sum of R largest positive weights among remaining candidates
  const suffixMaxW = Array.from({ length: numParts }, () =>
    Array.from({ length: numCandidates + 1 }, () => new Int32Array(K + 1))
  );
  const suffixMaxN = Array.from({ length: numParts }, () =>
    Array.from({ length: numCandidates + 1 }, () => new Int32Array(K + 1))
  );

  for (let c = 0; c < numParts; c++) {
    for (let i = 0; i < numCandidates; i++) {
      const remainingWeights = [];
      const remainingN = [];
      for (let j = i; j < numCandidates; j++) {
        if (orderedW[c][j] > 0) remainingWeights.push(orderedW[c][j]);
        if (orderedCandidates[j].nDeltas[c] > 0) remainingN.push(orderedCandidates[j].nDeltas[c]);
      }
      remainingWeights.sort((a, b) => b - a);
      remainingN.sort((a, b) => b - a);

      for (let r = 1; r <= K; r++) {
        let sumW = 0;
        for (let k = 0; k < Math.min(r, remainingWeights.length); k++) sumW += remainingWeights[k];
        suffixMaxW[c][i][r] = sumW;

        let sumN = 0;
        for (let k = 0; k < Math.min(r, remainingN.length); k++) sumN += remainingN[k];
        suffixMaxN[c][i][r] = sumN;
      }
    }
  }

  const evaluateState = (chosenIndices) => {
    let passCount = 0;
    let minPct = 100;
    const finalStats = [];

    for (let c = 0; c < numParts; c++) {
      let waivedP = 0;
      let waivedN = 0;
      for (let i = 0; i < chosenIndices.length; i++) {
        const cd = orderedCandidates[chosenIndices[i]];
        waivedP += cd.pDeltas[c];
        waivedN += cd.nDeltas[c];
      }
      const simP = targetParts[c].p - waivedP;
      const simN = targetParts[c].n - waivedN;
      const pass = isPartPassing(simP, simN, T);
      if (pass) passCount++;

      let pct = 100;
      if (simN > 0) {
        pct = (100 * simP) / simN;
        if (pct < minPct) minPct = pct;
      }
      finalStats.push({ label: targetParts[c].label, p: simP, n: simN, pct, pass });
    }

    return {
      passCount,
      total: numParts,
      allPass: passCount === numParts,
      minPct,
      finalStats
    };
  };

  const baseEval = evaluateState([]);
  let best = {
    chosen: [],
    passCount: baseEval.passCount,
    size: 0,
    minPct: baseEval.minPct,
    allPass: baseEval.allPass
  };

  const curW = new Int32Array(numParts);
  const curN = new Int32Array(numParts);
  const currentChosen = [];

  function dfs(orderIdx, targetSize) {
    if (currentChosen.length === targetSize) {
      let passCount = 0;
      let minPct = 100;

      for (let c = 0; c < numParts; c++) {
        if (curN[c] === targetParts[c].n) {
          passCount++;
        } else if (curW[c] >= rhs[c]) {
          passCount++;
          let waivedP = 0;
          for (let k = 0; k < currentChosen.length; k++) {
            waivedP += orderedCandidates[currentChosen[k]].pDeltas[c];
          }
          const simP = targetParts[c].p - waivedP;
          const simN = targetParts[c].n - curN[c];
          const pct = (100 * simP) / simN;
          if (pct < minPct) minPct = pct;
        } else {
          let waivedP = 0;
          for (let k = 0; k < currentChosen.length; k++) {
            waivedP += orderedCandidates[currentChosen[k]].pDeltas[c];
          }
          const simP = targetParts[c].p - waivedP;
          const simN = targetParts[c].n - curN[c];
          const pct = (100 * simP) / simN;
          if (pct < minPct) minPct = pct;
        }
      }

      let isBetter = false;
      if (passCount > best.passCount) {
        isBetter = true;
      } else if (passCount === best.passCount) {
        if (currentChosen.length < best.size) {
          isBetter = true;
        } else if (currentChosen.length === best.size && minPct > best.minPct + 1e-9) {
          isBetter = true;
        }
      }

      if (isBetter) {
        best = {
          chosen: [...currentChosen],
          passCount,
          size: currentChosen.length,
          minPct,
          allPass: passCount === numParts
        };
      }
      return;
    }

    const remainingToPick = targetSize - currentChosen.length;
    const remainingCandidates = numCandidates - orderIdx;
    if (remainingCandidates < remainingToPick) return;

    for (let i = orderIdx; i <= numCandidates - remainingToPick; i++) {
      let maxPotentialPass = 0;
      for (let c = 0; c < numParts; c++) {
        if (curN[c] === targetParts[c].n || curW[c] >= rhs[c]) {
          maxPotentialPass++;
        } else {
          const maxGainW = orderedW[c][i] + suffixMaxW[c][i + 1][remainingToPick - 1];
          const maxGainN = orderedCandidates[i].nDeltas[c] + suffixMaxN[c][i + 1][remainingToPick - 1];
          if (curW[c] + maxGainW >= rhs[c] || curN[c] + maxGainN >= targetParts[c].n) {
            maxPotentialPass++;
          }
        }
      }

      if (maxPotentialPass < best.passCount) continue;

      const cd = orderedCandidates[i];
      for (let c = 0; c < numParts; c++) {
        curW[c] += orderedW[c][i];
        curN[c] += cd.nDeltas[c];
      }
      currentChosen.push(i);

      dfs(i + 1, targetSize);

      currentChosen.pop();
      for (let c = 0; c < numParts; c++) {
        curW[c] -= orderedW[c][i];
        curN[c] -= cd.nDeltas[c];
      }
    }
  }

  for (let s = 1; s <= K; s++) {
    dfs(0, s);
    if (best.allPass) break;
  }

  const endTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const evalPlan = evaluateState(best.chosen);
  const chosenDays = best.chosen.map(idx => orderedCandidates[idx]);

  // Sort chosen days chronologically for display
  chosenDays.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  return {
    status: evalPlan.allPass ? 'OPTIMAL' : 'SHORTAGE',
    chosenDays,
    passCount: evalPlan.passCount,
    totalTargetParts: numParts,
    lowestPartPct: evalPlan.minPct,
    lowestPart: evalPlan.finalStats.reduce((min, cur) => cur.pct < min.pct ? cur : min, evalPlan.finalStats[0])?.label,
    evalPlan,
    durationMs: Math.round(endTime - startTime)
  };
}

/**
 * Section 6.3: Calculate K+1 outcome for shortage states
 */
export function solveKPlusOne(parsedData, targetPct = 85, maxWaiversK = 12) {
  return solveExactBnb(parsedData, targetPct, maxWaiversK + 1);
}

/**
 * Section 7.1: Live simulation calculation across all subjects
 */
export function calculateSimulatedStats(parsedData, selectedWaiversSet, targetPct = 85) {
  const { targetParts } = extractTargetParts(parsedData);
  const T = targetPct;

  let passingTargetCount = 0;
  let lowestPartPct = 100;
  let lowestPartLabel = null;

  const subjectsStats = (parsedData.subjects || []).map(sub => {
    const rawWaived = {
      th: { p: 0, a: 0, n: 0 },
      tu: { p: 0, a: 0, n: 0 },
      pr: { p: 0, a: 0, n: 0 }
    };

    selectedWaiversSet.forEach(dateStr => {
      const dayClasses = sub.dayClasses?.[dateStr] || [];
      dayClasses.forEach(c => {
        if (c.attended) rawWaived[c.type].p++;
        else rawWaived[c.type].a++;
        rawWaived[c.type].n++;
      });
    });

    const parts = {};
    ['th', 'tu', 'pr'].forEach(t => {
      const baseStats = sub.parts?.[t] || { p: 0, a: 0 };
      const baseHeld = baseStats.p + baseStats.a;
      const baseAtt = baseStats.p;
      const basePct = baseHeld > 0 ? (baseAtt / baseHeld) * 100 : 100;

      const simAttended = Math.max(0, baseAtt - rawWaived[t].p);
      const simHeld = Math.max(0, baseHeld - rawWaived[t].n);

      const metrics = calculatePartBufferAndNeeded(simAttended, simHeld, T);
      const isTarget = (t === 'th' || t === 'tu') && baseHeld > 0;

      if (isTarget) {
        if (metrics.passes) passingTargetCount++;
        if (simHeld > 0 && metrics.pct < lowestPartPct) {
          lowestPartPct = metrics.pct;
          lowestPartLabel = `${sub.name} ${t === 'th' ? 'theory' : 'tute'}`;
        }
      }

      parts[t] = {
        baseAtt,
        baseHeld,
        basePct,
        simAttended,
        simHeld,
        simPct: metrics.pct,
        passes: metrics.passes,
        missableBuffer: metrics.missableBuffer,
        classesNeeded: metrics.classesNeeded,
        isTarget
      };
    });

    return {
      sno: sub.sno,
      name: sub.name,
      rollNo: sub.rollNo,
      parts
    };
  });

  const totalTargetParts = targetParts.length;
  const isOptimal = passingTargetCount === totalTargetParts;

  return {
    subjectsStats,
    passingTargetCount,
    totalTargetParts,
    isOptimal,
    status: isOptimal ? 'OPTIMAL' : 'SHORTAGE',
    lowestPartPct,
    lowestPartLabel
  };
}

/**
 * Section 7.1: Pre-toggle Day Impact Diff
 * "Before toggling, each day shows what waiving it would change compared with the current simulated state"
 */
export function calculateDayImpactDiff(dateStr, parsedData, currentSelectedWaiversSet, targetPct = 85) {
  const isCurrentlyWaived = currentSelectedWaiversSet.has(dateStr);
  const nextSet = new Set(currentSelectedWaiversSet);

  if (isCurrentlyWaived) nextSet.delete(dateStr);
  else nextSet.add(dateStr);

  const currentStats = calculateSimulatedStats(parsedData, currentSelectedWaiversSet, targetPct);
  const nextStats = calculateSimulatedStats(parsedData, nextSet, targetPct);

  let thTuAbsencesRemoved = 0;
  let thTuPresentsRemoved = 0;
  let practicalAbsencesRemoved = 0;
  let practicalPresentsRemoved = 0;

  (parsedData.subjects || []).forEach(sub => {
    const classes = sub.dayClasses?.[dateStr] || [];
    classes.forEach(c => {
      if (c.type === 'th' || c.type === 'tu') {
        if (c.attended) thTuPresentsRemoved++;
        else thTuAbsencesRemoved++;
      } else if (c.type === 'pr') {
        if (c.attended) practicalPresentsRemoved++;
        else practicalAbsencesRemoved++;
      }
    });
  });

  // Calculate per-part differences
  const partDiffs = [];
  currentStats.subjectsStats.forEach((sub, sIdx) => {
    const nextSub = nextStats.subjectsStats[sIdx];
    ['th', 'tu', 'pr'].forEach(t => {
      const curPart = sub.parts[t];
      const nxtPart = nextSub.parts[t];
      if (curPart.baseHeld > 0 && (curPart.simHeld !== nxtPart.simHeld || curPart.simAttended !== nxtPart.simAttended)) {
        const delta = nxtPart.simPct - curPart.simPct;
        partDiffs.push({
          subject: sub.name,
          type: t === 'th' ? 'Theory' : t === 'tu' ? 'Tute' : 'Practical',
          label: `${sub.name} ${t === 'th' ? 'Theory' : t === 'tu' ? 'Tute' : 'Practical'}`,
          isTarget: curPart.isTarget,
          beforeAtt: curPart.simAttended,
          beforeHeld: curPart.simHeld,
          beforePct: curPart.simPct,
          afterAtt: nxtPart.simAttended,
          afterHeld: nxtPart.simHeld,
          afterPct: nxtPart.simPct,
          delta,
          dropped: delta < -0.0001
        });
      }
    });
  });

  return {
    dateStr,
    isCurrentlyWaived,
    partDiffs,
    thTuAbsencesRemoved,
    thTuPresentsRemoved,
    practicalAbsencesRemoved,
    practicalPresentsRemoved,
    currentPassing: currentStats.passingTargetCount,
    nextPassing: nextStats.passingTargetCount,
    totalTargetParts: currentStats.totalTargetParts
  };
}
