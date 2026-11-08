import { solveExactBnb, solveKPlusOne } from '../lib/waiverSolver';

self.onmessage = function (e) {
  const { id, parsedData, targetPct, maxWaiversK, starredSubjects, cdcLimit } = e.data || {};
  try {
    const solution = solveExactBnb(parsedData, targetPct, maxWaiversK, starredSubjects, cdcLimit);
    let kPlusOneSolution = null;
    if (solution.status === 'SHORTAGE') {
      kPlusOneSolution = solveKPlusOne(parsedData, targetPct, maxWaiversK, starredSubjects, cdcLimit);
    }
    self.postMessage({ id, success: true, solution, kPlusOneSolution });
  } catch (err) {
    self.postMessage({ id, success: false, error: err.message });
  }
};
