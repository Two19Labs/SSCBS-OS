import React, { useState, useEffect, useRef, useMemo } from 'react';
import FooterCredit from './FooterCredit';
import { useAuth } from '../context/AuthContext';
import { canAccessWaiver } from '../lib/admin';
import { PercentIcon } from './icons';
import { trackWaiverEvent } from '../lib/analytics';
import { parseAttendanceFile, WEEKDAYS, MONTH_NAMES, MONTHS_FULL } from '../lib/waiverParser';
import {
  solveExactBnb,
  solveKPlusOne,
  calculateSimulatedStats,
  calculateDayImpactDiff,
  calculatePartBufferAndNeeded,
  extractTargetParts,
  extractCandidateDays
} from '../lib/waiverSolver';
import './WaiverToolPage.css';

export default function WaiverToolPage({ onBack }) {
  const { user } = useAuth();
  const hasAccess = canAccessWaiver(user?.email);

  if (!hasAccess) {
    return (
      <div className="waiver-locked-screen">
        <div className="waiver-locked-card">
          <span className="waiver-locked-badge">COMING SOON</span>
          <div className="waiver-locked-icon">
            <PercentIcon size={32} />
          </div>
          <h2>Waiver Tool is Coming Soon</h2>
          <p>
            We are fine-tuning the Attendance Waiver Assistant. Access is currently limited to authorized personnel during private beta testing.
          </p>
          <button className="waiver-locked-back-btn" onClick={onBack}>
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const userKey = user?.id || user?.email || 'guest';
  const storageKey = `sscbs_waiver_tool_state_v3_${userKey}`;

  // Configuration inputs
  const [file, setFile] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [maxWaivers, setMaxWaivers] = useState(12); // K: 1 - 30
  const [threshold, setThreshold] = useState(85); // T: 50 - 99
  const [startingMonth, setStartingMonth] = useState(7); // 7 = August (0-indexed)
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Parsed attendance data
  const [parsedData, setParsedData] = useState(null);

  // Active selected waivers (Set of 'YYYY-MM-DD' date strings)
  const [selectedWaivers, setSelectedWaivers] = useState(new Set());

  // Solver outcome
  const [solverResult, setSolverResult] = useState(null);
  const [kPlusOneResult, setKPlusOneResult] = useState(null);

  // View toggle: 'health' (Subject health cards) or 'grid' (Interactive Excel-like spreadsheet grid)
  const [viewMode, setViewMode] = useState('health');

  // Submit Modal state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(null);

  // Hovered day tooltip for live diff preview in grid
  const [hoveredDay, setHoveredDay] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Web Worker ref
  const workerRef = useRef(null);

  // Initialize Web Worker for solver
  useEffect(() => {
    try {
      workerRef.current = new Worker(
        new URL('../workers/waiverSolverWorker.js', import.meta.url),
        { type: 'module' }
      );
    } catch (e) {
      console.warn('Web Worker not supported in environment, fallback to main thread:', e);
      workerRef.current = null;
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Restore persisted state on mount
  useEffect(() => {
    try {
      const savedStr = localStorage.getItem(storageKey);
      if (savedStr) {
        const saved = JSON.parse(savedStr);
        if (saved && saved.parsedData && Array.isArray(saved.parsedData.dayColumns) && Array.isArray(saved.parsedData.subjects)) {
          setParsedData(saved.parsedData);
          if (Array.isArray(saved.selectedWaivers)) {
            setSelectedWaivers(new Set(saved.selectedWaivers));
          }
          if (saved.solverResult) setSolverResult(saved.solverResult);
          if (saved.kPlusOneResult) setKPlusOneResult(saved.kPlusOneResult);
          if (saved.maxWaivers !== undefined) setMaxWaivers(saved.maxWaivers);
          if (saved.threshold !== undefined) setThreshold(saved.threshold);
          if (saved.fileMeta) setFileMeta(saved.fileMeta);
          if (saved.viewMode) setViewMode(saved.viewMode);
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch (err) {
      console.warn('Failed to restore Waiver Tool state:', err);
    }
  }, [storageKey]);

  // Persist state changes automatically
  useEffect(() => {
    if (!parsedData) return;
    try {
      const stateToSave = {
        parsedData,
        selectedWaivers: Array.from(selectedWaivers),
        solverResult,
        kPlusOneResult,
        maxWaivers,
        threshold,
        fileMeta,
        viewMode
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (err) {
      console.warn('Failed to persist Waiver Tool state:', err);
    }
  }, [parsedData, selectedWaivers, solverResult, kPlusOneResult, maxWaivers, threshold, fileMeta, viewMode, storageKey]);

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelection(droppedFile);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (selectedFile) => {
    setFile(selectedFile);
    setError(null);
  };

  // Run Solver (async via worker or synchronous fallback)
  const runSolver = (data, tVal, kVal, onComplete) => {
    if (workerRef.current) {
      const msgId = Date.now();
      const handleMessage = (e) => {
        if (e.data?.id === msgId) {
          workerRef.current.removeEventListener('message', handleMessage);
          if (e.data.success) {
            setSolverResult(e.data.solution);
            setKPlusOneResult(e.data.kPlusOneSolution);
            if (onComplete) onComplete(e.data.solution);
          }
          setIsProcessing(false);
        }
      };
      workerRef.current.addEventListener('message', handleMessage);
      workerRef.current.postMessage({
        id: msgId,
        parsedData: data,
        targetPct: tVal,
        maxWaiversK: kVal
      });
    } else {
      setTimeout(() => {
        try {
          const solution = solveExactBnb(data, tVal, kVal);
          let kPlus = null;
          if (solution.status === 'SHORTAGE') {
            kPlus = solveKPlusOne(data, tVal, kVal);
          }
          setSolverResult(solution);
          setKPlusOneResult(kPlus);
          if (onComplete) onComplete(solution);
        } catch (err) {
          console.error('Solver error:', err);
        }
        setIsProcessing(false);
      }, 30);
    }
  };

  // Process uploaded attendance file
  const processAttendance = () => {
    if (!file) {
      setError('Please select or drop an attendance file first.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    const meta = {
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      uploadedAt: new Date().toISOString()
    };
    setFileMeta(meta);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = parseAttendanceFile(text, file.name);

        trackWaiverEvent('sheet_parsed', {
          file_name: file.name,
          subjects_count: parsed.subjects.length,
          days_count: parsed.dayColumns.length
        });

        setParsedData(parsed);

        // Run solver and automatically pre-select recommended waivers
        runSolver(parsed, threshold, maxWaivers, (solution) => {
          trackWaiverEvent('solver_executed', {
            status: solution.status,
            pass_count: solution.passCount,
            total_target_parts: solution.totalTargetParts,
            days_used: solution.chosenDays.length,
            target: threshold,
            k: maxWaivers
          });

          // Pre-populate with recommended optimal dates
          if (solution.chosenDays && solution.chosenDays.length > 0) {
            setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
          } else {
            setSelectedWaivers(new Set());
          }
        });
      } catch (err) {
        console.error('Attendance parse error:', err);
        setError(err.message || 'Failed to parse attendance file.');
        setIsProcessing(false);
      }
    };

    reader.onerror = () => {
      setError('Could not read the uploaded file.');
      setIsProcessing(false);
    };

    reader.readAsText(file, 'utf-8');
  };

  // Re-run solver when user changes slider or max waivers
  const handleRecalculate = () => {
    if (!parsedData) return;
    setIsProcessing(true);
    runSolver(parsedData, threshold, maxWaivers, (solution) => {
      if (solution.chosenDays && solution.chosenDays.length > 0) {
        setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
      }
    });
  };

  // Reset to initial upload state
  const handleReplaceSheet = () => {
    setParsedData(null);
    setSelectedWaivers(new Set());
    setSolverResult(null);
    setKPlusOneResult(null);
    setFile(null);
    setFileMeta(null);
    setError(null);
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {}
  };

  // Whole-day waiver toggle: clicking ANY cell or header toggles the whole day
  const handleToggleDay = (dateStr) => {
    const updated = new Set(selectedWaivers);
    if (updated.has(dateStr)) {
      updated.delete(dateStr);
    } else {
      updated.add(dateStr);
    }
    setSelectedWaivers(updated);
  };

  // Reset to suggested optimal dates
  const handleApplySuggested = () => {
    if (solverResult?.chosenDays) {
      setSelectedWaivers(new Set(solverResult.chosenDays.map(d => d.dateStr)));
    }
  };

  // Clear all active waivers
  const handleClearAll = () => {
    setSelectedWaivers(new Set());
  };

  // Map of candidate days by dateStr for quick lookup of missed subjects
  const candidateDaysMap = useMemo(() => {
    if (!parsedData) return new Map();
    const { targetParts } = extractTargetParts(parsedData);
    const candidates = extractCandidateDays(parsedData, targetParts);
    const map = new Map();
    candidates.forEach(c => map.set(c.dateStr, c));
    return map;
  }, [parsedData]);

  // Sorted list of selected date info objects for the right sidebar
  const selectedDatesList = useMemo(() => {
    if (!parsedData?.dayColumns) return [];
    const list = [];
    parsedData.dayColumns.forEach(d => {
      if (selectedWaivers.has(d.dateStr)) {
        const cand = candidateDaysMap.get(d.dateStr);
        list.push({
          dateStr: d.dateStr,
          dayNum: String(d.dayNum).padStart(2, '0'),
          monthShort: MONTH_NAMES[d.month - 1]?.toUpperCase() || '',
          weekday: d.weekday,
          totalMissed: cand ? cand.totalAbsences : 0,
          missedSubjects: cand?.missedSubjects || []
        });
      }
    });
    return list;
  }, [parsedData, selectedWaivers, candidateDaysMap]);

  // Real-time simulated statistics for all subjects
  const simulatedStats = useMemo(() => {
    if (!parsedData) return null;
    return calculateSimulatedStats(parsedData, selectedWaivers, threshold);
  }, [parsedData, selectedWaivers, threshold]);

  // Live diff preview for hovered day in grid
  const hoverDiff = useMemo(() => {
    if (!hoveredDay || !parsedData) return null;
    return calculateDayImpactDiff(hoveredDay, parsedData, selectedWaivers, threshold);
  }, [hoveredDay, parsedData, selectedWaivers, threshold]);

  // Group columns by month for the spreadsheet grid header
  const monthGroups = useMemo(() => {
    if (!parsedData?.dayColumns) return [];
    const groups = [];
    parsedData.dayColumns.forEach(d => {
      const key = `${d.month}-${d.year}`;
      const monthName = MONTHS_FULL[d.month - 1];
      let g = groups.find(item => item.key === key);
      if (!g) {
        g = { key, monthName, year: d.year, dates: [] };
        groups.push(g);
      }
      g.dates.push(d);
    });
    return groups;
  }, [parsedData]);

  // Check if current selection matches recommended
  const isRecommendedActive = useMemo(() => {
    if (!solverResult?.chosenDays) return false;
    if (solverResult.chosenDays.length !== selectedWaivers.size) return false;
    return solverResult.chosenDays.every(d => selectedWaivers.has(d.dateStr));
  }, [solverResult, selectedWaivers]);

  // Copy dates formatted list to clipboard
  const handleCopyDates = () => {
    if (selectedDatesList.length === 0) return;
    const lines = selectedDatesList.map(d => {
      const subInfo = d.missedSubjects.length > 0 ? ` (${d.missedSubjects.join(', ')})` : '';
      return `${d.weekday}, ${d.dayNum} ${d.monthShort} - ${d.totalMissed} class(es) missed${subInfo}`;
    });
    const textToCopy = `SSCBS Attendance Waiver Dates (${selectedDatesList.length} dates):\n` + lines.join('\n');

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyFeedback('✓ Copied to clipboard!');
      setTimeout(() => setCopyFeedback(null), 3000);
    }).catch(() => {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(null), 2500);
    });
  };

  // Render Subject Health Cards (matching Image 2)
  const renderSubjectHealthCards = () => {
    const list = simulatedStats?.subjectSummaries || simulatedStats?.subjectsStats || [];
    if (list.length === 0) return null;

    return (
      <div className="subject-health-cards-container">
        {list.map((sub, sIdx) => {
          const partsArray = sub.partsList || Object.values(sub.parts || {});
          const isClear = partsArray.filter(p => p.type !== 'pr').every(p => p.passes);

          return (
            <div key={sIdx} className="subject-health-card">
              <div className="subject-card-top-row">
                <span className="subject-title-name">{sub.name}</span>
                <span className={`status-pill ${isClear ? 'pill-clear' : 'pill-shortage'}`}>
                  {isClear ? 'CLEAR' : 'SHORTAGE'}
                </span>
              </div>

              <div className="subject-parts-rows">
                {partsArray.map((part, pIdx) => {
                  const hasClasses = (part.simN !== undefined ? part.simN : part.n) > 0 || (part.baseHeld > 0);
                  const passes = part.passes;
                  const isPractical = part.type === 'pr';

                  // Before and After percentages
                  const beforePct = part.basePct !== undefined ? part.basePct : part.baselinePct;
                  const afterPct = hasClasses ? (part.simPct !== undefined ? part.simPct : part.pct) : 100;

                  // Advice caption
                  const advice = !isPractical && hasClasses
                    ? calculatePartBufferAndNeeded(part.simAttended !== undefined ? part.simAttended : part.simP, part.simHeld !== undefined ? part.simHeld : part.simN, threshold)
                    : null;

                  return (
                    <div key={pIdx} className="subject-part-row">
                      <div className="part-info-line">
                        <div className="part-name-group">
                          <span className="part-type-label">
                            {part.shortType}
                          </span>
                          {hasClasses && (
                            <span className="part-fraction-count">
                              {part.simP}/{part.simN}
                            </span>
                          )}
                          {isPractical && (
                            <span className="badge-info-only">info only</span>
                          )}
                        </div>

                        <div className="part-pct-transition">
                          {hasClasses ? (
                            <>
                              <span className="pct-before">{beforePct.toFixed(1)}%</span>
                              <span className="pct-arrow">&rarr;</span>
                              <span className={`pct-after ${passes || isPractical ? 'txt-pass' : 'txt-fail'}`}>
                                {afterPct.toFixed(1)}%
                              </span>
                            </>
                          ) : (
                            <span className="pct-none">no classes &mdash;</span>
                          )}
                        </div>
                      </div>

                      {/* Dual Progress Bar Track with Target Tick Line */}
                      {hasClasses && (
                        <div className="dual-progress-bar-wrapper">
                          <div className="dual-progress-track">
                            {/* Before fill (light gray) */}
                            <div
                              className="bar-fill-before"
                              style={{ width: `${Math.min(100, Math.max(0, beforePct))}%` }}
                            />
                            {/* After fill (green if pass, red if fail) */}
                            <div
                              className={`bar-fill-after ${passes || isPractical ? 'fill-green' : 'fill-red'}`}
                              style={{ width: `${Math.min(100, Math.max(0, afterPct))}%` }}
                            />
                            {/* 85% Target Indicator Line */}
                            {!isPractical && (
                              <div
                                className="target-threshold-tick"
                                style={{ left: `${threshold}%` }}
                                title={`Target threshold: ${threshold}%`}
                              />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Advice caption */}
                      {advice && hasClasses && (
                        <div className="part-advice-caption">
                          {advice.passes ? (
                            <span className="advice-safe">
                              Can miss <strong>{advice.missableBuffer}</strong> more and stay above {threshold}%
                            </span>
                          ) : (
                            <span className="advice-need">
                              Must attend <strong>{advice.classesNeeded}</strong> in a row to reach {threshold}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render Detailed Spreadsheet Grid (where user can see greens & reds and click any cell)
  const renderSpreadsheetGrid = () => {
    if (!parsedData || !simulatedStats) return null;

    return (
      <div className="spreadsheet-grid-wrapper">
        <div className="grid-helper-callout">
          <span>💡 <strong>Interactive Grid:</strong> Click any cell or date column to toggle that whole day as waived. Attendance re-calculates in real-time.</span>
        </div>

        <div className="grid-table-scrollable">
          <table className="excel-attendance-table">
            <thead>
              {/* Row 1: Month Groups */}
              <tr className="tr-month-header">
                <th className="sticky-sub-header" rowSpan={2}>Subject</th>
                {monthGroups.map(g => (
                  <th key={g.key} colSpan={g.dates.length} className="th-month-span">
                    {g.monthName} {g.year}
                  </th>
                ))}
                <th className="sticky-stat-header" rowSpan={2}>Total Classes</th>
                <th className="sticky-pct-header" rowSpan={2}>Attendance</th>
              </tr>

              {/* Row 2: Date Columns */}
              <tr className="tr-date-header">
                {parsedData.dayColumns.map(d => {
                  const isChecked = selectedWaivers.has(d.dateStr);
                  const isCandidate = candidateDaysMap.has(d.dateStr);
                  const isWeekend = d.weekday === 'Sat' || d.weekday === 'Sun';

                  return (
                    <th
                      key={d.dateStr}
                      className={`th-date-col ${isChecked ? 'col-waived' : ''} ${isCandidate ? 'col-candidate' : ''} ${isWeekend ? 'col-weekend' : ''}`}
                      onClick={() => handleToggleDay(d.dateStr)}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredDay(d.dateStr);
                        setTooltipPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                      }}
                      onMouseLeave={() => setHoveredDay(null)}
                      title={`Click to toggle ${d.fullLabel}`}
                    >
                      <div className="date-header-inner">
                        <span className="th-weekday">{d.weekday}</span>
                        <span className="th-daynum">{d.dayNum}</span>
                        <span className={`th-waiver-indicator ${isChecked ? 'active' : ''}`} />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {(simulatedStats?.subjectSummaries || simulatedStats?.subjectsStats || []).map((sub, sIdx) => {
                const originalSubject = parsedData.subjects?.[sIdx];

                return (
                  <tr key={sIdx} className="tr-subject-row">
                    <td className="sticky-col-name">
                      <div className="sub-grid-name">{sub.name}</div>
                    </td>

                    {parsedData.dayColumns.map(d => {
                      const dayClasses = originalSubject?.dayClasses?.[d.dateStr] || [];
                      const isChecked = selectedWaivers.has(d.dateStr);

                      return (
                        <td
                          key={d.dateStr}
                          className={`td-attendance-cell ${isChecked ? 'cell-waived' : ''}`}
                          onClick={() => handleToggleDay(d.dateStr)}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredDay(d.dateStr);
                            setTooltipPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
                          }}
                          onMouseLeave={() => setHoveredDay(null)}
                        >
                          {dayClasses.length === 0 ? (
                            <span className="cell-no-class">&mdash;</span>
                          ) : (
                            <div className="cell-badges-stack">
                              {dayClasses.map((cls, cIdx) => (
                                <span
                                  key={cIdx}
                                  className={`attendance-badge ${cls.attended ? 'badge-p' : 'badge-a'} ${cls.type}`}
                                  title={`${cls.type.toUpperCase()}: ${cls.attended ? 'Present' : 'Absent'}`}
                                >
                                  {cls.attended ? 'P' : 'A'}
                                  <sub className="sub-type">{cls.type}</sub>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    <td className="sticky-col-stat">
                      <span className="sim-stat-val">{sub.simAttended}/{sub.simHeld}</span>
                      <span className="base-stat-val">({sub.baselineAttended}/{sub.baselineHeld})</span>
                    </td>

                    <td className={`sticky-col-pct ${sub.simPct >= threshold ? 'pass' : 'fail'}`}>
                      <span className="sim-pct-val">{sub.simPct.toFixed(1)}%</span>
                      <span className="base-pct-val">({sub.baselinePct.toFixed(1)}%)</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="waiver-tool-fullpage">
      {/* Top Navbar Header */}
      <nav className="fullpage-navbar">
        <button className="btn-back-portal" onClick={onBack} title="Back to main OS dashboard">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Campus OS
        </button>

        <div className="navbar-logo-area">
          <img src="/sscbs_logo.png" alt="SSCBS Crest" width="28" height="28" />
          <span className="navbar-logo-text">
            SSCBS <span className="logo-accent">Waiver Tool</span>
          </span>
        </div>

        <div className="navbar-badge-area">
          <span className="navbar-portal-badge">PC Optimized</span>
        </div>
      </nav>

      {/* Inline Loading Overlay */}
      {isProcessing && (
        <div className="loading-screen-inline">
          <div className="loader-container">
            <span className="system-spinner"></span>
            <p>Calculating optimal waiver plan...</p>
          </div>
        </div>
      )}

      {/* Floating Hover Popover in Grid */}
      {hoverDiff && (
        <div
          className="day-diff-floating-popover"
          style={{
            position: 'fixed',
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            zIndex: 9999
          }}
        >
          <div className="popover-inner-card">
            <div className="popover-header">
              <strong>{hoverDiff.day.fullLabel}</strong>
              <span className={`popover-action-tag ${hoverDiff.isCurrentlyWaived ? 'tag-remove' : 'tag-add'}`}>
                {hoverDiff.isCurrentlyWaived ? 'Click to restore day' : 'Click to waive day'}
              </span>
            </div>
            <div className="popover-body">
              {hoverDiff.affectedParts.length === 0 ? (
                <div className="popover-empty-notice">No Theory/Tute classes on this day.</div>
              ) : (
                hoverDiff.affectedParts.map((part, pIdx) => (
                  <div key={pIdx} className="popover-diff-row">
                    <span className="popover-part-name">{part.label}</span>
                    <span className={`popover-diff-val ${part.isHarmful ? 'text-harm' : 'text-help'}`}>
                      {part.curPct.toFixed(1)}% &rarr; {part.newPct.toFixed(1)}% ({part.deltaPct >= 0 ? '+' : ''}{part.deltaPct.toFixed(1)}%)
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* View 1: Upload Card (Matching Image 1) */}
      {!parsedData ? (
        <main className="upload-screen-container">
          <div className="upload-card-wrapper">
            <h1 className="upload-card-title">Upload your attendance sheet</h1>
            <p className="upload-card-subtitle">
              Use the attendance report exported from the college ERP portal. We read every class you attended or missed and work out which dates are worth waiving.
            </p>

            <div
              className={`dropzone-upload-box ${file ? 'has-file' : ''}`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="attendance-file-input"
                accept=".xls,.xlsx"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="attendance-file-input" className="dropzone-clickable-label">
                <div className="upload-icon-circle">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                </div>
                {file ? (
                  <div className="file-picked-info">
                    <span className="file-picked-name">{file.name}</span>
                    <span className="file-picked-size">({(file.size / 1024).toFixed(1)} KB)</span>
                    <span className="file-picked-change">Click to choose another</span>
                  </div>
                ) : (
                  <div className="dropzone-prompt-text">
                    Drop the file here, or <span className="browse-link">browse</span>
                    <div className="format-hint">.xls (HTML export) or .xlsx</div>
                  </div>
                )}
              </label>
            </div>

            {error && (
              <div className="upload-error-banner">
                <span>⚠️ {error}</span>
              </div>
            )}

            {/* 3 Parameter Input Boxes */}
            <div className="upload-params-row">
              <div className="param-input-box">
                <span className="param-label">TARGET</span>
                <div className="param-stepper-wrap">
                  <span className="param-number">{threshold}</span>
                  <span className="param-unit">%</span>
                  <div className="param-stepper-arrows">
                    <button
                      type="button"
                      className="arrow-btn"
                      onClick={() => setThreshold(prev => Math.min(99, prev + 1))}
                    >▲</button>
                    <button
                      type="button"
                      className="arrow-btn"
                      onClick={() => setThreshold(prev => Math.max(50, prev - 1))}
                    >▼</button>
                  </div>
                </div>
              </div>

              <div className="param-input-box">
                <span className="param-label">WAIVER LIMIT</span>
                <div className="param-stepper-wrap">
                  <span className="param-number">{maxWaivers}</span>
                  <span className="param-unit">dates</span>
                  <div className="param-stepper-arrows">
                    <button
                      type="button"
                      className="arrow-btn"
                      onClick={() => setMaxWaivers(prev => Math.min(30, prev + 1))}
                    >▲</button>
                    <button
                      type="button"
                      className="arrow-btn"
                      onClick={() => setMaxWaivers(prev => Math.max(1, prev - 1))}
                    >▼</button>
                  </div>
                </div>
              </div>

              <div className="param-input-box">
                <span className="param-label">SEMESTER STARTS</span>
                <div className="param-select-wrap">
                  <select
                    className="param-select"
                    value={startingMonth}
                    onChange={(e) => setStartingMonth(parseInt(e.target.value, 10))}
                  >
                    {MONTHS_FULL.map((m, idx) => (
                      <option key={m} value={idx}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <p className="upload-params-caption">
              The start month is read from the file when the report includes a date. You can change all three later.
            </p>

            <button
              className="btn-analyse-attendance"
              onClick={processAttendance}
              disabled={!file || isProcessing}
            >
              {isProcessing ? 'Analysing attendance...' : 'Analyse attendance'}
            </button>

            <footer className="upload-card-privacy-footer">
              Your sheet stays in this browser. Nothing is uploaded to a server.
            </footer>
          </div>
        </main>
      ) : (
        /* View 2: Results Screen (Matching Image 2) */
        <main className="results-screen-container">
          <div className="results-columns-layout">
            {/* Left Column: Subject Health / Grid */}
            <section className="left-main-section">
              <div className="section-header-row">
                <div className="header-titles">
                  <h2 className="section-heading">Subject health</h2>
                  <p className="section-subheading">With the waiver dates you have selected</p>
                </div>

                <div className="header-actions-cluster">
                  {/* View Mode Switcher */}
                  <div className="view-mode-toggle-pills">
                    <button
                      className={`pill-toggle-btn ${viewMode === 'health' ? 'active' : ''}`}
                      onClick={() => setViewMode('health')}
                      title="View subject health cards"
                    >
                      📈 Subject Health
                    </button>
                    <button
                      className={`pill-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                      onClick={() => setViewMode('grid')}
                      title="View detailed Excel spreadsheet grid"
                    >
                      📊 Spreadsheet Grid
                    </button>
                  </div>

                  {/* Legend */}
                  <div className="legend-items-wrap">
                    <span className="legend-item"><span className="legend-dash dash-before"></span>Before</span>
                    <span className="legend-item"><span className="legend-dash dash-after"></span>After</span>
                    <span className="legend-item"><span className="legend-tick"></span>{threshold}% target</span>
                  </div>
                </div>
              </div>

              {/* View Content */}
              {viewMode === 'health' ? renderSubjectHealthCards() : renderSpreadsheetGrid()}
            </section>

            {/* Right Column: Your Waiver Dates Sidebar */}
            <aside className="right-sidebar-section">
              <div className="waiver-dates-card">
                <div className="dates-card-top-row">
                  <h3 className="dates-card-title">Your waiver dates</h3>
                  <span className="dates-card-counter">
                    {selectedWaivers.size} / {maxWaivers}
                  </span>
                </div>

                <div className="dates-card-status-bar">
                  <span className="badge-recommended">RECOMMENDED</span>
                  <div className="dates-actions-group">
                    {!isRecommendedActive && solverResult?.chosenDays?.length > 0 && (
                      <button className="btn-text-action" onClick={handleApplySuggested} title="Reset to solver recommendations">
                        Reset
                      </button>
                    )}
                    <button className="btn-text-action" onClick={handleClearAll} title="Clear all waiver dates">
                      Clear
                    </button>
                  </div>
                </div>

                {/* List of Selected Waiver Date Cards */}
                <div className="selected-dates-scrollable-list">
                  {selectedDatesList.length === 0 ? (
                    <div className="empty-dates-notice">
                      <p>No dates waived yet.</p>
                      <button className="btn-restore-suggested" onClick={handleApplySuggested}>
                        Apply Recommended Plan
                      </button>
                    </div>
                  ) : (
                    selectedDatesList.map(item => (
                      <div key={item.dateStr} className="waiver-date-card-item">
                        <div className="date-card-calendar-badge">
                          <span className="badge-day-number">{item.dayNum}</span>
                          <span className="badge-month-label">{item.monthShort}</span>
                        </div>

                        <div className="date-card-details">
                          <div className="date-card-main-line">
                            <strong>{item.weekday}</strong> &middot; {item.totalMissed} missed
                          </div>
                          <div className="date-card-sub-line" title={item.missedSubjects.join(', ')}>
                            {item.missedSubjects.length > 0
                              ? item.missedSubjects.join(', ')
                              : 'No absences recorded'}
                          </div>
                        </div>

                        <button
                          className="btn-remove-date-card"
                          onClick={() => handleToggleDay(item.dateStr)}
                          title={`Remove waiver for ${item.dateStr}`}
                        >
                          &times;
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Status Indicator Banner */}
                <div className="dates-card-footer-status">
                  {simulatedStats?.allPassing ? (
                    <span className="status-all-clear">
                      <span className="dot-green">&bull;</span> Every subject is at {threshold}% or above
                    </span>
                  ) : (
                    <span className="status-shortage-warn">
                      <span className="dot-warn">&#9650;</span> {Math.max(0, (simulatedStats?.totalTargetParts || 0) - (simulatedStats?.passingTargetCount ?? simulatedStats?.passingCount ?? 0))} part(s) below {threshold}%
                    </span>
                  )}
                </div>

                {/* Main Action Button */}
                <button
                  className="btn-continue-submit"
                  onClick={() => setIsSubmitModalOpen(true)}
                  disabled={selectedWaivers.size === 0}
                >
                  Continue to submit
                </button>
              </div>

              {/* Sheet Replacement Box */}
              <div className="active-sheet-info-box">
                <div className="sheet-label-column">
                  <span className="sheet-tag-label">SHEET</span>
                  <span className="sheet-file-name" title={fileMeta?.name || 'attendance-export.xls'}>
                    {fileMeta?.name || 'attendance-export.xls'}
                  </span>
                </div>
                <button className="btn-replace-sheet" onClick={handleReplaceSheet}>
                  Replace
                </button>
              </div>
            </aside>
          </div>
        </main>
      )}

      {/* Submission List Modal (Triggered by "Continue to submit") */}
      {isSubmitModalOpen && (
        <div className="waiver-modal-backdrop" onClick={() => setIsSubmitModalOpen(false)}>
          <div className="waiver-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div>
                <h3 className="modal-title">Recommended Waiver Dates</h3>
                <p className="modal-subtitle">Official list of dates to enter on your college attendance portal</p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsSubmitModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className="modal-summary-banner">
              <span><strong>{selectedDatesList.length}</strong> date(s) selected</span>
              <span className="summary-dot">&middot;</span>
              <span>{simulatedStats?.allPassing ? 'All subjects clear' : `${Math.max(0, (simulatedStats?.totalTargetParts || 0) - (simulatedStats?.passingTargetCount ?? simulatedStats?.passingCount ?? 0))} part(s) below target`}</span>
            </div>

            <div className="modal-dates-list">
              {selectedDatesList.map(item => (
                <div key={item.dateStr} className="modal-date-row">
                  <div className="modal-date-left">
                    <span className="modal-date-badge">{item.dayNum} {item.monthShort}</span>
                    <span className="modal-date-weekday">{item.weekday}</span>
                  </div>
                  <div className="modal-date-right">
                    <span className="modal-date-missed">{item.totalMissed} class(es) missed</span>
                    <span className="modal-date-subs">{item.missedSubjects.join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-actions-footer">
              <button className="btn-copy-submit-dates" onClick={handleCopyDates}>
                📋 Copy Dates List
              </button>
              {copyFeedback && <span className="copy-feedback-toast">{copyFeedback}</span>}
              <button className="btn-modal-done" onClick={() => setIsSubmitModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <FooterCredit />
    </div>
  );
}
