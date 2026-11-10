import { solveExactBnb, solveKPlusOne } from '../lib/waiverSolver';

self.onmessage = function (e) {
  const {
    id,
    parsedData,
    targetPct,
    maxWaiversK,
    starredSubjects,
    cdcLimit,
    waiverStartMonth,
    waiverEndMonth,
    waiverStartDate,
    waiverEndDate,
    blockedDates,
    fixedWaiverDates,
    fixedCdcDates,
    priorityWaiverDates
  } = e.data || {};
  try {
    const options = {
      waiverStartMonth: waiverStartMonth || 0,
      waiverEndMonth: waiverEndMonth || 0,
      waiverStartDate: waiverStartDate || null,
      waiverEndDate: waiverEndDate || null,
      blockedDates: blockedDates ? new Set(blockedDates) : new Set(),
      fixedWaiverDates: fixedWaiverDates ? (fixedWaiverDates instanceof Set ? fixedWaiverDates : new Set(fixedWaiverDates)) : new Set(),
      fixedCdcDates: fixedCdcDates ? (fixedCdcDates instanceof Set ? fixedCdcDates : new Set(fixedCdcDates)) : new Set(),
      priorityWaiverDates: priorityWaiverDates ? (priorityWaiverDates instanceof Set ? priorityWaiverDates : new Set(priorityWaiverDates)) : new Set()
    };
    const solution = solveExactBnb(parsedData, targetPct, maxWaiversK, starredSubjects, cdcLimit, options);
    let kPlusOneSolution = null;
    if (solution.status === 'SHORTAGE') {
      kPlusOneSolution = solveKPlusOne(parsedData, targetPct, maxWaiversK, starredSubjects, cdcLimit, options);
    }
    self.postMessage({ id, success: true, solution, kPlusOneSolution });
  } catch (err) {
    self.postMessage({ id, success: false, error: err.message });
  }
};
