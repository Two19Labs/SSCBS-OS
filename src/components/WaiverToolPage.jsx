import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { canAccessWaiver } from '../lib/admin';
import { PercentIcon } from './icons';
import { trackWaiverEvent } from '../lib/analytics';
import { parseAttendanceFile, MONTH_NAMES, MONTHS_FULL } from '../lib/waiverParser';
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

  // Mobile check: Screen width <= 768px or mobile user-agent
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const isSmall = window.innerWidth <= 768;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent || ''
    );
    return isSmall || isMobileUA;
  });

  useEffect(() => {
    const handleResize = () => {
      const isSmall = window.innerWidth <= 768;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent || ''
      );
      setIsMobileScreen(isSmall || isMobileUA);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobileScreen) {
    return (
      <div className="waiver-mobile-gate-screen">
        <div className="waiver-mobile-card-wrapper">
          <div className="waiver-mobile-card">
            <div className="mobile-icon-badge">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <h2>Please open on a PC or Laptop</h2>
            <p>
              The Attendance Tool requires a larger screen to display subject analytics, multi-column date tables, and the attendance grid accurately.
            </p>
            <div className="mobile-hint-box">
              💡 For the best experience, open <strong>sscbsos.in/#waiver</strong> on your desktop browser.
            </div>
            <button className="btn-back-portal-primary" onClick={onBack}>
              ← Back to Campus OS
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="waiver-locked-screen">
        <div className="waiver-locked-card">
          <span className="waiver-locked-badge">COMING SOON</span>
          <div className="waiver-locked-icon">
            <PercentIcon size={32} />
          </div>
          <h2>Attendance Tool is Coming Soon</h2>
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

  // Prioritized / starred subjects (Set of subject names)
  const [starredSubjects, setStarredSubjects] = useState(new Set());

  // Career Development Centre (CDC) Attendance Duty inputs
  const [cdcLimit, setCdcLimit] = useState(0); // 0 to 15 dates
  const [selectedCdcDays, setSelectedCdcDays] = useState(new Set()); // Set of 'YYYY-MM-DD'
  const [gridToolMode, setGridToolMode] = useState('waiver'); // 'waiver' | 'cdc'

  // Ineligibility acknowledgement state (shown when baseline overall attendance < 66.7%)
  const [hasAcknowledgedIneligible, setHasAcknowledgedIneligible] = useState(false);

  // Solver outcome
  const [solverResult, setSolverResult] = useState(null);
  const [kPlusOneResult, setKPlusOneResult] = useState(null);

  // Grid modal expansion state
  const [isGridExpanded, setIsGridExpanded] = useState(false);

  // Copy feedback
  const [copyFeedback, setCopyFeedback] = useState(null);

  // Hovered date tooltip for live diff preview
  const [hoveredDate, setHoveredDate] = useState(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });

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
          if (Array.isArray(saved.starredSubjects)) {
            setStarredSubjects(new Set(saved.starredSubjects));
          }
          if (saved.solverResult) setSolverResult(saved.solverResult);
          if (saved.kPlusOneResult) setKPlusOneResult(saved.kPlusOneResult);
          if (saved.maxWaivers !== undefined) setMaxWaivers(saved.maxWaivers);
          if (saved.threshold !== undefined) setThreshold(saved.threshold);
          if (saved.fileMeta) setFileMeta(saved.fileMeta);
          if (saved.hasAcknowledgedIneligible !== undefined) {
            setHasAcknowledgedIneligible(saved.hasAcknowledgedIneligible);
          }
          if (saved.cdcLimit !== undefined) setCdcLimit(saved.cdcLimit);
          if (Array.isArray(saved.selectedCdcDays)) {
            setSelectedCdcDays(new Set(saved.selectedCdcDays));
          }
          if (saved.gridToolMode) setGridToolMode(saved.gridToolMode);
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
        starredSubjects: Array.from(starredSubjects),
        solverResult,
        kPlusOneResult,
        maxWaivers,
        threshold,
        fileMeta,
        hasAcknowledgedIneligible,
        cdcLimit,
        selectedCdcDays: Array.from(selectedCdcDays),
        gridToolMode
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (err) {
      console.warn('Failed to persist Waiver Tool state:', err);
    }
  }, [parsedData, selectedWaivers, starredSubjects, solverResult, kPlusOneResult, maxWaivers, threshold, fileMeta, hasAcknowledgedIneligible, cdcLimit, selectedCdcDays, gridToolMode, storageKey]);

  // Prevent scroll when expanded grid modal is open
  useEffect(() => {
    if (!isGridExpanded) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isGridExpanded]);

  // Close expanded grid on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsGridExpanded(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Track solver parameters
  const [lastSolvedParams, setLastSolvedParams] = useState(null);
  useEffect(() => {
    if (solverResult) {
      setLastSolvedParams({ t: threshold, k: maxWaivers });
    }
  }, [solverResult]);

  const hasParamsChanged = lastSolvedParams && (lastSolvedParams.t !== threshold || lastSolvedParams.k !== maxWaivers);

  // File Drag & Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      handleFileSelected(droppedFile);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (selectedFile) => {
    setFile(selectedFile);
    setError(null);
  };

  // Run Solver Async with Worker or Fallback
  const executeSolverAsync = (data, targetT, limitK, starsOrCb, maybeCb) => {
    let stars = starredSubjects;
    let callback = null;
    if (typeof starsOrCb === 'function') {
      callback = starsOrCb;
    } else if (starsOrCb !== undefined) {
      stars = starsOrCb;
      callback = maybeCb;
    }
    const starredList = Array.from(stars || []);

    if (workerRef.current) {
      const solveId = Date.now();
      const onMessage = (ev) => {
        if (ev.data?.id === solveId) {
          workerRef.current.removeEventListener('message', onMessage);
          if (ev.data.success) {
            setSolverResult(ev.data.solution);
            setKPlusOneResult(ev.data.kPlusOneSolution);
            if (callback) callback(ev.data.solution);
          }
          setIsProcessing(false);
        }
      };
      workerRef.current.addEventListener('message', onMessage);
      workerRef.current.postMessage({
        id: solveId,
        parsedData: data,
        targetPct: targetT,
        maxWaiversK: limitK,
        starredSubjects: starredList
      });
    } else {
      setTimeout(() => {
        try {
          const solution = solveExactBnb(data, targetT, limitK, starredList);
          let kPlusOne = null;
          if (solution.status === 'SHORTAGE') {
            kPlusOne = solveKPlusOne(data, targetT, limitK, starredList);
          }
          setSolverResult(solution);
          setKPlusOneResult(kPlusOne);
          if (callback) callback(solution);
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
    setHasAcknowledgedIneligible(false);

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
        const parsed = parseAttendanceFile(text, file.name, {
          userStartingMonth: startingMonth
        });

        trackWaiverEvent('waiver_file_parsed', {
          fileName: file.name,
          subjectsCount: parsed.subjects.length,
          dayColumnsCount: parsed.dayColumns.length
        });

        setParsedData(parsed);

        executeSolverAsync(parsed, threshold, maxWaivers, (solution) => {
          trackWaiverEvent('waiver_solved', {
            status: solution.status,
            passCount: solution.passCount,
            totalTargetParts: solution.totalTargetParts,
            chosenDaysCount: solution.chosenDays.length
          });

          // Do NOT apply waivers automatically upon file submission/open.
          // Show pure baseline attendance first per user requirement.
          setSelectedWaivers(new Set());
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

  const handleUpdateRecommendation = () => {
    if (!parsedData) return;
    setIsProcessing(true);
    executeSolverAsync(parsedData, threshold, maxWaivers, (solution) => {
      if (solution?.chosenDays && solution.chosenDays.length > 0) {
        setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
      }
    });
  };

  const handleReplaceSheet = () => {
    setParsedData(null);
    setSelectedWaivers(new Set());
    setSelectedCdcDays(new Set());
    setCdcLimit(0);
    setGridToolMode('waiver');
    setStarredSubjects(new Set());
    setHasAcknowledgedIneligible(false);
    setSolverResult(null);
    setKPlusOneResult(null);
    setFile(null);
    setFileMeta(null);
    setError(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  // Toggle priority star on subject with instant live re-solve
  const handleToggleStar = (subjectName) => {
    const next = new Set(starredSubjects);
    if (next.has(subjectName)) {
      next.delete(subjectName);
    } else {
      next.add(subjectName);
    }
    setStarredSubjects(next);
    if (parsedData) {
      setIsProcessing(true);
      executeSolverAsync(parsedData, threshold, maxWaivers, next, (solution) => {
        setSelectedWaivers(prev => {
          if (prev.size === 0) return prev;
          if (solution?.chosenDays && solution.chosenDays.length > 0) {
            return new Set(solution.chosenDays.map(d => d.dateStr));
          }
          return new Set();
        });
      });
    }
  };

  const handleToggleDay = (dateStr) => {
    if (gridToolMode === 'cdc' && cdcLimit > 0) {
      const nextCdc = new Set(selectedCdcDays);
      if (nextCdc.has(dateStr)) {
        nextCdc.delete(dateStr);
      } else {
        if (nextCdc.size >= cdcLimit) {
          return;
        }
        nextCdc.add(dateStr);
        if (selectedWaivers.has(dateStr)) {
          const nextW = new Set(selectedWaivers);
          nextW.delete(dateStr);
          setSelectedWaivers(nextW);
        }
      }
      setSelectedCdcDays(nextCdc);
    } else {
      const nextW = new Set(selectedWaivers);
      if (nextW.has(dateStr)) {
        nextW.delete(dateStr);
      } else {
        nextW.add(dateStr);
        if (selectedCdcDays.has(dateStr)) {
          const nextC = new Set(selectedCdcDays);
          nextC.delete(dateStr);
          setSelectedCdcDays(nextC);
        }
      }
      setSelectedWaivers(nextW);
    }
  };

  const handleClearCdc = () => {
    setSelectedCdcDays(new Set());
  };

  // Live parameter changes with automatic solver re-execution
  const handleMaxWaiversChange = (newLimit) => {
    const clamped = Math.max(1, Math.min(30, newLimit));
    setMaxWaivers(clamped);
    if (parsedData) {
      setIsProcessing(true);
      executeSolverAsync(parsedData, threshold, clamped, (solution) => {
        setSelectedWaivers(prev => {
          if (prev.size === 0) return prev;
          if (solution?.chosenDays && solution.chosenDays.length > 0) {
            return new Set(solution.chosenDays.map(d => d.dateStr));
          }
          return new Set();
        });
      });
    }
  };

  const handleThresholdChange = (newThreshold) => {
    const clamped = Math.max(50, Math.min(99, newThreshold));
    setThreshold(clamped);
    if (parsedData) {
      setIsProcessing(true);
      executeSolverAsync(parsedData, clamped, maxWaivers, (solution) => {
        setSelectedWaivers(prev => {
          if (prev.size === 0) return prev;
          if (solution?.chosenDays && solution.chosenDays.length > 0) {
            return new Set(solution.chosenDays.map(d => d.dateStr));
          }
          return new Set();
        });
      });
    }
  };

  // Apply or reset recommended waiver dates
  const handleApplyRecommended = () => {
    if (solverResult?.chosenDays && solverResult.chosenDays.length > 0) {
      setSelectedWaivers(new Set(solverResult.chosenDays.map(d => d.dateStr)));
    } else if (parsedData) {
      setIsProcessing(true);
      executeSolverAsync(parsedData, threshold, maxWaivers, (solution) => {
        if (solution?.chosenDays && solution.chosenDays.length > 0) {
          setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
        } else {
          setSelectedWaivers(new Set());
        }
      });
    }
  };

  const handleResetRecommended = () => {
    handleApplyRecommended();
  };

  const handleClearAll = () => {
    setSelectedWaivers(new Set());
  };

  // Candidate days mapping for fast missed-subject lookups
  const candidateDaysMap = useMemo(() => {
    if (!parsedData) return new Map();
    const { targetParts } = extractTargetParts(parsedData);
    const candidates = extractCandidateDays(parsedData, targetParts);
    const map = new Map();
    candidates.forEach(c => map.set(c.dateStr, c));
    return map;
  }, [parsedData]);

  // Chronologically ordered selected waiver cards for the right sidebar
  const selectedDaysList = useMemo(() => {
    if (!parsedData?.dayColumns) return [];
    const list = [];
    parsedData.dayColumns.forEach(col => {
      if (selectedWaivers.has(col.dateStr)) {
        const cand = candidateDaysMap.get(col.dateStr);
        list.push({
          dateStr: col.dateStr,
          dayNum: String(col.dayNum).padStart(2, '0'),
          monthShort: MONTH_NAMES[col.month - 1]?.toUpperCase() || '',
          weekday: col.weekday,
          totalMissed: cand ? cand.totalAbsences : 0,
          missedSubjects: cand?.missedSubjects || []
        });
      }
    });
    return list;
  }, [parsedData, selectedWaivers, candidateDaysMap]);

  // Live simulated stats (incorporating Waivers & Career Development Centre CDC Duty)
  const simStats = useMemo(() => {
    if (!parsedData) return null;
    return calculateSimulatedStats(parsedData, selectedWaivers, threshold, selectedCdcDays);
  }, [parsedData, selectedWaivers, threshold, selectedCdcDays]);

  // Hover impact difference
  const hoverDiff = useMemo(() => {
    if (!hoveredDate || !parsedData) return null;
    return calculateDayImpactDiff(hoveredDate, parsedData, selectedWaivers, threshold, selectedCdcDays, gridToolMode);
  }, [hoveredDate, parsedData, selectedWaivers, threshold, selectedCdcDays, gridToolMode]);

  const isOptimalSuggested = useMemo(() => {
    if (!solverResult?.chosenDays || solverResult.chosenDays.length !== selectedWaivers.size) {
      return false;
    }
    return solverResult.chosenDays.every(d => selectedWaivers.has(d.dateStr));
  }, [solverResult, selectedWaivers]);

  // Copy list to clipboard with robust fallback
  const handleCopyDates = () => {
    if (selectedDaysList.length === 0) return;
    const lines = selectedDaysList.map(item => {
      const subs = item.missedSubjects.length > 0 ? ` (${item.missedSubjects.join(', ')})` : '';
      return `${item.weekday}, ${item.dayNum} ${item.monthShort} - ${item.totalMissed} class(es) missed${subs}`;
    });
    const text = `SSCBS Attendance Waiver Dates (${selectedDaysList.length} dates):\n` + lines.join('\n');

    const onSuccess = () => {
      setCopyFeedback('✓ Copied to clipboard!');
      setTimeout(() => setCopyFeedback(null), 3000);
    };

    const onFail = () => {
      setCopyFeedback('Failed to copy');
      setTimeout(() => setCopyFeedback(null), 2500);
    };

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
        try {
          const textArea = document.createElement('textarea');
          textArea.value = text;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (successful) onSuccess();
          else onFail();
        } catch {
          onFail();
        }
      });
    } else {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) onSuccess();
        else onFail();
      } catch {
        onFail();
      }
    }
  };

  // 3-Tier Status:
  // Red ('fail'): < 66.7% (Debarment Risk)
  // Yellow ('warn'): 66.7% to < target (Below Target)
  // Green ('safe'): >= target (Target Cleared)
  const getPartStatus = (part) => {
    const held = part.simN === undefined ? part.n : part.simN;
    if (!held) return 'none';
    if (part.type === 'pr') return 'info';
    const att = part.simAttended ?? part.simP ?? 0;
    const currentPct = Number.isFinite(part.simPct) ? part.simPct : (held > 0 ? (att / held) * 100 : 100);
    if (currentPct < 66.666) return 'fail';
    const passes = (100 * att) > (threshold * held);
    return passes ? 'safe' : 'warn';
  };

  const subjectSummaries = simStats?.subjectSummaries || simStats?.subjectsStats || [];
  const totalTargetParts = simStats?.totalTargetParts || 0;
  const passingTargetCount = simStats?.passingTargetCount ?? simStats?.passingCount ?? 0;

  // Aggregate totals across all subjects
  const totalsSummary = useMemo(() => {
    if (simStats?.totals) return simStats.totals;
    if (!subjectSummaries || subjectSummaries.length === 0) return null;
    let totAtt = 0, totHeld = 0, totBaseAtt = 0, totBaseHeld = 0;
    let thAtt = 0, thHeld = 0, thBaseAtt = 0, thBaseHeld = 0;
    let tuAtt = 0, tuHeld = 0, tuBaseAtt = 0, tuBaseHeld = 0;

    subjectSummaries.forEach(sub => {
      const parts = sub.partsList || Object.values(sub.parts || {});
      parts.forEach(p => {
        const att = p.simAttended ?? p.simP ?? p.p ?? 0;
        const held = p.simHeld ?? p.simN ?? p.n ?? 0;
        const bAtt = p.baseAtt ?? att;
        const bHeld = p.baseHeld ?? held;

        totAtt += att;
        totHeld += held;
        totBaseAtt += bAtt;
        totBaseHeld += bHeld;

        if (p.type === 'th') {
          thAtt += att;
          thHeld += held;
          thBaseAtt += bAtt;
          thBaseHeld += bHeld;
        } else if (p.type === 'tu') {
          tuAtt += att;
          tuHeld += held;
          tuBaseAtt += bAtt;
          tuBaseHeld += bHeld;
        }
      });
    });

    const calcPct = (a, h) => (h > 0 ? (a / h) * 100 : 100);

    return {
      overall: {
        att: totAtt,
        held: totHeld,
        pct: calcPct(totAtt, totHeld),
        basePct: calcPct(totBaseAtt, totBaseHeld)
      },
      theory: {
        att: thAtt,
        held: thHeld,
        pct: calcPct(thAtt, thHeld),
        basePct: calcPct(thBaseAtt, thBaseHeld)
      },
      tutorial: {
        att: tuAtt,
        held: tuHeld,
        pct: calcPct(tuAtt, tuHeld),
        basePct: calcPct(tuBaseAtt, tuBaseHeld)
      }
    };
  }, [simStats, subjectSummaries]);

  // Overall university eligibility check:
  // If a student's total attendance across all subjects combined is below 66.7%,
  // they cannot officially apply for waivers in college (per DU Ordinance VII).
  const baselineOverallPct = totalsSummary?.overall?.basePct ?? 100;
  const isOverallIneligible = Boolean(parsedData && (totalsSummary?.overall?.held ?? 0) > 0 && baselineOverallPct < 66.666);

  const partOrder = { th: 0, tu: 1, pr: 2 };

  const renderPart = (part) => {
    const status = getPartStatus(part);
    const held = part.simN === undefined ? part.n : part.simN;
    if (status === 'none') {
      return (
        <div key={part.type} className="rd-part">
          <div className="rd-part-top">
            <span className="rd-part-name muted">{part.shortType || (part.type === 'th' ? 'Theory' : part.type === 'tu' ? 'Tutorial' : 'Practical')}</span>
            <span className="rd-noclass">No classes</span>
          </div>
          <div className="rd-bar rd-bar-empty" />
        </div>
      );
    }

    const currentPct = Number.isFinite(part.simPct) ? part.simPct : (Number.isFinite(part.pct) ? part.pct : 100);
    const basePct = Number.isFinite(part.basePct) ? part.basePct : currentPct;
    const hasChanged = Math.abs(currentPct - basePct) > 0.05;
    const buff = status === 'info' ? null : calculatePartBufferAndNeeded(part.simAttended ?? part.simP, part.simHeld ?? part.simN, threshold);

    return (
      <div key={part.type} className="rd-part">
        <div className="rd-part-top">
          <div className="rd-part-left">
            <span className="rd-part-name">{part.shortType || (part.type === 'th' ? 'Theory' : part.type === 'tu' ? 'Tutorial' : 'Practical')}</span>
            <span className="rd-part-frac">{part.simP ?? part.simAttended}/{held} classes</span>
            {status === 'info' && <span className="rd-info-tag">Info only</span>}
          </div>
          <div className="rd-part-right">
            <span className="rd-was">{hasChanged ? `was ${basePct.toFixed(1)}%` : 'unchanged'}</span>
            <span className={`rd-pct s-${status}`}>{currentPct.toFixed(1)}%</span>
          </div>
        </div>
        <div className="rd-bar">
          <div className={`rd-fill f-${status}`} style={{ width: `${Math.min(100, Math.max(0, currentPct))}%` }} />
          {hasChanged && basePct < currentPct && (
            <div className="rd-ghost" style={{ left: `${Math.max(0, basePct)}%` }} title={`Before waivers: ${basePct.toFixed(1)}%`} />
          )}
          {status !== 'info' && (
            <div className="rd-tick" style={{ left: `${threshold}%` }} title={`${threshold}% target`} />
          )}
        </div>
        <div className="rd-caption">
          {status === 'info' ? (
            `Not counted toward the ${threshold}% target`
          ) : status === 'fail' ? (
            <>⚠️ <strong style={{ color: 'var(--red, #b91c1c)' }}>Risk:</strong> Below 66.7% minimum. Attend <strong>{buff.classesNeededForDebarSafe || 1}</strong> class(es) to avoid risk.</>
          ) : buff.passes ? (
            <>Can miss <strong>{buff.missableBuffer}</strong> more and stay above {threshold}%</>
          ) : (
            <>Safe from debarment. Attend <strong>{buff.classesNeeded}</strong> in a row to reach {threshold}%</>
          )}
        </div>
      </div>
    );
  };

  const renderTotalsSummary = () => {
    if (!totalsSummary) return null;

    const items = [
      {
        key: 'overall',
        label: 'Total Attendance',
        data: totalsSummary.overall,
        hasClasses: totalsSummary.overall.held > 0
      },
      {
        key: 'theory',
        label: 'Theory Attendance',
        data: totalsSummary.theory,
        hasClasses: totalsSummary.theory.held > 0
      },
      {
        key: 'tutorial',
        label: 'Tutorial Attendance',
        data: totalsSummary.tutorial,
        hasClasses: totalsSummary.tutorial.held > 0
      }
    ];

    return (
      <div className="rd-totals-card" aria-label="Overall attendance summary">
        {items.map((item) => {
          if (!item.hasClasses) {
            return (
              <div key={item.key} className="rd-total-item">
                <div className="rd-total-item-top">
                  <span className="rd-total-item-lbl">{item.label}</span>
                  <span className="rd-no-target-badge">None</span>
                </div>
                <div className="rd-total-item-val">
                  <span className="rd-noclass">No classes held</span>
                </div>
                <div className="rd-bar rd-bar-empty" />
              </div>
            );
          }

          const curPct = item.data.pct;
          const basePct = item.data.basePct;
          const hasChanged = Math.abs(curPct - basePct) > 0.05;
          let status = 'safe';
          let pill = ['Clear', 'safe'];

          if (curPct < 66.666) {
            status = 'fail';
            pill = ['Risk', 'fail'];
          } else if (curPct < threshold) {
            status = 'warn';
            pill = ['Below Target', 'warn'];
          }

          return (
            <div key={item.key} className="rd-total-item">
              <div className="rd-total-item-top">
                <div className="rd-total-item-lbl-wrap">
                  <span className="rd-total-item-lbl">{item.label}</span>
                  {item.key === 'overall' && isOverallIneligible && (
                    <span className="rd-ineligible-tag" title="Overall attendance is below 66.7%. Official waiver submission is barred by administration.">
                      Ineligible for Submission
                    </span>
                  )}
                </div>
                <span className={`rd-pill p-${pill[1]}`}>{pill[0]}</span>
              </div>
              <div className="rd-total-item-val">
                <div className="rd-total-frac-wrap">
                  <span className={`rd-total-pct s-${status}`}>{curPct.toFixed(1)}%</span>
                  <span className="rd-total-frac">{item.data.att}/{item.data.held}</span>
                </div>
                <span className="rd-was">{hasChanged ? `was ${basePct.toFixed(1)}%` : 'unchanged'}</span>
              </div>
              <div className="rd-bar">
                <div className={`rd-fill f-${status}`} style={{ width: `${Math.min(100, Math.max(0, curPct))}%` }} />
                {hasChanged && basePct < curPct && (
                  <div className="rd-ghost" style={{ left: `${Math.max(0, basePct)}%` }} title={`Before waivers: ${basePct.toFixed(1)}%`} />
                )}
                <div className="rd-tick" style={{ left: `${threshold}%` }} title={`${threshold}% target`} />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSubjectCards = () => (
    <div className="rd-cards">
      {subjectSummaries.map((sub, sIdx) => {
        const parts = [...(sub.partsList || Object.values(sub.parts || {}))].sort(
          (a, b) => partOrder[a.type] - partOrder[b.type]
        );
        const statuses = parts.map(getPartStatus);
        const hasTargetParts = parts.some(p => (p.type === 'th' || p.type === 'tu') && ((p.simN ?? p.n ?? 0) > 0 || (p.baseHeld ?? 0) > 0));
        let pill = ['Clear', 'safe'];
        if (!hasTargetParts) {
          pill = ['Info Only', 'info'];
        } else if (statuses.includes('fail')) {
          pill = ['Risk', 'fail'];
        } else if (statuses.includes('warn')) {
          pill = ['Below Target', 'warn'];
        }

        const isStarred = starredSubjects.has(sub.name);

        return (
          <article key={sIdx} className={`rd-card ${isStarred ? 'rd-card-starred' : ''}`}>
            <div className="rd-card-head">
              <div className="rd-card-title-group">
                {hasTargetParts ? (
                  <button
                    type="button"
                    className={`rd-star-btn ${isStarred ? 'starred' : ''}`}
                    onClick={() => handleToggleStar(sub.name)}
                    title={isStarred ? 'Priority subject (click to remove priority)' : `Star as priority subject for ${threshold}% target`}
                    aria-label={isStarred ? `Remove star from ${sub.name}` : `Star ${sub.name} as priority`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={isStarred ? '#f59e0b' : 'none'} stroke={isStarred ? '#b45309' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    {isStarred && <span className="rd-star-tag">Priority</span>}
                  </button>
                ) : (
                  <span className="rd-no-target-badge" title="Practicals are not counted toward attendance targets">
                    Practical
                  </span>
                )}
                <h3 title={sub.name}>{sub.name}</h3>
              </div>
              <span className={`rd-pill p-${pill[1]}`}>{pill[0]}</span>
            </div>
            {parts.map((p, pIdx) => (
              <React.Fragment key={p.type}>
                {pIdx > 0 && <div className="rd-divider" />}
                {renderPart(p)}
              </React.Fragment>
            ))}
          </article>
        );
      })}
    </div>
  );

  const getHoverEvents = (dateStr) => ({
    onMouseEnter: (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setHoveredDate(dateStr);
      setPopoverPos({
        x: Math.min(window.innerWidth - 182, Math.max(182, rect.left + rect.width / 2)),
        y: rect.bottom + 6
      });
    },
    onMouseLeave: () => setHoveredDate(null)
  });

  // Render Grid Table with Frozen Theory and Tutorial Columns (Option A)
  const renderGridTable = (columns, isExpanded) => {
    const monthGroups = [];
    columns.forEach(col => {
      const key = `${col.month}-${col.year}`;
      const last = monthGroups[monthGroups.length - 1];
      if (last && last.key === key) {
        last.count++;
      } else {
        monthGroups.push({
          key,
          label: `${MONTHS_FULL[col.month - 1]} ${col.year}`,
          count: 1
        });
      }
    });

    return (
      <table className="rd-grid">
        <thead>
          <tr>
            <th className="rd-sticky rd-subj-h" rowSpan={2}>Subject</th>
            {monthGroups.map(mg => (
              <th key={mg.key} colSpan={mg.count} className="rd-month">
                {mg.label}
              </th>
            ))}
            {isExpanded && (
              <th className="rd-frozen-h rd-frozen-th-h" rowSpan={2}>Theory</th>
            )}
            {isExpanded && (
              <th className="rd-frozen-h rd-frozen-tu-h" rowSpan={2}>Tutorial</th>
            )}
          </tr>
          <tr>
            {columns.map(col => {
              const isWaived = selectedWaivers.has(col.dateStr);
              const isCdc = selectedCdcDays.has(col.dateStr);
              const btnClass = isWaived ? 'on' : (isCdc ? 'cdc-on' : '');
              return (
                <th key={col.dateStr} className="rd-date-th">
                  <button
                    type="button"
                    className={`rd-date-btn ${btnClass}`}
                    aria-pressed={isWaived || isCdc}
                    aria-label={`Toggle ${col.fullLabel} (${isWaived ? 'waived' : isCdc ? 'CDC duty' : 'active'})`}
                    onClick={() => handleToggleDay(col.dateStr)}
                    {...getHoverEvents(col.dateStr)}
                  >
                    <span className="wd">{col.weekday}</span>
                    <span className="dn">{col.dayNum}</span>
                    {isCdc && <span className="rd-date-cdc-badge" title="Career Development Centre (CDC) Attendance Duty">CDC</span>}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {subjectSummaries.map((sub, sIdx) => {
            const rawSub = parsedData.subjects?.[sIdx];
            const thPart = sub.parts?.th || (sub.partsList || []).find(p => p.type === 'th');
            const tuPart = sub.parts?.tu || (sub.partsList || []).find(p => p.type === 'tu');

            const thHeld = thPart ? (thPart.simN ?? thPart.n ?? 0) : 0;
            const thAtt = thPart ? (thPart.simP ?? thPart.simAttended ?? 0) : 0;
            const thPct = thHeld > 0 ? (thAtt / thHeld) * 100 : 100;
            const thPasses = thHeld > 0 ? (100 * thAtt > threshold * thHeld) : true;

            const tuHeld = tuPart ? (tuPart.simN ?? tuPart.n ?? 0) : 0;
            const tuAtt = tuPart ? (tuPart.simP ?? tuPart.simAttended ?? 0) : 0;
            const tuPct = tuHeld > 0 ? (tuAtt / tuHeld) * 100 : 100;
            const tuPasses = tuHeld > 0 ? (100 * tuAtt > threshold * tuHeld) : true;
            const hasTutorial = tuPart && (tuPart.baseHeld > 0 || (tuPart.p + tuPart.a) > 0);

            return (
              <tr key={sIdx}>
                <th scope="row" className="rd-sticky rd-subj">
                  {sub.name}
                </th>
                {columns.map(col => {
                  const isWaived = selectedWaivers.has(col.dateStr);
                  const isCdc = selectedCdcDays.has(col.dateStr);
                  const dayClasses = rawSub?.dayClasses?.[col.dateStr] || [];
                  const cellClass = isWaived ? 'on' : (isCdc ? 'cdc-cell' : '');
                  return (
                    <td
                      key={col.dateStr}
                      className={`rd-cell ${cellClass}`}
                      onClick={() => handleToggleDay(col.dateStr)}
                      {...getHoverEvents(col.dateStr)}
                    >
                      {dayClasses.length === 0 ? (
                        <span className="rd-dot">·</span>
                      ) : (
                        <div className="rd-chips">
                          {dayClasses.map((c, cIdx) => {
                            const isConvertedByCdc = isCdc && !c.attended;
                            const typeShort = c.type === 'th' ? 'Th' : (c.type === 'tu' ? 'Tu' : 'Pr');

                            if (isConvertedByCdc) {
                              return (
                                <span
                                  key={cIdx}
                                  className="rd-chip cdc"
                                  title="Absence converted to Present via Career Development Centre (CDC) Duty"
                                >
                                  <span className="rd-cdc-micro">CDC</span>
                                  P<small>{typeShort}</small>
                                </span>
                              );
                            }

                            return (
                              <span
                                key={cIdx}
                                className={`rd-chip ${isWaived ? 'w' : (c.attended ? 'p' : 'a')}`}
                              >
                                {c.attended ? 'P' : 'A'}
                                <small>{typeShort}</small>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  );
                })}
                {isExpanded && (
                  <td className="rd-frozen-col rd-frozen-th">
                    {thHeld === 0 ? (
                      <span className="rd-frozen-dash">—</span>
                    ) : (
                      <div className="rd-frozen-cell">
                        <span className="rd-frozen-frac">{thAtt}/{thHeld}</span>
                        <span className={`rd-frozen-pct ${thHeld === 0 ? 'none' : (thPct < 66.666 ? 'bad' : (thPasses ? 'ok' : 'warn'))}`}>
                          {thPct.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </td>
                )}
                {isExpanded && (
                  <td className="rd-frozen-col rd-frozen-tu">
                    {!hasTutorial || tuHeld === 0 ? (
                      <span className="rd-frozen-dash">—</span>
                    ) : (
                      <div className="rd-frozen-cell">
                        <span className="rd-frozen-frac">{tuAtt}/{tuHeld}</span>
                        <span className={`rd-frozen-pct ${tuHeld === 0 ? 'none' : (tuPct < 66.666 ? 'bad' : (tuPasses ? 'ok' : 'warn'))}`}>
                          {tuPct.toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const allDayColumns = parsedData?.dayColumns || [];
  const previewColumns = allDayColumns.slice(0, 17);
  const lastPreviewCol = previewColumns[previewColumns.length - 1];

  return (
    <div className="waiver-tool-fullpage rd-root">
      {/* Top Navigation */}
      <nav className="rd-nav">
        <button className="rd-btn-outline" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Campus OS
        </button>

        <div className="rd-brand">
          <img src="/sscbs_college_logo.png" alt="" width="28" height="28" />
          <span>SSCBS <span className="accent">Attendance Tool</span></span>
        </div>

        <div className="rd-nav-right">
          {parsedData && (
            <span className="rd-sheet-name" title={fileMeta?.name}>
              {fileMeta?.name || 'attendance-export.xls'}
            </span>
          )}
          {parsedData && (
            <button className="rd-btn-outline sm" onClick={handleReplaceSheet}>
              Replace sheet
            </button>
          )}
        </div>
      </nav>

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="loading-screen-inline">
          <div className="loader-container">
            <span className="system-spinner" />
            <p>Calculating optimal waiver plan...</p>
          </div>
        </div>
      )}

      {/* Debarment Ineligibility Modal (First-look Warning when Overall Attendance < 66.7%) */}
      {isOverallIneligible && !hasAcknowledgedIneligible && totalsSummary?.overall && (
        <div className="rd-ineligible-overlay" role="dialog" aria-modal="true" aria-labelledby="rd-ineligible-title">
          <div className="rd-ineligible-modal">
            <div className="rd-ineligible-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>OFFICIAL ATTENDANCE NOTICE</span>
            </div>

            <h2 id="rd-ineligible-title" className="rd-ineligible-title">
              Not Eligible for College Waivers
            </h2>

            <div className="rd-ineligible-metric-card">
              <div className="rd-ineligible-metric-left">
                <span className="rd-ineligible-metric-lbl">Total Baseline Attendance</span>
                <div className="rd-ineligible-metric-val">
                  <span className="rd-ineligible-pct">{totalsSummary.overall.basePct.toFixed(1)}%</span>
                  <span className="rd-ineligible-fraction">({totalsSummary.overall.att} / {totalsSummary.overall.held} classes)</span>
                </div>
              </div>
              <span className="rd-ineligible-status-tag">Below 66.7% Requirement</span>
            </div>

            <div className="rd-ineligible-body">
              <p>
                According to University of Delhi Ordinance VII and SSCBS examination rules, students with an <strong>overall aggregate attendance below 66.7%</strong> across all subjects combined are <strong>strictly not eligible to apply for waivers</strong> (society, sports, ECA, or medical) to the college administration.
              </p>
              <div className="rd-ineligible-rule-note">
                <strong>Clarification:</strong> Students who maintain <strong>&ge; 66.7% overall attendance</strong> can still apply waivers for specific individual subjects below 66.7%. However, when your combined total across all subjects is under 66.7%, the administration cannot accept any waiver application.
              </div>
              <div className="rd-ineligible-sandbox-box">
                <span className="rd-sandbox-title">🧪 Simulation & Sandbox Mode Active</span>
                <p>
                  Even though official submission is not permitted, <strong>you can still freely use this tool</strong> to test waiver dates, simulate attendance outcomes, and check exactly how many classes you must attend to escape debarment.
                </p>
              </div>
            </div>

            <div className="rd-ineligible-footer">
              <button
                type="button"
                className="rd-ineligible-ack-btn"
                onClick={() => setHasAcknowledgedIneligible(true)}
              >
                I Understand — Let Me Experiment →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day Diff Popover */}
      {hoverDiff && (
        <div className="rd-popover" style={{ left: `${popoverPos.x}px`, top: `${popoverPos.y}px` }}>
          <div className="rd-pop-head">
            <strong>{hoverDiff.day?.fullLabel || hoverDiff.dateStr}</strong>
            <span
              className={`rd-pop-tag ${
                hoverDiff.mode === 'cdc'
                  ? (hoverDiff.isCurrentlyCdc ? 'rm' : 'cdc')
                  : (hoverDiff.isCurrentlyWaived ? 'rm' : 'add')
              }`}
            >
              {hoverDiff.mode === 'cdc'
                ? (hoverDiff.isCurrentlyCdc ? 'Click to remove CDC duty' : 'Click to claim CDC attendance')
                : (hoverDiff.isCurrentlyWaived ? 'Click to restore day' : 'Click to waive day')}
            </span>
          </div>
          {!hoverDiff.affectedParts || hoverDiff.affectedParts.length === 0 ? (
            <div className="rd-pop-empty">No theory or tute classes on this day.</div>
          ) : (
            hoverDiff.affectedParts.map((p, idx) => {
              const delta = p.deltaPct ?? p.delta ?? 0;
              const cur = p.curPct ?? p.beforePct ?? 0;
              const nxt = p.newPct ?? p.afterPct ?? 0;
              return (
                <div key={idx} className="rd-pop-row">
                  <span className="nm">{p.label}</span>
                  <span className={`val ${p.isHarmful ? 'harm' : 'help'}`}>
                    {cur.toFixed(1)}% → {nxt.toFixed(1)}%
                    <em>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}</em>
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Main Body */}
      {parsedData ? (
        <main className="rd-main">
          {/* Top Metrics Row */}
          <div className="rd-top">
            {/* Target Stepper */}
            <div className="rd-stat">
              <span className="lbl">Target</span>
              <div className="row">
                <span className="num">{threshold}</span>
                <span className="unit">%</span>
                <span className="rd-steps">
                  <button type="button" aria-label="Lower target" onClick={() => handleThresholdChange(threshold - 1)}>−</button>
                  <button type="button" aria-label="Raise target" onClick={() => handleThresholdChange(threshold + 1)}>+</button>
                </span>
              </div>
            </div>

            {/* Waivers Used Stepper */}
            <div className="rd-stat">
              <span className="lbl">Waivers used</span>
              <div className="row">
                <span className="num">
                  {selectedWaivers.size}
                  <span className="of">/{maxWaivers}</span>
                </span>
                <span className="unit">dates</span>
                <span className="rd-steps">
                  <button type="button" aria-label="Lower waiver limit" onClick={() => handleMaxWaiversChange(maxWaivers - 1)}>−</button>
                  <button type="button" aria-label="Raise waiver limit" onClick={() => handleMaxWaiversChange(maxWaivers + 1)}>+</button>
                </span>
              </div>
            </div>

            {/* Career Development Centre (CDC) Attendance Duty Stepper */}
            <div className={`rd-stat ${cdcLimit > 0 ? 'cdc-stat' : ''}`}>
              <span className="lbl" title="Career Development Centre (CDC) Attendance Duty Allowance">CDC Duty</span>
              <div className="row">
                <span className="num">
                  {selectedCdcDays.size}
                  <span className="of">/{cdcLimit}</span>
                </span>
                <span className="unit">dates</span>
                <span className="rd-steps">
                  <button type="button" aria-label="Lower CDC duty limit" onClick={() => setCdcLimit(Math.max(0, cdcLimit - 1))}>−</button>
                  <button type="button" aria-label="Raise CDC duty limit" onClick={() => setCdcLimit(Math.min(15, cdcLimit + 1))}>+</button>
                </span>
              </div>
            </div>

            {/* Status Banner */}
            <div className={`rd-status ${simStats?.allPassing ? 'ok' : ((simStats?.debarSafeTargetCount ?? 0) < totalTargetParts ? 'bad' : 'warn')}`}>
              {simStats?.allPassing ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="8 12.5 11 15.5 16 9.5" />
                </svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12" y2="17" />
                </svg>
              )}
              <div>
                <strong>{passingTargetCount} of {totalTargetParts} theory and tute parts are above {threshold}%</strong>
                <span>
                  {selectedWaivers.size === 0
                    ? `Showing raw baseline attendance (0 waivers applied). You can apply recommended waivers (${solverResult?.chosenDays?.length || 0} dates) below.`
                    : `With the ${selectedWaivers.size} waiver date${selectedWaivers.size === 1 ? '' : 's'} selected. Practicals are shown for info only.`}
                </span>
              </div>
              {selectedWaivers.size === 0 && solverResult?.chosenDays?.length > 0 && (
                <button type="button" className="rd-btn-outline sm rd-btn-accent" onClick={handleApplyRecommended}>
                  Apply recommended ({solverResult.chosenDays.length})
                </button>
              )}
              {hasParamsChanged && selectedWaivers.size > 0 && (
                <button type="button" className="rd-btn-outline sm" onClick={handleUpdateRecommendation}>
                  Update recommendation
                </button>
              )}
            </div>
          </div>

          
          {/* Shortage Insight Callout Banner with 1-Click Action */}
          {solverResult?.status === 'SHORTAGE' && solverResult?.neededWaiversForAllPass && (
            <div className="rd-shortage-callout">
              <div className="rd-shortage-content">
                <span className="rd-shortage-title">
                  💡 Need {solverResult.shortfall} more waiver{solverResult.shortfall === 1 ? '' : 's'} ({solverResult.neededWaiversForAllPass} total) to clear all subjects to {threshold}%!
                </span>
                <span className="rd-shortage-desc">
                  Currently {passingTargetCount} of {totalTargetParts} parts meet {threshold}%. Remaining waivers were waterfilled to maximize marks and prevent debarment.
                </span>
              </div>
              <button
                type="button"
                className="rd-shortage-btn"
                onClick={() => {
                  const newLimit = solverResult.neededWaiversForAllPass;
                  setMaxWaivers(newLimit);
                  setIsProcessing(true);
                  executeSolverAsync(parsedData, threshold, newLimit, (newSol) => {
                    if (newSol?.chosenDays?.length > 0) {
                      setSelectedWaivers(new Set(newSol.chosenDays.map(d => d.dateStr)));
                    }
                  });
                }}
              >
                Increase to {solverResult.neededWaiversForAllPass} & Apply
              </button>
            </div>
          )}

          {/* Full-width 3-Metric Aggregate Attendance Card */}
          {renderTotalsSummary()}

          {/* 2-Column Layout */}
          <div className="rd-columns">
            {/* Left: Subject Health */}
            <section className="rd-health" aria-label="Subject health">
              <div className="rd-sec-head">
                <div>
                  <h2>Subject health</h2>
                  <span className="rd-sec-sub">
                    {starredSubjects.size > 0
                      ? `⭐ Prioritizing ${starredSubjects.size} starred subject${starredSubjects.size === 1 ? '' : 's'}`
                      : 'Star any subject to prioritize it for waivers'}
                  </span>
                </div>
                <div className="rd-legend">
                  <span><i className="f-safe" />{threshold}% or above (Target)</span>
                  <span><i className="f-warn" />66.7% – {(threshold - 0.1).toFixed(1)}% (Below Target)</span>
                  <span><i className="f-fail" />Below 66.7% (Risk)</span>
                  <span className="rd-legend-star" title={`Star icon prioritizes subjects to reach ${threshold}% first when waivers are scarce`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="#f59e0b" stroke="#b45309" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    ★ Star (Prioritize)
                  </span>
                </div>
              </div>

              {renderSubjectCards()}
            </section>

            {/* Right: Sidebar with Preview Grid & Recommended Dates */}
            <div className="rd-side">
              {/* Spreadsheet Grid Preview */}
              <section className="rd-panel rd-preview" aria-label="Spreadsheet grid preview">
                <div className="rd-panel-head">
                  <div>
                    <h2>Spreadsheet grid</h2>
                    <span>Click a date to waive or restore that whole day</span>
                  </div>
                  <div className="rd-grid-acts">
                    {cdcLimit > 0 && (
                      <div className="rd-tool-toggle" role="group" aria-label="Grid Click Action Mode">
                        <button
                          type="button"
                          className={`rd-tool-btn ${gridToolMode === 'waiver' ? 'active' : ''}`}
                          onClick={() => setGridToolMode('waiver')}
                        >
                          Waivers
                        </button>
                        <button
                          type="button"
                          className={`rd-tool-btn cdc ${gridToolMode === 'cdc' ? 'active' : ''}`}
                          onClick={() => setGridToolMode('cdc')}
                        >
                          CDC Duty ({selectedCdcDays.size}/{cdcLimit})
                        </button>
                      </div>
                    )}
                    {solverResult?.chosenDays?.length > 0 && (
                      <button
                        type="button"
                        className={`rd-btn-outline sm ${selectedWaivers.size === 0 ? 'rd-btn-accent' : ''}`}
                        onClick={handleApplyRecommended}
                        title={selectedWaivers.size === 0 ? 'Apply recommended waiver plan' : 'Reset to recommended plan'}
                      >
                        {selectedWaivers.size === 0 ? 'Apply recommended' : 'Reset'}
                      </button>
                    )}
                    {selectedCdcDays.size > 0 && (
                      <button
                        type="button"
                        className="rd-btn-outline sm muted"
                        onClick={handleClearCdc}
                        title="Clear all claimed CDC duty days"
                      >
                        Clear CDC
                      </button>
                    )}
                    <button
                      type="button"
                      className="rd-btn-outline sm muted"
                      onClick={handleClearAll}
                      disabled={selectedWaivers.size === 0 && selectedCdcDays.size === 0}
                      title="Clear all active waivers & CDC days"
                    >
                      Clear
                    </button>
                    <button type="button" className="rd-btn-dark" onClick={() => setIsGridExpanded(true)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="15 3 21 3 21 9" />
                        <polyline points="9 21 3 21 3 15" />
                        <line x1="21" y1="3" x2="14" y2="10" />
                        <line x1="3" y1="21" x2="10" y2="14" />
                      </svg>
                      Expand grid
                    </button>
                  </div>
                </div>
                <div className="rd-preview-body">
                  {renderGridTable(previewColumns, false)}
                  <div className="rd-fade" />
                </div>
                <div className="rd-panel-foot">
                  <span>
                    Showing {previewColumns[0]?.label} to {lastPreviewCol?.label} of {allDayColumns.length} class days
                  </span>
                  <div className="rd-preview-foot-right">
                    <span className="rd-count sm">{selectedWaivers.size} of {maxWaivers} waived</span>
                    {cdcLimit > 0 && (
                      <span className="rd-count sm cdc">{selectedCdcDays.size} of {cdcLimit} CDC</span>
                    )}
                    <span className="rd-key">
                      <i />Waived
                    </span>
                    {cdcLimit > 0 && (
                      <span className="rd-key cdc">
                        <i />CDC Duty
                      </span>
                    )}
                  </div>
                </div>
              </section>

              {/* Recommended Dates Panel */}
              <section className="rd-panel rd-dates" aria-label="Recommended dates">
                <div className="rd-dates-head">
                  <div className="ttl">
                    <h2>Recommended dates</h2>
                    <span className="rd-count">{selectedWaivers.size} of {maxWaivers}</span>
                  </div>
                  <div className="acts">
                    {copyFeedback && <span className="rd-copied">{copyFeedback}</span>}
                    {solverResult?.chosenDays?.length > 0 && (
                      <button
                        type="button"
                        className={`rd-btn-outline sm ${selectedWaivers.size === 0 ? 'rd-btn-accent' : ''}`}
                        onClick={handleApplyRecommended}
                      >
                        {selectedWaivers.size === 0 ? 'Apply recommended' : 'Reset'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="rd-btn-outline sm"
                      onClick={handleCopyDates}
                      disabled={selectedDaysList.length === 0}
                    >
                      Copy list
                    </button>
                    <button
                      type="button"
                      className="rd-btn-outline sm muted"
                      onClick={handleClearAll}
                      disabled={selectedWaivers.size === 0}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {selectedDaysList.length === 0 ? (
                  <div className="rd-empty">
                    <p>No waivers applied yet. Viewing raw attendance.</p>
                    {solverResult?.chosenDays?.length > 0 && (
                      <button type="button" className="rd-btn-dark" onClick={handleApplyRecommended}>
                        Apply recommended waivers ({solverResult.chosenDays.length} dates)
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="rd-date-list">
                    {selectedDaysList.map(item => (
                      <li key={item.dateStr}>
                        <div className="cal">
                          <b>{item.dayNum}</b>
                          <span>{item.monthShort}</span>
                        </div>
                        <div className="txt">
                          <span className="l1">
                            {item.weekday} <em>· {item.totalMissed} missed</em>
                          </span>
                          <span className="l2">
                            {item.missedSubjects.length ? item.missedSubjects.join(', ') : 'No absences recorded'}
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${item.dayNum} ${item.monthShort}`}
                          onClick={() => handleToggleDay(item.dateStr)}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </main>
      ) : (
        /* Upload Screen */
        <main className="upload-screen-container">
          <div className="upload-card-wrapper">
            <h1 className="upload-card-title">Upload your attendance sheet</h1>
            <p className="upload-card-subtitle">
              Use the attendance report exported from the college ERP portal. We read every class you attended or missed and work out which dates are worth waiving.
            </p>

            <div className={`dropzone-upload-box ${file ? 'has-file' : ''}`} onDragOver={handleDragOver} onDrop={handleDrop}>
              <input
                type="file"
                id="attendance-file-input"
                accept=".xls,.xlsx"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="attendance-file-input" className="dropzone-clickable-label">
                <div className="upload-icon-circle">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
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

            <div className="upload-params-row upload-params-row-4">
              {/* Target Parameter */}
              <div className="param-input-box">
                <span className="param-label">TARGET</span>
                <div className="param-stepper-wrap">
                  <span className="param-number">{threshold}</span>
                  <span className="param-unit">%</span>
                  <div className="param-stepper-arrows">
                    <button type="button" className="arrow-btn" onClick={() => setThreshold(e => Math.min(99, e + 1))}>▲</button>
                    <button type="button" className="arrow-btn" onClick={() => setThreshold(e => Math.max(50, e - 1))}>▼</button>
                  </div>
                </div>
              </div>

              {/* Waiver Limit Parameter */}
              <div className="param-input-box">
                <span className="param-label">WAIVER LIMIT</span>
                <div className="param-stepper-wrap">
                  <span className="param-number">{maxWaivers}</span>
                  <span className="param-unit">dates</span>
                  <div className="param-stepper-arrows">
                    <button type="button" className="arrow-btn" onClick={() => setMaxWaivers(e => Math.min(30, e + 1))}>▲</button>
                    <button type="button" className="arrow-btn" onClick={() => setMaxWaivers(e => Math.max(1, e - 1))}>▼</button>
                  </div>
                </div>
              </div>

              {/* Semester Starts Parameter */}
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

              {/* CDC Attendance Duty Parameter */}
              <div className="param-input-box">
                <span className="param-label">CDC DUTY</span>
                <div className="param-stepper-wrap">
                  <span className="param-number">{cdcLimit}</span>
                  <span className="param-unit">dates</span>
                  <div className="param-stepper-arrows">
                    <button type="button" className="arrow-btn" onClick={() => setCdcLimit(e => Math.min(15, e + 1))}>▲</button>
                    <button type="button" className="arrow-btn" onClick={() => setCdcLimit(e => Math.max(0, e - 1))}>▼</button>
                  </div>
                </div>
              </div>
            </div>

            <p className="upload-params-caption">
              Career Development Centre (CDC) duty allows converting absences into presents. Leave 0 if not applicable. You can adjust all parameters later.
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
      )}

      {/* Expanded Grid Modal Overlay */}
      {isGridExpanded && parsedData && (
        <div className="rd-overlay" onClick={() => setIsGridExpanded(false)}>
          <section className="rd-expanded" role="dialog" aria-label="Spreadsheet grid, expanded" onClick={(e) => e.stopPropagation()}>
            <div className="rd-panel-head">
              <div>
                <h2>Spreadsheet grid</h2>
                <span>Scroll sideways for every class day. Click a date or cell to waive or restore the whole day.</span>
              </div>
              <div className="rd-exp-acts">
                {cdcLimit > 0 && (
                  <div className="rd-tool-toggle" role="group" aria-label="Expanded Grid Action Mode">
                    <button
                      type="button"
                      className={`rd-tool-btn ${gridToolMode === 'waiver' ? 'active' : ''}`}
                      onClick={() => setGridToolMode('waiver')}
                    >
                      Waivers ({selectedWaivers.size}/{maxWaivers})
                    </button>
                    <button
                      type="button"
                      className={`rd-tool-btn cdc ${gridToolMode === 'cdc' ? 'active' : ''}`}
                      onClick={() => setGridToolMode('cdc')}
                    >
                      CDC Duty ({selectedCdcDays.size}/{cdcLimit})
                    </button>
                  </div>
                )}
                {solverResult?.chosenDays?.length > 0 && (
                  <button
                    type="button"
                    className={`rd-btn-outline sm ${selectedWaivers.size === 0 ? 'rd-btn-accent' : ''}`}
                    onClick={handleApplyRecommended}
                  >
                    {selectedWaivers.size === 0 ? 'Apply recommended' : 'Reset to recommended'}
                  </button>
                )}
                {selectedCdcDays.size > 0 && (
                  <button
                    type="button"
                    className="rd-btn-outline sm muted"
                    onClick={handleClearCdc}
                  >
                    Clear CDC
                  </button>
                )}
                <button
                  type="button"
                  className="rd-btn-outline sm muted"
                  onClick={handleClearAll}
                  disabled={selectedWaivers.size === 0 && selectedCdcDays.size === 0}
                >
                  Clear all
                </button>
                <button type="button" className="rd-btn-dark" onClick={() => setIsGridExpanded(false)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                  Collapse
                </button>
              </div>
            </div>

            <div className="rd-exp-body">
              {renderGridTable(allDayColumns, true)}
            </div>

            <div className="rd-panel-foot">
              <div className="rd-exp-legend">
                <span><span className="rd-chip p">P<small>Th</small></span> Present</span>
                <span><span className="rd-chip a">A<small>Th</small></span> Absent</span>
                <span className="rd-key"><i /> Waived day (classes removed)</span>
                {cdcLimit > 0 && (
                  <span className="rd-key cdc">
                    <i /> CDC Duty day (absence marked present)
                  </span>
                )}
              </div>
              <span>Frozen Theory & Tutorial columns show real-time percentage shifts</span>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
