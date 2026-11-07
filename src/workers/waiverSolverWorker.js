import { solveExactBnb, solveKPlusOne } from '../lib/waiverSolver';

self.onmessage = function (e) {
  const { id, parsedData, targetPct, maxWaiversK } = e.data || {};
  try {
    const solution = solveExactBnb(parsedData, targetPct, maxWaiversK);
    let kPlusOneSolution = null;
    if (solution.status === 'SHORTAGE') {
      kPlusOneSolution = solveKPlusOne(parsedData, targetPct, maxWaiversK);
    }
    self.postMessage({ id, success: true, solution, kPlusOneSolution });
  } catch (err) {
    self.postMessage({ id, success: false, error: err.message });
  }
};
