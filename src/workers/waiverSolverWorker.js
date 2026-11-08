import { solveExactBnb, solveKPlusOne } from '../lib/waiverSolver';

self.onmessage = function (e) {
  const { id, parsedData, targetPct, maxWaiversK, starredSubjects, cdcLimit, waiverStartMonth, blockedDates } = e.data || {};
  try {
    const options = {
      waiverStartMonth: waiverStartMonth || 0,
      blockedDates: blockedDates ? new Set(blockedDates) : new Set()
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
