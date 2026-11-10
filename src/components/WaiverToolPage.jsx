import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { canAccessWaiver } from '../lib/admin';
import { PercentIcon } from './icons';
import { trackWaiverEvent } from '../lib/analytics';
import { parseAttendanceFile, MONTH_NAMES, MONTHS_FULL } from '../lib/waiverParser';
import {
  cloneParsedData,
  editCellClasses,
  addDateColumn,
  deleteDateColumn,
  diffCustomizations
} from '../lib/attendanceEditor';
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

function formatTimelineDisplay(startStr, endStr, sheetMinDate, sheetMaxDate) {
  const start = startStr || sheetMinDate;
  const end = endStr || sheetMaxDate;
  if (!start && !end) return 'All dates';
  const fmt = (ds) => {
    if (!ds) return '';
    const parts = ds.split('-');
    if (parts.length < 3) return ds;
    const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(parts[1], 10) - 1] || parts[1];
    return `${parseInt(parts[2], 10)} ${m}`;
  };
  if (start && end) {
    if (start === end) return fmt(start);
    return `${fmt(start)} – ${fmt(end)}`;
  }
  if (start) return `From ${fmt(start)}`;
  return `Until ${fmt(end)}`;
}

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
  const [maxWaivers, setMaxWaivers] = useState(12); // K >= 0 (unlocked)
  const [threshold, setThreshold] = useState(85); // T: 50 - 99
  const [startingMonth, setStartingMonth] = useState(7); // 7 = August (0-indexed)
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Parsed attendance data (active working dataset & pristine raw baseline)
  const [parsedData, setParsedData] = useState(null);
  const [rawParsedData, setRawParsedData] = useState(null);

  // Manual attendance editing state
  const [editingCell, setEditingCell] = useState(null); // { subjectName, dateStr, classes: [...] }
  const [isAddDateModalOpen, setIsAddDateModalOpen] = useState(false);
  const [newDateInput, setNewDateInput] = useState('');
  const [newDateError, setNewDateError] = useState('');
  const [dateToDelete, setDateToDelete] = useState(null); // { dateStr, fullLabel }
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Active selected waivers (Set of 'YYYY-MM-DD' date strings)
  const [selectedWaivers, setSelectedWaivers] = useState(new Set());

  // Manually locked / pinned waivers and CDC dates (Set of 'YYYY-MM-DD' date strings)
  const [lockedWaivers, setLockedWaivers] = useState(new Set());
  const [lockedCdcDays, setLockedCdcDays] = useState(new Set());

  // Prioritized / starred subjects (Set of subject names)
  const [starredSubjects, setStarredSubjects] = useState(new Set());
  const [hasPendingPriorityChange, setHasPendingPriorityChange] = useState(false);

  // Career Development Centre (CDC) Attendance inputs
  const [cdcLimit, setCdcLimit] = useState(0); // CDC >= 0 (unlocked)
  const [selectedCdcDays, setSelectedCdcDays] = useState(new Set()); // Set of 'YYYY-MM-DD'
  const [gridToolMode, setGridToolMode] = useState('waiver'); // 'waiver' | 'cdc' | 'edit'

  // Recommended waiver timeline window: 'YYYY-MM-DD' strings
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');

  // Prioritized / Approved Society Dates (waivers prioritized for official society approval dates)
  const [priorityDates, setPriorityDates] = useState(new Set());
  const [isPriorityDatesModalOpen, setIsPriorityDatesModalOpen] = useState(false);
  const [tempPriorityDates, setTempPriorityDates] = useState(new Set());
  const [priorityDateSearch, setPriorityDateSearch] = useState('');

  // Ineligibility acknowledgement state (shown when baseline overall attendance < 66.7%)
  const [hasAcknowledgedIneligible, setHasAcknowledgedIneligible] = useState(false);

  // One-third rule alert dismiss state
  const [isOneThirdAlertDismissed, setIsOneThirdAlertDismissed] = useState(false);

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

  // Track manual attendance customizations diff
  const customizationDiff = useMemo(() => {
    return diffCustomizations(rawParsedData, parsedData);
  }, [rawParsedData, parsedData]);

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
          if (saved.rawParsedData) {
            setRawParsedData(saved.rawParsedData);
          } else {
            setRawParsedData(saved.parsedData);
          }
          if (Array.isArray(saved.selectedWaivers)) {
            setSelectedWaivers(new Set(saved.selectedWaivers));
          }
          if (Array.isArray(saved.lockedWaivers)) {
            setLockedWaivers(new Set(saved.lockedWaivers));
          }
          if (Array.isArray(saved.lockedCdcDays)) {
            setLockedCdcDays(new Set(saved.lockedCdcDays));
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
          if (Array.isArray(saved.priorityDates)) {
            setPriorityDates(new Set(saved.priorityDates));
          }
          if (saved.gridToolMode) setGridToolMode(saved.gridToolMode);
          if (saved.customStartDate !== undefined) setCustomStartDate(saved.customStartDate);
          if (saved.customEndDate !== undefined) setCustomEndDate(saved.customEndDate);
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
        rawParsedData,
        parsedData,
        selectedWaivers: Array.from(selectedWaivers),
        lockedWaivers: Array.from(lockedWaivers),
        lockedCdcDays: Array.from(lockedCdcDays),
        starredSubjects: Array.from(starredSubjects),
        solverResult,
        kPlusOneResult,
        maxWaivers,
        threshold,
        fileMeta,
        hasAcknowledgedIneligible,
        cdcLimit,
        selectedCdcDays: Array.from(selectedCdcDays),
        priorityDates: Array.from(priorityDates),
        gridToolMode,
        customStartDate,
        customEndDate
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (err) {
      console.warn('Failed to persist Waiver Tool state:', err);
    }
  }, [rawParsedData, parsedData, selectedWaivers, lockedWaivers, lockedCdcDays, starredSubjects, priorityDates, solverResult, kPlusOneResult, maxWaivers, threshold, fileMeta, hasAcknowledgedIneligible, cdcLimit, selectedCdcDays, gridToolMode, customStartDate, customEndDate, storageKey]);

  // Prevent scroll when expanded grid modal is open
  useEffect(() => {
    if (!isGridExpanded) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isGridExpanded]);

  // Close expanded grid and modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsGridExpanded(false);
        setIsTimelineModalOpen(false);
        setIsPriorityDatesModalOpen(false);
        setEditingCell(null);
        setIsAddDateModalOpen(false);
        setDateToDelete(null);
        setIsResetConfirmOpen(false);
        setIsOneThirdAlertDismissed(true);
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

  // Run Solver Async with Worker or Fallback (Joint Waivers + CDC Attendance + Timeline)
  const executeSolverAsync = (data, targetT = threshold, limitK = maxWaivers, limitCOrStars = cdcLimit, starsOrCb, maybeCb, solverOpts = {}) => {
    let actualCdc = cdcLimit;
    let stars = starredSubjects;
    let callback = null;
    let extraOpts = solverOpts;

    if (typeof limitCOrStars === 'number') {
      actualCdc = limitCOrStars;
      if (typeof starsOrCb === 'function') {
        callback = starsOrCb;
      } else if (starsOrCb !== undefined) {
        stars = starsOrCb;
        if (typeof maybeCb === 'function') callback = maybeCb;
        else if (typeof maybeCb === 'object' && maybeCb !== null) extraOpts = maybeCb;
      }
    } else if (typeof limitCOrStars === 'function') {
      callback = limitCOrStars;
    } else if (limitCOrStars instanceof Set || Array.isArray(limitCOrStars)) {
      stars = limitCOrStars;
      callback = starsOrCb;
    }

    const actualStartMonth = extraOpts.waiverStartMonth !== undefined ? extraOpts.waiverStartMonth : 0;
    const actualStartDate = extraOpts.waiverStartDate !== undefined ? extraOpts.waiverStartDate : (customStartDate || null);
    const actualEndDate = extraOpts.waiverEndDate !== undefined ? extraOpts.waiverEndDate : (customEndDate || null);
    const actualFixedWaivers = extraOpts.fixedWaiverDates !== undefined
      ? (Array.isArray(extraOpts.fixedWaiverDates) ? extraOpts.fixedWaiverDates : Array.from(extraOpts.fixedWaiverDates || []))
      : (lockedWaivers.size > 0 ? Array.from(lockedWaivers) : []);
    const actualFixedCdc = extraOpts.fixedCdcDates !== undefined
      ? (Array.isArray(extraOpts.fixedCdcDates) ? extraOpts.fixedCdcDates : Array.from(extraOpts.fixedCdcDates || []))
      : (lockedCdcDays.size > 0 ? Array.from(lockedCdcDays) : []);
    const actualPriorityDates = extraOpts.priorityWaiverDates !== undefined
      ? (Array.isArray(extraOpts.priorityWaiverDates) ? extraOpts.priorityWaiverDates : Array.from(extraOpts.priorityWaiverDates || []))
      : (priorityDates.size > 0 ? Array.from(priorityDates) : []);
    const starredList = Array.from(stars || []);

    if (workerRef.current) {
      const solveId = Date.now();
      const timeoutId = setTimeout(() => {
        workerRef.current?.removeEventListener('message', onMessage);
        setIsProcessing(false);
      }, 10000);

      const onMessage = (ev) => {
        if (ev.data?.id === solveId) {
          clearTimeout(timeoutId);
          workerRef.current?.removeEventListener('message', onMessage);
          if (ev.data.success) {
            setSolverResult(ev.data.solution);
            setKPlusOneResult(ev.data.kPlusOneSolution);
            if (callback) callback(ev.data.solution);
          }
          setIsProcessing(false);
        }
      };

      const onError = () => {
        clearTimeout(timeoutId);
        workerRef.current?.removeEventListener('message', onMessage);
        workerRef.current?.removeEventListener('error', onError);
        setIsProcessing(false);
      };
      workerRef.current.addEventListener('error', onError, { once: true });
      workerRef.current.addEventListener('message', onMessage);
      workerRef.current.postMessage({
        id: solveId,
        parsedData: data,
        targetPct: targetT,
        maxWaiversK: limitK,
        starredSubjects: starredList,
        cdcLimit: actualCdc,
        waiverStartMonth: actualStartMonth,
        waiverStartDate: actualStartDate,
        waiverEndDate: actualEndDate,
        fixedWaiverDates: actualFixedWaivers,
        fixedCdcDates: actualFixedCdc,
        priorityWaiverDates: actualPriorityDates
      });
    } else {
      setTimeout(() => {
        try {
          const options = {
            waiverStartMonth: actualStartMonth,
            waiverStartDate: actualStartDate,
            waiverEndDate: actualEndDate,
            fixedWaiverDates: actualFixedWaivers,
            fixedCdcDates: actualFixedCdc,
            priorityWaiverDates: actualPriorityDates
          };
          const solution = solveExactBnb(data, targetT, limitK, starredList, actualCdc, options);
          let kPlusOne = null;
          if (solution.status === 'SHORTAGE') {
            kPlusOne = solveKPlusOne(data, targetT, limitK, starredList, actualCdc, options);
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

        setRawParsedData(parsed);
        setParsedData(parsed);

        executeSolverAsync(parsed, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
          trackWaiverEvent('waiver_solved', {
            status: solution.status,
            passCount: solution.passCount,
            totalTargetParts: solution.totalTargetParts,
            chosenDaysCount: solution.chosenDays.length
          });

          // Do NOT apply waivers automatically upon file submission/open.
          // Show pure baseline attendance first per user requirement.
          setSelectedWaivers(new Set());
          setSelectedCdcDays(new Set());
        }, {
          waiverStartDate: customStartDate || null,
          waiverEndDate: customEndDate || null
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

  const sheetMinDate = useMemo(() => parsedData?.dayColumns?.[0]?.dateStr || '', [parsedData]);
  const sheetMaxDate = useMemo(() => parsedData?.dayColumns?.[parsedData.dayColumns.length - 1]?.dateStr || '', [parsedData]);

  const activeWaiverStart = customStartDate || '';
  const activeWaiverEnd = customEndDate || '';

  const currentSolverOptions = useMemo(() => ({
    waiverStartDate: activeWaiverStart || null,
    waiverEndDate: activeWaiverEnd || null,
    priorityWaiverDates: priorityDates.size > 0 ? Array.from(priorityDates) : []
  }), [activeWaiverStart, activeWaiverEnd, priorityDates]);

  const handleUpdateRecommendation = () => {
    if (!parsedData) return;
    setIsProcessing(true);
    executeSolverAsync(parsedData, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
      if (solution?.chosenDays && solution.chosenDays.length > 0) {
        setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
      }
      if (solution?.chosenCdcDays && solution.chosenCdcDays.length > 0) {
        setSelectedCdcDays(new Set(solution.chosenCdcDays.map(d => d.dateStr)));
      }
    }, currentSolverOptions);
  };

  const handleReplaceSheet = () => {
    setParsedData(null);
    setRawParsedData(null);
    setEditingCell(null);
    setIsAddDateModalOpen(false);
    setDateToDelete(null);
    setIsResetConfirmOpen(false);
    setSelectedWaivers(new Set());
    setSelectedCdcDays(new Set());
    setLockedWaivers(new Set());
    setLockedCdcDays(new Set());
    setCdcLimit(0);
    setGridToolMode('waiver');
    setStarredSubjects(new Set());
    setHasAcknowledgedIneligible(false);
    setSolverResult(null);
    setKPlusOneResult(null);
    setFile(null);
    setFileMeta(null);
    setError(null);
    setCustomStartDate('');
    setCustomEndDate('');
    setIsTimelineModalOpen(false);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  // Open manual cell editor modal for a specific subject & date
  const handleOpenCellEditor = (subjectName, dateStr) => {
    if (!parsedData) return;
    const sub = parsedData.subjects?.find(s => s.name === subjectName);
    const existingClasses = sub?.dayClasses?.[dateStr];
    const initialClasses = existingClasses && existingClasses.length > 0
      ? existingClasses.map(c => ({ type: c.type || 'th', attended: Boolean(c.attended) }))
      : [{ type: 'th', attended: true }];

    setEditingCell({
      subjectName,
      dateStr,
      classes: initialClasses
    });
  };

  // Save modified cell classes
  const handleSaveCellClasses = () => {
    if (!editingCell || !parsedData) return;
    const { subjectName, dateStr, classes } = editingCell;
    const updated = editCellClasses(parsedData, subjectName, dateStr, classes);
    setParsedData(updated);
    setEditingCell(null);

    // Re-run solver live with updated attendance matrix
    setIsProcessing(true);
    executeSolverAsync(updated, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
      if (solution?.chosenDays && isOptimalSuggested) {
        setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
        setSelectedCdcDays(solution.chosenCdcDays?.length ? new Set(solution.chosenCdcDays.map(d => d.dateStr)) : new Set());
      }
      setIsOneThirdAlertDismissed(false);
    }, currentSolverOptions);
  };

  // Clear all classes for this cell
  const handleClearCellClasses = () => {
    if (!editingCell || !parsedData) return;
    const { subjectName, dateStr } = editingCell;
    const updated = editCellClasses(parsedData, subjectName, dateStr, []);
    setParsedData(updated);
    setEditingCell(null);

    setIsProcessing(true);
    executeSolverAsync(updated, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
      if (solution?.chosenDays && isOptimalSuggested) {
        setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
        setSelectedCdcDays(solution.chosenCdcDays?.length ? new Set(solution.chosenCdcDays.map(d => d.dateStr)) : new Set());
      }
      setIsOneThirdAlertDismissed(false);
    }, currentSolverOptions);
  };

  // Add a new date column
  const handleAddDate = () => {
    if (!newDateInput) {
      setNewDateError('Please choose a valid date.');
      return;
    }
    if (parsedData?.dayColumns?.some(d => d.dateStr === newDateInput)) {
      setNewDateError('This date already exists in the grid.');
      return;
    }

    const updated = addDateColumn(parsedData, newDateInput);
    setParsedData(updated);
    setIsAddDateModalOpen(false);
    setNewDateInput('');
    setNewDateError('');

    setIsProcessing(true);
    executeSolverAsync(updated, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
      if (solution?.chosenDays && isOptimalSuggested) {
        setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
        setSelectedCdcDays(solution.chosenCdcDays?.length ? new Set(solution.chosenCdcDays.map(d => d.dateStr)) : new Set());
      }
      setIsOneThirdAlertDismissed(false);
    }, currentSolverOptions);
  };

  // Delete a full date column
  const handleConfirmDeleteDate = () => {
    if (!dateToDelete || !parsedData) return;
    const delDate = dateToDelete.dateStr;
    const updated = deleteDateColumn(parsedData, delDate);

    // If deleted date was actively waived or CDC, remove it
    if (selectedWaivers.has(delDate)) {
      const nextW = new Set(selectedWaivers);
      nextW.delete(delDate);
      setSelectedWaivers(nextW);
    }
    if (selectedCdcDays.has(delDate)) {
      const nextC = new Set(selectedCdcDays);
      nextC.delete(delDate);
      setSelectedCdcDays(nextC);
    }

    setParsedData(updated);
    setDateToDelete(null);

    setIsProcessing(true);
    executeSolverAsync(updated, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
      if (solution?.chosenDays && isOptimalSuggested) {
        setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
        setSelectedCdcDays(solution.chosenCdcDays?.length ? new Set(solution.chosenCdcDays.map(d => d.dateStr)) : new Set());
      }
      setIsOneThirdAlertDismissed(false);
    }, currentSolverOptions);
  };

  // Reset all manual edits back to pristine uploaded raw file
  const handleResetToRaw = () => {
    if (!rawParsedData) return;
    const pristine = cloneParsedData(rawParsedData);
    setParsedData(pristine);
    setIsResetConfirmOpen(false);

    // Filter out any active waivers/CDC dates that were in custom dates that don't exist in pristine
    const validDates = new Set(pristine.dayColumns.map(d => d.dateStr));
    const nextW = new Set([...selectedWaivers].filter(d => validDates.has(d)));
    const nextC = new Set([...selectedCdcDays].filter(d => validDates.has(d)));
    setSelectedWaivers(nextW);
    setSelectedCdcDays(nextC);

    setIsProcessing(true);
    executeSolverAsync(pristine, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
      if (solution?.chosenDays && (nextW.size > 0 || nextC.size > 0)) {
        setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
        setSelectedCdcDays(solution.chosenCdcDays?.length ? new Set(solution.chosenCdcDays.map(d => d.dateStr)) : new Set());
      }
    }, currentSolverOptions);
  };

  // Toggle priority star on subject with instant live UI and non-blocking recalculation option
  const handleToggleStar = (subjectName) => {
    const next = new Set(starredSubjects);
    if (next.has(subjectName)) {
      next.delete(subjectName);
    } else {
      next.add(subjectName);
    }
    setStarredSubjects(next);
    setHasPendingPriorityChange(true);
    if (parsedData) {
      // Async re-solve in background without locking the screen with a full-page modal
      executeSolverAsync(parsedData, threshold, maxWaivers, cdcLimit, next, (solution) => {
        // If user has not applied any waivers yet, seamlessly update recommendation
        if (selectedWaivers.size === 0 && selectedCdcDays.size === 0) {
          setHasPendingPriorityChange(false);
        }
      }, currentSolverOptions);
    }
  };

  // Recalculate waivers with updated priorities on explicit CTA click
  const handleRecalculateWithPriorities = () => {
    setHasPendingPriorityChange(false);
    setLockedWaivers(new Set());
    setLockedCdcDays(new Set());
    setIsOneThirdAlertDismissed(false);
    setIsProcessing(true);
    executeSolverAsync(parsedData, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
      if (solution?.chosenDays) {
        setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
        setSelectedCdcDays(solution.chosenCdcDays?.length ? new Set(solution.chosenCdcDays.map(d => d.dateStr)) : new Set());
      }
      setIsProcessing(false);
    }, { ...currentSolverOptions, fixedWaiverDates: [], fixedCdcDates: [] });
  };

  const handleToggleDay = (dateStr) => {
    if (gridToolMode === 'priority') {
      setPriorityDates(prev => {
        const next = new Set(prev);
        if (next.has(dateStr)) next.delete(dateStr);
        else next.add(dateStr);
        return next;
      });
      if (selectedWaivers.size > 0 || selectedCdcDays.size > 0) {
        setHasPendingPriorityChange(true);
      }
      return;
    }

    if (gridToolMode === 'cdc' && cdcLimit > 0) {
      const nextCdc = new Set(selectedCdcDays);
      if (nextCdc.has(dateStr)) {
        nextCdc.delete(dateStr);
        setLockedCdcDays(prev => {
          if (!prev.has(dateStr)) return prev;
          const next = new Set(prev);
          next.delete(dateStr);
          return next;
        });
      } else {
        if (nextCdc.size >= cdcLimit) {
          return;
        }
        nextCdc.add(dateStr);
        if (selectedWaivers.has(dateStr)) {
          const nextW = new Set(selectedWaivers);
          nextW.delete(dateStr);
          setSelectedWaivers(nextW);
          setLockedWaivers(prev => {
            if (!prev.has(dateStr)) return prev;
            const next = new Set(prev);
            next.delete(dateStr);
            return next;
          });
        }
      }
      setSelectedCdcDays(nextCdc);
    } else {
      const nextW = new Set(selectedWaivers);
      if (nextW.has(dateStr)) {
        nextW.delete(dateStr);
        setLockedWaivers(prev => {
          if (!prev.has(dateStr)) return prev;
          const next = new Set(prev);
          next.delete(dateStr);
          return next;
        });
      } else {
        nextW.add(dateStr);
        if (selectedCdcDays.has(dateStr)) {
          const nextC = new Set(selectedCdcDays);
          nextC.delete(dateStr);
          setSelectedCdcDays(nextC);
          setLockedCdcDays(prev => {
            if (!prev.has(dateStr)) return prev;
            const next = new Set(prev);
            next.delete(dateStr);
            return next;
          });
        }
      }
      setSelectedWaivers(nextW);
    }
  };

  // Toggle lock / pin on a specific date so solver preserves it
  const handleToggleLockDate = (dateStr, kind = 'waiver') => {
    if (kind === 'cdc') {
      setLockedCdcDays(prev => {
        const next = new Set(prev);
        if (next.has(dateStr)) next.delete(dateStr);
        else next.add(dateStr);
        return next;
      });
    } else {
      setLockedWaivers(prev => {
        const next = new Set(prev);
        if (next.has(dateStr)) next.delete(dateStr);
        else next.add(dateStr);
        return next;
      });
    }
  };

  // Fill remaining waivers keeping currently selected and locked dates fixed
  const handleFillRemainingWaivers = () => {
    if (!parsedData) return;
    setIsProcessing(true);

    const currentWaiversArray = Array.from(selectedWaivers);
    const currentCdcArray = Array.from(selectedCdcDays);

    // Auto-lock all currently selected dates
    const nextLockedW = new Set([...lockedWaivers, ...currentWaiversArray]);
    setLockedWaivers(nextLockedW);

    const nextLockedC = new Set([...lockedCdcDays, ...currentCdcArray]);
    setLockedCdcDays(nextLockedC);

    const fillOpts = {
      ...currentSolverOptions,
      fixedWaiverDates: currentWaiversArray,
      fixedCdcDates: currentCdcArray
    };

    executeSolverAsync(parsedData, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
      if (solution?.chosenDays) {
        setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
      }
      if (solution?.chosenCdcDays) {
        setSelectedCdcDays(new Set(solution.chosenCdcDays.map(d => d.dateStr)));
      }
      setIsOneThirdAlertDismissed(false);
    }, fillOpts);
  };

  // Live parameter changes with automatic solver re-execution
  const handleMaxWaiversChange = (newLimit) => {
    const clamped = Math.max(0, newLimit);
    setMaxWaivers(clamped);
    if (parsedData) {
      setIsProcessing(true);
      executeSolverAsync(parsedData, threshold, clamped, cdcLimit, starredSubjects, (solution) => {
        setSelectedWaivers(prev => {
          if (prev.size === 0 && selectedCdcDays.size === 0) return prev;
          if (solution?.chosenDays && solution.chosenDays.length > 0) {
            return new Set(solution.chosenDays.map(d => d.dateStr));
          }
          return new Set();
        });
        setSelectedCdcDays(prev => {
          if (prev.size === 0 && selectedWaivers.size === 0) return prev;
          if (solution?.chosenCdcDays && solution.chosenCdcDays.length > 0) {
            return new Set(solution.chosenCdcDays.map(d => d.dateStr));
          }
          return new Set();
        });
      }, currentSolverOptions);
    }
  };

  const handleThresholdChange = (newThreshold) => {
    const clamped = Math.max(50, Math.min(99, newThreshold));
    setThreshold(clamped);
    if (parsedData) {
      setIsProcessing(true);
      executeSolverAsync(parsedData, clamped, maxWaivers, cdcLimit, starredSubjects, (solution) => {
        setSelectedWaivers(prev => {
          if (prev.size === 0 && selectedCdcDays.size === 0) return prev;
          if (solution?.chosenDays && solution.chosenDays.length > 0) {
            return new Set(solution.chosenDays.map(d => d.dateStr));
          }
          return new Set();
        });
        setSelectedCdcDays(prev => {
          if (prev.size === 0 && selectedWaivers.size === 0) return prev;
          if (solution?.chosenCdcDays && solution.chosenCdcDays.length > 0) {
            return new Set(solution.chosenCdcDays.map(d => d.dateStr));
          }
          return new Set();
        });
      }, currentSolverOptions);
    }
  };

  const handleCdcLimitChange = (newLimit) => {
    const clamped = Math.max(0, newLimit);
    setCdcLimit(clamped);
    if (clamped === 0) {
      setSelectedCdcDays(new Set());
      setLockedCdcDays(new Set());
      setGridToolMode('waiver');
    } else if (selectedCdcDays.size > clamped) {
      const trimmed = new Set(Array.from(selectedCdcDays).slice(0, clamped));
      setSelectedCdcDays(trimmed);
      setLockedCdcDays(prev => {
        const next = new Set();
        prev.forEach(d => { if (trimmed.has(d)) next.add(d); });
        return next;
      });
    }
    if (parsedData) {
      setIsProcessing(true);
      executeSolverAsync(parsedData, threshold, maxWaivers, clamped, starredSubjects, (solution) => {
        setSelectedWaivers(prev => {
          if (prev.size === 0 && selectedCdcDays.size === 0) return prev;
          if (solution?.chosenDays && solution.chosenDays.length > 0) {
            return new Set(solution.chosenDays.map(d => d.dateStr));
          }
          return new Set();
        });
        setSelectedCdcDays(prev => {
          if (prev.size === 0 && selectedWaivers.size === 0) return prev;
          if (solution?.chosenCdcDays && solution.chosenCdcDays.length > 0) {
            return new Set(solution.chosenCdcDays.map(d => d.dateStr));
          }
          return new Set();
        });
      }, currentSolverOptions);
    }
  };

  // Apply recommended waiver & CDC dates (clearing locks to adopt pure recommended set)
  const handleApplyRecommended = () => {
    setLockedWaivers(new Set());
    setLockedCdcDays(new Set());
    setIsOneThirdAlertDismissed(false);
    setHasPendingPriorityChange(false);
    if (solverResult) {
      const nextW = solverResult.chosenDays?.length ? new Set(solverResult.chosenDays.map(d => d.dateStr)) : new Set();
      const nextC = solverResult.chosenCdcDays?.length ? new Set(solverResult.chosenCdcDays.map(d => d.dateStr)) : new Set();
      setSelectedWaivers(nextW);
      setSelectedCdcDays(nextC);
    } else if (parsedData) {
      setIsProcessing(true);
      executeSolverAsync(parsedData, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
        const nextW = solution?.chosenDays?.length ? new Set(solution.chosenDays.map(d => d.dateStr)) : new Set();
        const nextC = solution?.chosenCdcDays?.length ? new Set(solution.chosenCdcDays.map(d => d.dateStr)) : new Set();
        setSelectedWaivers(nextW);
        setSelectedCdcDays(nextC);
        setIsOneThirdAlertDismissed(false);
      }, { ...currentSolverOptions, fixedWaiverDates: [], fixedCdcDates: [] });
    }
  };

  const handleClearAll = () => {
    setSelectedWaivers(new Set());
    setSelectedCdcDays(new Set());
    setLockedWaivers(new Set());
    setLockedCdcDays(new Set());
  };

  const handleRemoveDate = (item) => {
    if (item.kind === 'cdc') {
      const nextC = new Set(selectedCdcDays);
      nextC.delete(item.dateStr);
      setSelectedCdcDays(nextC);
      setLockedCdcDays(prev => {
        if (!prev.has(item.dateStr)) return prev;
        const next = new Set(prev);
        next.delete(item.dateStr);
        return next;
      });
    } else {
      const nextW = new Set(selectedWaivers);
      nextW.delete(item.dateStr);
      setSelectedWaivers(nextW);
      setLockedWaivers(prev => {
        if (!prev.has(item.dateStr)) return prev;
        const next = new Set(prev);
        next.delete(item.dateStr);
        return next;
      });
    }
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

  // Chronologically ordered selected date cards for the right sidebar (both Waivers and CDC Attendance)
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
          missedSubjects: cand?.missedSubjects || [],
          kind: 'waiver',
          isLocked: lockedWaivers.has(col.dateStr),
          isPriority: priorityDates.has(col.dateStr)
        });
      } else if (selectedCdcDays.has(col.dateStr)) {
        const cand = candidateDaysMap.get(col.dateStr);
        list.push({
          dateStr: col.dateStr,
          dayNum: String(col.dayNum).padStart(2, '0'),
          monthShort: MONTH_NAMES[col.month - 1]?.toUpperCase() || '',
          weekday: col.weekday,
          totalMissed: cand ? cand.totalAbsences : 0,
          missedSubjects: cand?.missedSubjects || [],
          kind: 'cdc',
          isLocked: lockedCdcDays.has(col.dateStr),
          isPriority: priorityDates.has(col.dateStr)
        });
      }
    });
    return list;
  }, [parsedData, selectedWaivers, selectedCdcDays, lockedWaivers, lockedCdcDays, priorityDates, candidateDaysMap]);

  // Live simulated stats (incorporating Waivers & Career Development Centre CDC Attendance)
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
    if (!solverResult) return false;
    const recW = solverResult.chosenDays || [];
    const recC = solverResult.chosenCdcDays || [];
    if (recW.length !== selectedWaivers.size || recC.length !== selectedCdcDays.size) {
      return false;
    }
    const wMatch = recW.every(d => selectedWaivers.has(d.dateStr));
    const cMatch = recC.every(d => selectedCdcDays.has(d.dateStr));
    return wMatch && cMatch;
  }, [solverResult, selectedWaivers, selectedCdcDays]);

  const remainingWaiversCount = Math.max(0, maxWaivers - selectedWaivers.size);
  const canFillRemaining = selectedWaivers.size > 0 && remainingWaiversCount > 0;

  // Active or recommended 1/3rd rule violating parts
  const violatingPartsForModal = useMemo(() => {
    if (selectedWaivers.size > 0 && simStats?.oneThirdViolatingParts?.length > 0) {
      return simStats.oneThirdViolatingParts;
    }
    if (solverResult?.oneThirdViolatingParts?.length > 0) {
      return solverResult.oneThirdViolatingParts;
    }
    return [];
  }, [selectedWaivers.size, simStats, solverResult]);

  const showOneThirdAlert = Boolean(
    !isOneThirdAlertDismissed &&
    selectedWaivers.size > 0 &&
    simStats?.hasOneThirdViolation &&
    violatingPartsForModal.length > 0
  );

  // Copy list to clipboard with robust fallback
  const handleCopyDates = () => {
    if (selectedDaysList.length === 0) return;
    const waiverItems = selectedDaysList.filter(d => d.kind === 'waiver');
    const cdcItems = selectedDaysList.filter(d => d.kind === 'cdc');

    const sections = [];
    if (waiverItems.length > 0) {
      const lines = waiverItems.map(item => {
        const subs = item.missedSubjects.length > 0 ? ` (${item.missedSubjects.join(', ')})` : '';
        return `• ${item.weekday}, ${item.dayNum} ${item.monthShort} - ${item.totalMissed} class(es) missed${subs}`;
      });
      sections.push(`Waivers (${waiverItems.length} dates):\n` + lines.join('\n'));
    }
    if (cdcItems.length > 0) {
      const lines = cdcItems.map(item => {
        const subs = item.missedSubjects.length > 0 ? ` (${item.missedSubjects.join(', ')})` : '';
        return `• ${item.weekday}, ${item.dayNum} ${item.monthShort} - ${item.totalMissed} class(es) converted to present${subs}`;
      });
      sections.push(`CDC Attendance (${cdcItems.length} dates):\n` + lines.join('\n'));
    }

    const text = `SSCBS Attendance Recommendation (${selectedDaysList.length} dates total):\n\n` + sections.join('\n\n');

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
        {part.isOverOneThird && (
          <div
            className="rd-one-third-note"
            role="alert"
            onClick={() => setIsOneThirdAlertDismissed(false)}
            style={{ cursor: 'pointer' }}
            title="Click to view 1/3rd rule alert"
          >
            <span className="rd-one-third-icon">⚠️</span>
            <div className="rd-one-third-text">
              <strong>1/3rd Rule Notice:</strong> You have waived off <strong>{part.waivedClasses} of {part.baseHeld}</strong> {part.shortType ? part.shortType.toLowerCase() : ''} classes ({part.waivedPct?.toFixed(0)}%), which exceeds one-third of total classes (max {part.maxAllowedOneThird} allowed). Double-check the 1/3rd rule.
            </div>
          </div>
        )}
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
                    (selectedCdcDays.size > 0 && curPct >= 66.666) ? (
                      <span className="rd-rescued-tag" title="Total aggregate attendance lifted above 66.7% via CDC attendance, unlocking waiver eligibility!">
                        🎉 Rescued via CDC Attendance ({curPct.toFixed(1)}%)
                      </span>
                    ) : cdcLimit > 0 ? (
                      <span className="rd-ineligible-tag cdc-exempt" title="Total attendance < 66.7%. Society waivers are barred, but CDC attendance is officially claimable.">
                        Waivers Barred · CDC Claimable
                      </span>
                    ) : (
                      <span className="rd-ineligible-tag" title="Overall attendance is below 66.7%. Official waiver submission is barred by administration.">
                        Ineligible for Submission
                      </span>
                    )
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
              const isOutOfTimeline = Boolean(
                (activeWaiverStart && col.dateStr < activeWaiverStart) ||
                (activeWaiverEnd && col.dateStr > activeWaiverEnd)
              );
              const isAddedDate = col.isCustom || customizationDiff.addedDates.has(col.dateStr);
              const isPriority = priorityDates.has(col.dateStr);
              const btnClass = isWaived ? 'on' : (isCdc ? 'cdc-on' : (isPriority ? 'priority-on' : ''));
              const thClass = `rd-date-th ${isOutOfTimeline ? 'is-pre-society' : ''} ${gridToolMode === 'edit' ? 'is-edit-header' : ''} ${gridToolMode === 'priority' ? 'is-priority-header' : ''} ${isPriority ? 'is-priority-col' : ''}`.trim();
              return (
                <th key={col.dateStr} className={thClass}>
                  <div className="rd-date-th-inner">
                    <button
                      type="button"
                      className={`rd-date-btn ${btnClass}`}
                      aria-pressed={isWaived || isCdc || isPriority}
                      aria-label={`Toggle ${col.fullLabel} (${isWaived ? 'waived' : isCdc ? 'CDC attendance' : isPriority ? 'priority approved date' : 'active'})`}
                      onClick={() => {
                        if (gridToolMode === 'edit') {
                          setDateToDelete({ dateStr: col.dateStr, fullLabel: col.fullLabel });
                        } else {
                          handleToggleDay(col.dateStr);
                        }
                      }}
                      {...(gridToolMode !== 'edit' ? getHoverEvents(col.dateStr) : {})}
                    >
                      <span className="wd">{col.weekday}</span>
                      <span className="dn">{col.dayNum}</span>
                      {isAddedDate ? (
                        <span className="rd-date-added-badge" title="Manually added date">New</span>
                      ) : (isWaived && lockedWaivers.has(col.dateStr)) || (isCdc && lockedCdcDays.has(col.dateStr)) ? (
                        <span className="rd-date-pinned-badge" title="Pinned / locked date">📌</span>
                      ) : isOutOfTimeline ? (
                        <span className="rd-date-locked-badge" title="Outside recommended waiver timeline">🔒</span>
                      ) : isCdc ? (
                        <span className="rd-date-cdc-badge" title="Career Development Centre (CDC) Attendance">CDC</span>
                      ) : isPriority ? (
                        <span className="rd-date-priority-badge" title="Prioritized / approved society date">★</span>
                      ) : null}
                    </button>
                    {gridToolMode === 'edit' && (
                      <button
                        type="button"
                        className="rd-header-del-btn"
                        title={`Delete ${col.fullLabel} from grid`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDateToDelete({ dateStr: col.dateStr, fullLabel: col.fullLabel });
                        }}
                        aria-label={`Delete ${col.fullLabel}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
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
                  const isOutOfTimeline = Boolean(
                    (activeWaiverStart && col.dateStr < activeWaiverStart) ||
                    (activeWaiverEnd && col.dateStr > activeWaiverEnd)
                  );
                  const isCustomCell = customizationDiff.customizedCells.has(`${sub.name}:::${col.dateStr}`);
                  const dayClasses = rawSub?.dayClasses?.[col.dateStr] || [];
                  const cellClass = [
                    isWaived ? 'on' : '',
                    isCdc ? 'cdc-cell' : '',
                    isOutOfTimeline ? 'pre-society-cell' : '',
                    isCustomCell ? 'is-customized' : '',
                    gridToolMode === 'edit' ? 'is-edit-cell' : ''
                  ].filter(Boolean).join(' ');
                  return (
                    <td
                      key={col.dateStr}
                      className={`rd-cell ${cellClass}`}
                      onClick={() => {
                        if (gridToolMode === 'edit') {
                          handleOpenCellEditor(sub.name, col.dateStr);
                        } else {
                          handleToggleDay(col.dateStr);
                        }
                      }}
                      {...(gridToolMode !== 'edit' ? getHoverEvents(col.dateStr) : {})}
                      title={gridToolMode === 'edit' ? `Click to edit classes for ${sub.name} on ${col.label}` : undefined}
                    >
                      {isCustomCell && (
                        <span className="rd-custom-dot" title="Manually customized classes">•</span>
                      )}
                      {gridToolMode === 'edit' && (
                        <span className="rd-cell-edit-affordance" title="Click to edit">✎</span>
                      )}
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
                                  title="Absence converted to Present via Career Development Centre (CDC) Attendance"
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

  const renderTimelineModal = () => {
    if (!isTimelineModalOpen) return null;

    const effectiveStart = tempStartDate !== '' ? tempStartDate : (customStartDate || sheetMinDate);
    const effectiveEnd = tempEndDate !== '' ? tempEndDate : (customEndDate || sheetMaxDate);

    return (
      <div className="rd-timeline-modal-overlay" onClick={() => setIsTimelineModalOpen(false)}>
        <div className="rd-timeline-modal" role="dialog" aria-modal="true" aria-labelledby="rd-timeline-title" onClick={e => e.stopPropagation()}>
          <div className="rd-timeline-modal-head">
            <div className="rd-timeline-modal-title">
              <span className="rd-timeline-modal-icon">📅</span>
              <div>
                <h3 id="rd-timeline-title">Waiver Timeline</h3>
                <p>Choose the dates between which waivers should be recommended.</p>
              </div>
            </div>
            <button
              type="button"
              className="rd-modal-close-btn"
              onClick={() => setIsTimelineModalOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="rd-timeline-modal-body">
            {/* From and To */}
            <div className="rd-timeline-range-inputs">
              <div className="rd-timeline-field">
                <label htmlFor="timeline-from-input">From</label>
                <input
                  type="date"
                  id="timeline-from-input"
                  value={effectiveStart}
                  min={sheetMinDate}
                  max={effectiveEnd}
                  onChange={e => setTempStartDate(e.target.value)}
                />
              </div>
              <span className="rd-timeline-range-arrow">→</span>
              <div className="rd-timeline-field">
                <label htmlFor="timeline-to-input">To</label>
                <input
                  type="date"
                  id="timeline-to-input"
                  value={effectiveEnd}
                  min={effectiveStart}
                  max={sheetMaxDate}
                  onChange={e => setTempEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="rd-timeline-modal-footer">
            <button
              type="button"
              className="rd-btn-outline"
              onClick={() => {
                setTempStartDate(sheetMinDate);
                setTempEndDate(sheetMaxDate);
              }}
              title="Reset timeline to cover full semester"
            >
              Reset to Full Range
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="rd-btn-outline"
              onClick={() => setIsTimelineModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rd-btn-dark"
              onClick={() => {
                const finalStart = (effectiveStart && effectiveStart !== sheetMinDate) ? effectiveStart : '';
                const finalEnd = (effectiveEnd && effectiveEnd !== sheetMaxDate) ? effectiveEnd : '';
                setCustomStartDate(finalStart);
                setCustomEndDate(finalEnd);
                setIsTimelineModalOpen(false);

                if (parsedData) {
                  setIsProcessing(true);
                  const opts = {
                    waiverStartDate: finalStart || null,
                    waiverEndDate: finalEnd || null
                  };
                  executeSolverAsync(parsedData, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
                    if (solution?.chosenDays && (selectedWaivers.size > 0 || selectedCdcDays.size > 0)) {
                      setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
                      setSelectedCdcDays(solution.chosenCdcDays?.length ? new Set(solution.chosenCdcDays.map(d => d.dateStr)) : new Set());
                    }
                  }, opts);
                }
              }}
            >
              Apply Timeline
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render Approved Society Dates (Priority Dates) Modal
  const renderPriorityDatesModal = () => {
    if (!isPriorityDatesModalOpen) return null;

    const filteredCols = (parsedData?.dayColumns || []).filter(col => {
      if (!priorityDateSearch.trim()) return true;
      const q = priorityDateSearch.toLowerCase();
      const cand = candidateDaysMap.get(col.dateStr);
      const subjs = cand ? cand.missedSubjects.join(' ').toLowerCase() : '';
      return (
        col.dateStr.toLowerCase().includes(q) ||
        col.fullLabel.toLowerCase().includes(q) ||
        col.weekday.toLowerCase().includes(q) ||
        subjs.includes(q)
      );
    });

    const candidateDatesWithAbsences = (parsedData?.dayColumns || []).filter(col => {
      const cand = candidateDaysMap.get(col.dateStr);
      return cand && cand.thOrTuAbsences > 0;
    });

    return (
      <div className="rd-timeline-modal-overlay" onClick={() => setIsPriorityDatesModalOpen(false)}>
        <div className="rd-timeline-modal rd-priority-modal" role="dialog" aria-modal="true" aria-labelledby="rd-priority-title" onClick={e => e.stopPropagation()}>
          <div className="rd-timeline-modal-head">
            <div className="rd-timeline-modal-title">
              <span className="rd-timeline-modal-icon" style={{ background: '#fef3c7', color: '#b45309' }}>★</span>
              <div>
                <h3 id="rd-priority-title">Approved Society Dates (Priority Dates)</h3>
                <p>Choose dates where your society sent official approval emails to teachers. Waivers will be prioritized for these dates first.</p>
              </div>
            </div>
            <button
              type="button"
              className="rd-modal-close-btn"
              onClick={() => setIsPriorityDatesModalOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="rd-priority-modal-toolbar">
            <input
              type="text"
              className="rd-priority-search"
              placeholder="Filter by date, weekday, or missed subject..."
              value={priorityDateSearch}
              onChange={e => setPriorityDateSearch(e.target.value)}
            />
            <div className="rd-priority-quick-actions">
              <button
                type="button"
                className="rd-btn-outline sm"
                onClick={() => {
                  const next = new Set(tempPriorityDates);
                  candidateDatesWithAbsences.forEach(c => next.add(c.dateStr));
                  setTempPriorityDates(next);
                }}
                title="Select all dates with theory or tutorial absences"
              >
                Select All Missed Dates ({candidateDatesWithAbsences.length})
              </button>
              <button
                type="button"
                className="rd-btn-outline sm muted"
                onClick={() => setTempPriorityDates(new Set())}
                disabled={tempPriorityDates.size === 0}
              >
                Clear Selection
              </button>
            </div>
          </div>

          <div className="rd-priority-modal-body">
            <div className="rd-priority-date-grid">
              {filteredCols.map(col => {
                const cand = candidateDaysMap.get(col.dateStr);
                const hasAbs = cand && cand.thOrTuAbsences > 0;
                const isSelected = tempPriorityDates.has(col.dateStr);

                return (
                  <div
                    key={col.dateStr}
                    className={`rd-priority-date-card ${isSelected ? 'selected' : ''} ${!hasAbs ? 'no-absences' : ''}`}
                    onClick={() => {
                      setTempPriorityDates(prev => {
                        const next = new Set(prev);
                        if (next.has(col.dateStr)) next.delete(col.dateStr);
                        else next.add(col.dateStr);
                        return next;
                      });
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rd-priority-check"
                    />
                    <div className="rd-priority-card-info">
                      <div className="rd-priority-card-date">
                        <strong>{col.weekday}, {col.dayNum} {MONTH_NAMES[col.month - 1]}</strong>
                        {isSelected && <span className="rd-priority-card-star">★ Prioritized</span>}
                      </div>
                      <div className="rd-priority-card-sub">
                        {hasAbs ? (
                          <span className="rd-priority-abs-count">
                            {cand.totalAbsences} missed ({cand.missedSubjects.slice(0, 2).join(', ')}{cand.missedSubjects.length > 2 ? '…' : ''})
                          </span>
                        ) : (
                          <span className="rd-priority-no-abs">No classes missed (Present)</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rd-timeline-modal-footer">
            <span className="rd-priority-count-badge">
              <strong>{tempPriorityDates.size}</strong> date{tempPriorityDates.size === 1 ? '' : 's'} prioritized
            </span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="rd-btn-outline"
              onClick={() => setIsPriorityDatesModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rd-btn-dark"
              onClick={() => {
                const nextPriorityDates = Array.from(tempPriorityDates);
                setPriorityDates(tempPriorityDates);
                setIsPriorityDatesModalOpen(false);

                if (parsedData) {
                  setIsProcessing(true);
                  const opts = {
                    ...currentSolverOptions,
                    priorityWaiverDates: nextPriorityDates
                  };
                  executeSolverAsync(parsedData, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
                    if (solution?.chosenDays && (selectedWaivers.size > 0 || selectedCdcDays.size > 0)) {
                      setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
                      setSelectedCdcDays(solution.chosenCdcDays?.length ? new Set(solution.chosenCdcDays.map(d => d.dateStr)) : new Set());
                    }
                  }, opts);
                }
              }}
            >
              Save & Recalculate ({tempPriorityDates.size})
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render Cell Class Editor Modal
  const renderCellEditorModal = () => {
    if (!editingCell) return null;
    const { subjectName, dateStr, classes } = editingCell;
    const colInfo = parsedData?.dayColumns?.find(d => d.dateStr === dateStr);
    const dateTitle = colInfo ? colInfo.fullLabel : dateStr;

    return (
      <div className="rd-modal-overlay" onClick={() => setEditingCell(null)}>
        <div className="rd-modal-card rd-cell-editor-card" onClick={e => e.stopPropagation()}>
          <div className="rd-modal-head">
            <div>
              <h3>Edit Attendance</h3>
              <p className="rd-modal-sub">
                <strong>{subjectName}</strong> &bull; {dateTitle}
              </p>
            </div>
            <button
              type="button"
              className="rd-modal-close"
              onClick={() => setEditingCell(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="rd-cell-editor-body">
            {classes.length === 0 ? (
              <div className="rd-cell-editor-empty">
                <p>No classes scheduled for this subject on this date.</p>
                <button
                  type="button"
                  className="rd-btn-outline sm rd-btn-accent"
                  onClick={() => {
                    setEditingCell({
                      ...editingCell,
                      classes: [{ type: 'th', attended: true }]
                    });
                  }}
                >
                  + Add class
                </button>
              </div>
            ) : (
              <div className="rd-classes-list">
                {classes.map((cls, idx) => (
                  <div key={idx} className="rd-class-row">
                    <span className="rd-class-num">Period {idx + 1}</span>

                    <div className="rd-class-select-wrap">
                      <label className="rd-class-lbl">Type</label>
                      <select
                        className="rd-class-select"
                        value={cls.type}
                        onChange={(e) => {
                          const updated = [...classes];
                          updated[idx] = { ...updated[idx], type: e.target.value };
                          setEditingCell({ ...editingCell, classes: updated });
                        }}
                      >
                        <option value="th">Theory (Th)</option>
                        <option value="tu">Tutorial (Tu)</option>
                        <option value="pr">Practical (Pr)</option>
                      </select>
                    </div>

                    <div className="rd-class-select-wrap">
                      <label className="rd-class-lbl">Status</label>
                      <select
                        className={`rd-class-select status ${cls.attended ? 'p' : 'a'}`}
                        value={cls.attended ? 'p' : 'a'}
                        onChange={(e) => {
                          const updated = [...classes];
                          updated[idx] = { ...updated[idx], attended: e.target.value === 'p' };
                          setEditingCell({ ...editingCell, classes: updated });
                        }}
                      >
                        <option value="p">Present (P)</option>
                        <option value="a">Absent (A)</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      className="rd-class-del-btn"
                      title="Remove this class"
                      onClick={() => {
                        const updated = classes.filter((_, i) => i !== idx);
                        setEditingCell({ ...editingCell, classes: updated });
                      }}
                      aria-label="Remove this class"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className="rd-btn-outline xs rd-add-class-btn"
                  onClick={() => {
                    setEditingCell({
                      ...editingCell,
                      classes: [...classes, { type: 'th', attended: true }]
                    });
                  }}
                >
                  + Add another class
                </button>
              </div>
            )}
          </div>

          <div className="rd-modal-actions">
            {classes.length > 0 && (
              <button
                type="button"
                className="rd-btn-outline sm muted"
                onClick={handleClearCellClasses}
                title="Remove all classes for this subject on this date"
              >
                Clear Day
              </button>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="rd-btn-outline sm"
                onClick={() => setEditingCell(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rd-btn-dark sm"
                onClick={handleSaveCellClasses}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Add Date Modal
  const renderAddDateModal = () => {
    if (!isAddDateModalOpen) return null;

    return (
      <div className="rd-modal-overlay" onClick={() => { setIsAddDateModalOpen(false); setNewDateError(''); }}>
        <div className="rd-modal-card" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
          <div className="rd-modal-head">
            <div>
              <h3>Add Date to Grid</h3>
              <p className="rd-modal-sub">Insert an extra date into your attendance schedule</p>
            </div>
            <button
              type="button"
              className="rd-modal-close"
              onClick={() => { setIsAddDateModalOpen(false); setNewDateError(''); }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>
              Select Date:
            </label>
            <input
              type="date"
              className="rd-timeline-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={newDateInput}
              onChange={(e) => {
                setNewDateInput(e.target.value);
                setNewDateError('');
              }}
            />
            {newDateError && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--red)', fontWeight: 600 }}>
                {newDateError}
              </div>
            )}
            <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--ink-dim)', lineHeight: 1.4 }}>
              The date will be automatically inserted into the grid in chronological order. You can then click cells in this new date column to add theory, tutorial, or practical classes.
            </p>
          </div>

          <div className="rd-modal-actions">
            <button
              type="button"
              className="rd-btn-outline sm"
              onClick={() => { setIsAddDateModalOpen(false); setNewDateError(''); }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rd-btn-dark sm"
              onClick={handleAddDate}
            >
              Add Date
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render Confirm Delete Date Modal
  const renderConfirmDeleteDateModal = () => {
    if (!dateToDelete) return null;

    const isWaived = selectedWaivers.has(dateToDelete.dateStr);
    const isCdc = selectedCdcDays.has(dateToDelete.dateStr);

    return (
      <div className="rd-modal-overlay" onClick={() => setDateToDelete(null)}>
        <div className="rd-modal-card" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
          <div className="rd-modal-head">
            <div>
              <h3>Delete Date</h3>
              <p className="rd-modal-sub">Remove entire date from grid</p>
            </div>
            <button
              type="button"
              className="rd-modal-close"
              onClick={() => setDateToDelete(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: 1.5, margin: 0 }}>
              Are you sure you want to delete <strong>{dateToDelete.fullLabel}</strong> ({dateToDelete.dateStr})?
            </p>
            <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--ink-dim)', lineHeight: 1.4 }}>
              This will remove all recorded classes for this date across all subjects and automatically recalculate all attendance percentages and solver recommendations.
            </p>
            {(isWaived || isCdc) && (
              <div style={{ marginTop: '10px', padding: '8px 12px', background: '#fee2e2', borderRadius: '8px', color: '#b91c1c', fontSize: '12px', fontWeight: 600 }}>
                ⚠️ This date is currently active as a {isWaived ? 'Waived day' : 'CDC Attendance day'} and will be unselected.
              </div>
            )}
          </div>

          <div className="rd-modal-actions">
            <button
              type="button"
              className="rd-btn-outline sm"
              onClick={() => setDateToDelete(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rd-btn-dark sm"
              style={{ background: '#dc2626', borderColor: '#b91c1c', color: '#fff' }}
              onClick={handleConfirmDeleteDate}
            >
              Delete Date
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render Confirm Reset to Raw Modal
  const renderConfirmResetModal = () => {
    if (!isResetConfirmOpen) return null;

    return (
      <div className="rd-modal-overlay" onClick={() => setIsResetConfirmOpen(false)}>
        <div className="rd-modal-card" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
          <div className="rd-modal-head">
            <div>
              <h3>Reset Attendance</h3>
              <p className="rd-modal-sub">Revert to original file</p>
            </div>
            <button
              type="button"
              className="rd-modal-close"
              onClick={() => setIsResetConfirmOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: 1.5, margin: 0 }}>
              Reset all attendance customizations back to the original uploaded Excel file?
            </p>
            <p style={{ marginTop: '10px', fontSize: '12px', color: 'var(--ink-dim)', lineHeight: 1.4 }}>
              All manually added, edited, or deleted classes ({customizationDiff.totalChanges} change{customizationDiff.totalChanges === 1 ? '' : 's'}) will be undone and your attendance will match the exact raw file baseline.
            </p>
          </div>

          <div className="rd-modal-actions">
            <button
              type="button"
              className="rd-btn-outline sm"
              onClick={() => setIsResetConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rd-btn-dark sm"
              style={{ background: '#dc2626', borderColor: '#b91c1c', color: '#fff' }}
              onClick={handleResetToRaw}
            >
              Reset to Original
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render One-Third (1/3rd) Rule Double-Check Alert Modal
  const renderOneThirdAlertModal = () => {
    if (!showOneThirdAlert || violatingPartsForModal.length === 0) return null;

    return (
      <div className="rd-modal-overlay" onClick={() => setIsOneThirdAlertDismissed(true)}>
        <div
          className="rd-modal-card rd-one-third-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rd-one-third-modal-title"
          onClick={e => e.stopPropagation()}
        >
          <div className="rd-modal-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="rd-one-third-modal-icon">⚠️</span>
              <div>
                <h3 id="rd-one-third-modal-title">Double-Check: 1/3rd Rule</h3>
                <p className="rd-modal-sub">College waiver limit alert</p>
              </div>
            </div>
            <button
              type="button"
              className="rd-modal-close"
              onClick={() => setIsOneThirdAlertDismissed(true)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="rd-one-third-modal-body">
            <p className="rd-one-third-modal-intro">
              Some of your waivers are going over the one-third rule. In the following subject component{violatingPartsForModal.length === 1 ? '' : 's'}, over one-third of classes are being waived off:
            </p>

            <ul className="rd-one-third-modal-list">
              {violatingPartsForModal.map((part, idx) => (
                <li key={idx} className="rd-one-third-modal-item">
                  <div className="rd-one-third-modal-item-head">
                    <strong className="rd-one-third-modal-subj">{part.subjectName}</strong>
                    <span className="rd-one-third-modal-badge">
                      {part.type === 'tu' ? 'Tutorial' : part.type === 'pr' ? 'Practical' : 'Theory'}
                    </span>
                  </div>
                  <div className="rd-one-third-modal-item-stats">
                    <span>
                      Waiving <strong>{part.waivedClasses}</strong> of <strong>{part.baseHeld}</strong> classes ({Math.round(part.waivedPct)}%)
                    </span>
                    <span className="rd-one-third-modal-max">
                      Recommended max: {part.maxAllowedOneThird} {part.maxAllowedOneThird === 1 ? 'class' : 'classes'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="rd-one-third-modal-guideline">
              <span className="rd-one-third-modal-info-icon">ℹ️</span>
              <p>
                DU attendance rules generally specify that students should not eliminate more than one-third of their total classes in any individual subject component. <strong>Just double-check with the one-third rule</strong> before submitting your waiver application.
              </p>
            </div>
          </div>

          <div className="rd-modal-actions">
            <button
              type="button"
              className="rd-btn-dark sm rd-one-third-modal-confirm-btn"
              onClick={() => setIsOneThirdAlertDismissed(true)}
            >
              Got it, thanks
            </button>
          </div>
        </div>
      </div>
    );
  };

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

      {/* Debarment Ineligibility Modal (First-look Warning when Baseline Overall Attendance < 66.7%) */}
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
              {solverResult?.cdcRescue?.cdcRescued
                ? 'CDC Attendance Rescues Eligibility!'
                : 'Not Eligible for College Society Waivers'}
            </h2>

            <div className="rd-ineligible-metric-card">
              <div className="rd-ineligible-metric-left">
                <span className="rd-ineligible-metric-lbl">Total Baseline Attendance</span>
                <div className="rd-ineligible-metric-val">
                  <span className="rd-ineligible-pct">{totalsSummary.overall.basePct.toFixed(1)}%</span>
                  <span className="rd-ineligible-fraction">({totalsSummary.overall.att} / {totalsSummary.overall.held} classes)</span>
                </div>
              </div>
              <span className={`rd-ineligible-status-tag ${solverResult?.cdcRescue?.cdcRescued ? 'rescued' : ''}`}>
                {solverResult?.cdcRescue?.cdcRescued ? 'Rescued via CDC Attendance' : 'Below 66.7% Requirement'}
              </span>
            </div>

            <div className="rd-ineligible-body">
              {solverResult?.cdcRescue?.cdcRescued ? (
                <div className="rd-cdc-rescue-box">
                  <div className="rd-cdc-rescue-header">
                    <span className="rd-cdc-rescue-icon">🎉</span>
                    <div>
                      <strong>CDC Attendance Lifts You Above 66.7%!</strong>
                      <p>
                        While DU Ordinance VII bars society waivers below 66.7%, <strong>Career Development Centre (CDC) attendance is an official placement cell award and is completely exempt from this rule</strong>.
                      </p>
                    </div>
                  </div>
                  <div className="rd-cdc-rescue-stats">
                    Applying your <strong>{solverResult.chosenCdcDays?.length || cdcLimit} CDC attendance date(s)</strong> converts <strong>{solverResult.cdcRescue.cdcTotalConvertedAbsences} absence(s) into presents</strong>, raising your total aggregate attendance to <strong>{solverResult.cdcRescue.projectedOverallPctWithCdc.toFixed(1)}% (&ge; 66.7%)</strong>. This officially restores your eligibility to claim society waivers!
                  </div>
                </div>
              ) : cdcLimit > 0 ? (
                <>
                  <div className="rd-cdc-exemption-box">
                    <span className="rd-sandbox-title">📋 CDC Attendance is Officially Claimable</span>
                    <p>
                      University of Delhi Ordinance VII bars society waivers when aggregate attendance is below 66.7%. However, <strong>Career Development Centre (CDC) attendance is an official placement cell award and CAN be claimed regardless of your attendance percentage</strong>.
                    </p>
                  </div>
                  <div className="rd-ineligible-sandbox-box">
                    <span className="rd-sandbox-title">🧪 Simulation & Sandbox Mode Active</span>
                    <p>
                      You can claim your CDC attendance dates below and simulate waivers to see how many future classes you need to attend to escape debarment.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    According to University of Delhi Ordinance VII and SSCBS examination rules, students with an <strong>overall aggregate attendance below 66.7%</strong> across all subjects combined are <strong>strictly not eligible to apply for society waivers</strong> to the college administration.
                  </p>
                  <div className="rd-ineligible-rule-note">
                    <strong>Clarification:</strong> Students who maintain <strong>&ge; 66.7% overall attendance</strong> can still apply waivers for specific individual subjects below 66.7%. However, when your combined total across all subjects is under 66.7%, the administration cannot accept society waivers.
                  </div>
                  <div className="rd-ineligible-cdc-tip">
                    💡 <strong>Have CDC attendance?</strong> Enter your CDC attendance dates in the toolbar to see if they lift your total attendance above 66.7% and unlock waiver eligibility.
                  </div>
                  <div className="rd-ineligible-sandbox-box">
                    <span className="rd-sandbox-title">🧪 Simulation & Sandbox Mode Active</span>
                    <p>
                      Even though official submission is not permitted, <strong>you can still freely use this tool</strong> to test waiver dates, simulate attendance outcomes, and check exactly how many classes you must attend to escape debarment.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="rd-ineligible-footer">
              {solverResult?.cdcRescue?.cdcRescued ? (
                <button
                  type="button"
                  className="rd-ineligible-ack-btn rescue"
                  onClick={() => {
                    setHasAcknowledgedIneligible(true);
                    handleApplyRecommended();
                  }}
                >
                  Apply Recommended Plan & Unlock Waivers ({solverResult.chosenDays?.length || 0} Waivers + {solverResult.chosenCdcDays?.length || 0} CDC) →
                </button>
              ) : cdcLimit > 0 ? (
                <button
                  type="button"
                  className="rd-ineligible-ack-btn"
                  onClick={() => {
                    setHasAcknowledgedIneligible(true);
                    if (solverResult?.chosenCdcDays?.length > 0) {
                      setSelectedCdcDays(new Set(solverResult.chosenCdcDays.map(d => d.dateStr)));
                    }
                  }}
                >
                  Apply CDC Attendance & Explore Sandbox →
                </button>
              ) : (
                <button
                  type="button"
                  className="rd-ineligible-ack-btn"
                  onClick={() => setHasAcknowledgedIneligible(true)}
                >
                  I Understand — Let Me Experiment →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Day Diff Popover */}
      {hoverDiff && (
        <div className="rd-popover" style={{ left: `${popoverPos.x}px`, top: `${popoverPos.y}px` }}>
          <div className="rd-pop-head">
            <div>
              <strong>{hoverDiff.day?.fullLabel || hoverDiff.dateStr}</strong>
              {Boolean(lockedWaivers.has(hoverDiff.dateStr) || lockedCdcDays.has(hoverDiff.dateStr)) && (
                <span className="rd-pop-pinned-tag" title="Pinned date (kept when auto-filling)">
                  📌 Fixed
                </span>
              )}
              {Boolean((activeWaiverStart && hoverDiff.dateStr < activeWaiverStart) || (activeWaiverEnd && hoverDiff.dateStr > activeWaiverEnd)) && (
                <span className="rd-pop-presociety-tag" title="Outside recommended waiver timeline">
                  🔒 Out of timeline
                </span>
              )}
            </div>
            <span
              className={`rd-pop-tag ${
                hoverDiff.mode === 'cdc'
                  ? (hoverDiff.isCurrentlyCdc ? 'rm' : 'cdc')
                  : (hoverDiff.isCurrentlyWaived ? 'rm' : 'add')
              }`}
            >
              {hoverDiff.mode === 'cdc'
                ? (hoverDiff.isCurrentlyCdc ? 'Click to remove CDC attendance' : 'Click to claim CDC attendance')
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
              <span className="lbl">Waivers</span>
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

            {/* Career Development Centre (CDC) Attendance Stepper */}
            <div className={`rd-stat ${cdcLimit > 0 ? 'cdc-stat' : ''}`}>
              <span className="lbl" title="Career Development Centre (CDC) Attendance">CDC Attendance</span>
              <div className="row">
                <span className="num">
                  {selectedCdcDays.size}
                  <span className="of">/{cdcLimit}</span>
                </span>
                <span className="unit">dates</span>
                <span className="rd-steps">
                  <button type="button" aria-label="Lower CDC attendance limit" onClick={() => handleCdcLimitChange(cdcLimit - 1)}>−</button>
                  <button type="button" aria-label="Raise CDC attendance limit" onClick={() => handleCdcLimitChange(cdcLimit + 1)}>+</button>
                </span>
              </div>
            </div>

            {/* Timeline for Recommended Waivers Stat */}
            <div
              className="rd-stat timeline-stat"
              onClick={() => {
                setTempStartDate(activeWaiverStart || sheetMinDate);
                setTempEndDate(activeWaiverEnd || sheetMaxDate);
                setIsTimelineModalOpen(true);
              }}
              title="Click to edit recommended waiver timeline"
            >
              <span className="lbl" title="Recommended waiver timeline">Timeline</span>
              <div className="row timeline-stat-row">
                <span className="timeline-stat-dates">
                  {formatTimelineDisplay(activeWaiverStart, activeWaiverEnd, sheetMinDate, sheetMaxDate)}
                </span>
                <button
                  type="button"
                  className="rd-timeline-edit-btn"
                  title="Edit timeline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTempStartDate(activeWaiverStart || sheetMinDate);
                    setTempEndDate(activeWaiverEnd || sheetMaxDate);
                    setIsTimelineModalOpen(true);
                  }}
                >
                  ✎
                </button>
              </div>
            </div>

            {/* Priority Dates for Approved Society Emails Stat */}
            <div
              className={`rd-stat priority-stat ${priorityDates.size > 0 ? 'active' : ''}`}
              onClick={() => {
                setTempPriorityDates(new Set(priorityDates));
                setPriorityDateSearch('');
                setIsPriorityDatesModalOpen(true);
              }}
              title="Click to view or edit prioritized approved society dates"
            >
              <span className="lbl" title="Dates prioritized for official society email approvals">
                Priority Dates
              </span>
              <div className="row timeline-stat-row">
                <span className="timeline-stat-dates">
                  {priorityDates.size === 0 ? 'None' : `${priorityDates.size} date${priorityDates.size > 1 ? 's' : ''} ★`}
                </span>
                <button
                  type="button"
                  className="rd-timeline-edit-btn"
                  title="Edit priority dates"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTempPriorityDates(new Set(priorityDates));
                    setPriorityDateSearch('');
                    setIsPriorityDatesModalOpen(true);
                  }}
                >
                  ✎
                </button>
              </div>
            </div>

            {/* Status Banner */}
            <div className={`rd-status ${simStats?.allPassing ? 'ok' : ((simStats?.debarSafeTargetCount ?? 0) < totalTargetParts ? 'bad' : 'warn')}`}>
              <div className="rd-status-icon-wrap">
                {simStats?.allPassing ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="8 12.5 11 15.5 16 9.5" />
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12" y2="17" />
                  </svg>
                )}
              </div>
              <div className="rd-status-info">
                <strong>{passingTargetCount} of {totalTargetParts} parts meet {threshold}%</strong>
                <span className="rd-status-sub">
                  {selectedWaivers.size === 0 && selectedCdcDays.size === 0
                    ? 'Baseline (0 applied)'
                    : `${selectedWaivers.size} waiver${selectedWaivers.size === 1 ? '' : 's'}${cdcLimit > 0 ? `, ${selectedCdcDays.size} CDC` : ''} applied`}
                  {starredSubjects.size > 0 && (
                    <span className="rd-status-priority-tag" title={`Prioritizing ${starredSubjects.size} starred subject${starredSubjects.size === 1 ? '' : 's'}`}>
                      ★ {starredSubjects.size} Priority
                    </span>
                  )}
                </span>
              </div>
              {selectedWaivers.size === 0 && selectedCdcDays.size === 0 && (solverResult?.chosenDays?.length > 0 || solverResult?.chosenCdcDays?.length > 0) && (
                <button type="button" className="rd-btn-outline sm rd-btn-accent rd-status-cta" onClick={handleApplyRecommended}>
                  Apply recommended
                </button>
              )}
              {hasPendingPriorityChange && (
                <button
                  type="button"
                  className="rd-btn-outline sm rd-btn-priority-recalc rd-status-cta"
                  onClick={handleRecalculateWithPriorities}
                  title="Recalculate and apply optimal waivers with updated starred priorities"
                >
                  ★ Recalculate with priorities
                </button>
              )}
              {canFillRemaining && (
                <button
                  type="button"
                  className="rd-btn-outline sm rd-status-cta rd-btn-fill-remaining"
                  onClick={handleFillRemainingWaivers}
                  title={`Keep current ${selectedWaivers.size} selected dates and solve for remaining ${remainingWaiversCount} waivers`}
                >
                  💡 Fill remaining ({remainingWaiversCount})
                </button>
              )}
              {hasParamsChanged && (selectedWaivers.size > 0 || selectedCdcDays.size > 0) && (
                <button type="button" className="rd-btn-outline sm rd-status-cta" onClick={handleApplyRecommended}>
                  Update
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
                  executeSolverAsync(parsedData, threshold, newLimit, cdcLimit, starredSubjects, (newSol) => {
                    if (newSol?.chosenDays?.length > 0) {
                      setSelectedWaivers(new Set(newSol.chosenDays.map(d => d.dateStr)));
                    }
                  }, currentSolverOptions);
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
                    <div className="rd-tool-toggle" role="group" aria-label="Grid Click Action Mode">
                      <button
                        type="button"
                        className={`rd-tool-btn ${gridToolMode === 'waiver' ? 'active' : ''}`}
                        onClick={() => setGridToolMode('waiver')}
                      >
                        Waivers
                      </button>
                      {cdcLimit > 0 && (
                        <button
                          type="button"
                          className={`rd-tool-btn cdc ${gridToolMode === 'cdc' ? 'active' : ''}`}
                          onClick={() => setGridToolMode('cdc')}
                        >
                          CDC Attendance ({selectedCdcDays.size}/{cdcLimit})
                        </button>
                      )}
                      <button
                        type="button"
                        className={`rd-tool-btn priority ${gridToolMode === 'priority' ? 'active' : ''}`}
                        onClick={() => setGridToolMode(gridToolMode === 'priority' ? 'waiver' : 'priority')}
                        title="Click column headers to toggle approved society priority dates"
                      >
                        ★ Priority Dates ({priorityDates.size})
                      </button>
                      <button
                        type="button"
                        className={`rd-tool-btn edit ${gridToolMode === 'edit' ? 'active' : ''}`}
                        onClick={() => setGridToolMode(gridToolMode === 'edit' ? 'waiver' : 'edit')}
                        title="Manually edit, add, or delete classes and dates"
                      >
                        ✎ Edit Attendance {customizationDiff.totalChanges > 0 ? `(${customizationDiff.totalChanges})` : ''}
                      </button>
                    </div>
                    {selectedWaivers.size === 0 && selectedCdcDays.size === 0 && (solverResult?.chosenDays?.length > 0 || solverResult?.chosenCdcDays?.length > 0) && (
                      <button
                        type="button"
                        className="rd-btn-outline sm rd-btn-accent"
                        onClick={handleApplyRecommended}
                        title="Apply recommended attendance dates"
                      >
                        Apply recommended
                      </button>
                    )}
                    {hasPendingPriorityChange && (
                      <button
                        type="button"
                        className="rd-btn-outline sm rd-btn-priority-recalc"
                        onClick={handleRecalculateWithPriorities}
                        title="Recalculate and apply optimal waivers with updated starred priorities"
                      >
                        ★ Recalculate with priorities
                      </button>
                    )}
                    {canFillRemaining && (
                      <button
                        type="button"
                        className="rd-btn-outline sm rd-btn-fill-remaining"
                        onClick={handleFillRemainingWaivers}
                        title={`Keep current ${selectedWaivers.size} selected dates and solve for remaining ${remainingWaiversCount} waivers`}
                      >
                        💡 Fill remaining ({remainingWaiversCount})
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
                {gridToolMode === 'edit' && (
                  <div className="rd-edit-banner">
                    <span className="rd-edit-banner-text">
                      ✏️ <strong>Edit Mode:</strong> Click any cell to add/modify classes. Click ✕ on date headers to delete a day.
                    </span>
                    <div className="rd-edit-banner-acts">
                      <button
                        type="button"
                        className="rd-btn-outline xs rd-btn-accent"
                        onClick={() => { setIsAddDateModalOpen(true); setNewDateError(''); setNewDateInput(''); }}
                      >
                        + Add Date
                      </button>
                      {customizationDiff.hasCustomizations && (
                        <button
                          type="button"
                          className="rd-btn-outline xs muted"
                          onClick={() => setIsResetConfirmOpen(true)}
                          title="Revert all manual edits back to the original uploaded Excel sheet"
                        >
                          ↺ Reset to Original ({customizationDiff.totalChanges})
                        </button>
                      )}
                    </div>
                  </div>
                )}
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
                        <i />CDC Attendance
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
                    <span className="rd-count">
                      {selectedWaivers.size} of {maxWaivers}
                      {cdcLimit > 0 && ` · ${selectedCdcDays.size} of ${cdcLimit} CDC`}
                    </span>
                  </div>
                  <div className="acts">
                    {copyFeedback && <span className="rd-copied">{copyFeedback}</span>}
                    {selectedWaivers.size === 0 && selectedCdcDays.size === 0 && (solverResult?.chosenDays?.length > 0 || solverResult?.chosenCdcDays?.length > 0) && (
                      <button
                        type="button"
                        className="rd-btn-outline sm rd-btn-accent"
                        onClick={handleApplyRecommended}
                      >
                        Apply recommended
                      </button>
                    )}
                    {hasPendingPriorityChange && (
                      <button
                        type="button"
                        className="rd-btn-outline sm rd-btn-priority-recalc"
                        onClick={handleRecalculateWithPriorities}
                        title="Recalculate and apply optimal waivers with updated starred priorities"
                      >
                        ★ Recalculate with priorities
                      </button>
                    )}
                    {canFillRemaining && (
                      <button
                        type="button"
                        className="rd-btn-outline sm rd-btn-sidebar-fill"
                        onClick={handleFillRemainingWaivers}
                        title={`Keep current ${selectedWaivers.size} selected dates and solve for remaining ${remainingWaiversCount} waivers`}
                      >
                        💡 Fill remaining ({remainingWaiversCount})
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
                      disabled={selectedWaivers.size === 0 && selectedCdcDays.size === 0}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {selectedDaysList.length === 0 ? (
                  <div className="rd-empty">
                    <p>No dates applied yet. Viewing raw attendance.</p>
                    {(solverResult?.chosenDays?.length > 0 || solverResult?.chosenCdcDays?.length > 0) && (
                      <button type="button" className="rd-btn-dark" onClick={handleApplyRecommended}>
                        Apply recommended dates ({solverResult.chosenDays?.length || 0} waivers{solverResult.chosenCdcDays?.length ? ` + ${solverResult.chosenCdcDays.length} CDC` : ''})
                      </button>
                    )}
                  </div>
                ) : (
                  <ul className="rd-date-list">
                    {selectedDaysList.map(item => (
                      <li key={item.dateStr} className={item.isLocked ? 'is-locked-day' : ''}>
                        <div className={`cal ${item.kind === 'cdc' ? 'cdc' : ''}`}>
                          <b>{item.dayNum}</b>
                          <span>{item.monthShort}</span>
                        </div>
                        <div className="txt">
                          <span className="l1">
                            {item.weekday} <em>· {item.totalMissed} {item.kind === 'cdc' ? 'converted' : 'missed'}</em>
                            {item.isLocked && <span className="rd-date-pinned-badge" title="Manually fixed/pinned date">📌 Fixed</span>}
                            {item.isPriority && <span className="rd-date-priority-badge" title="Prioritized / approved society date">★ Approved Date</span>}
                            {item.kind === 'cdc' && <span className="cdc-tag">CDC</span>}
                          </span>
                          <span className="l2">
                            {item.missedSubjects.length ? item.missedSubjects.join(', ') : 'No absences recorded'}
                          </span>
                        </div>
                        <div className="rd-date-item-actions">
                          <button
                            type="button"
                            className={`rd-pin-btn ${item.isLocked ? 'pinned' : ''}`}
                            onClick={() => handleToggleLockDate(item.dateStr, item.kind)}
                            title={item.isLocked ? 'Pinned / locked (click to unlock)' : 'Click to pin / lock this date'}
                            aria-label={item.isLocked ? `Unlock ${item.dayNum} ${item.monthShort}` : `Lock ${item.dayNum} ${item.monthShort}`}
                          >
                            📌
                          </button>
                          <button
                            type="button"
                            className="rd-date-del-btn"
                            aria-label={`Remove ${item.dayNum} ${item.monthShort}`}
                            onClick={() => handleRemoveDate(item)}
                          >
                            ×
                          </button>
                        </div>
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

            {/* Waiver Timeline */}
            <div className="upload-timeline-box">
              <span className="upload-timeline-label">WAIVER TIMELINE</span>

              <div className="upload-timeline-inputs-row">
                <div className="upload-timeline-field">
                  <label htmlFor="upload-custom-from">From</label>
                  <input
                    type="date"
                    id="upload-custom-from"
                    value={customStartDate || ''}
                    onChange={e => setCustomStartDate(e.target.value)}
                  />
                </div>
                <span className="upload-timeline-arrow">→</span>
                <div className="upload-timeline-field">
                  <label htmlFor="upload-custom-to">To</label>
                  <input
                    type="date"
                    id="upload-custom-to"
                    value={customEndDate || ''}
                    onChange={e => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="upload-params-row upload-params-row-4">
              {/* Target Parameter */}
              <div className="param-input-box">
                <span className="param-label">TARGET</span>
                <div className="param-stepper-wrap">
                  <div className="param-val-group">
                    <span className="param-number">{threshold}</span>
                    <span className="param-unit">%</span>
                  </div>
                  <div className="param-stepper-arrows">
                    <button type="button" className="arrow-btn" onClick={() => setThreshold(e => Math.min(99, e + 1))} aria-label="Increase target">▲</button>
                    <button type="button" className="arrow-btn" onClick={() => setThreshold(e => Math.max(50, e - 1))} aria-label="Decrease target">▼</button>
                  </div>
                </div>
              </div>

              {/* Waiver Limit Parameter */}
              <div className="param-input-box">
                <span className="param-label">WAIVER LIMIT</span>
                <div className="param-stepper-wrap">
                  <div className="param-val-group">
                    <span className="param-number">{maxWaivers}</span>
                    <span className="param-unit">dates</span>
                  </div>
                  <div className="param-stepper-arrows">
                    <button type="button" className="arrow-btn" onClick={() => setMaxWaivers(e => e + 1)} aria-label="Increase waiver limit">▲</button>
                    <button type="button" className="arrow-btn" onClick={() => setMaxWaivers(e => Math.max(0, e - 1))} aria-label="Decrease waiver limit">▼</button>
                  </div>
                </div>
              </div>

              {/* Semester Starts Parameter */}
              <div className="param-input-box param-month-box">
                <span className="param-label">SEMESTER START</span>
                <div className="param-stepper-wrap">
                  <div className="param-val-group param-month-display" title="Click to choose month">
                    <span className="param-number param-month-text">{MONTHS_FULL[startingMonth]}</span>
                    <select
                      className="param-month-native-select"
                      value={startingMonth}
                      onChange={(e) => setStartingMonth(parseInt(e.target.value, 10))}
                      title="Choose semester start month"
                      aria-label="Semester start month"
                    >
                      {MONTHS_FULL.map((m, idx) => (
                        <option key={m} value={idx}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="param-stepper-arrows">
                    <button
                      type="button"
                      className="arrow-btn"
                      title="Next month"
                      aria-label="Next month"
                      onClick={() => setStartingMonth(m => (m + 1) % 12)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="arrow-btn"
                      title="Previous month"
                      aria-label="Previous month"
                      onClick={() => setStartingMonth(m => (m - 1 + 12) % 12)}
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </div>

              {/* CDC Attendance Parameter */}
              <div className="param-input-box">
                <span className="param-label">CDC ATTENDANCE</span>
                <div className="param-stepper-wrap">
                  <div className="param-val-group">
                    <span className="param-number">{cdcLimit}</span>
                    <span className="param-unit">dates</span>
                  </div>
                  <div className="param-stepper-arrows">
                    <button type="button" className="arrow-btn" onClick={() => setCdcLimit(e => e + 1)} aria-label="Increase CDC dates">▲</button>
                    <button type="button" className="arrow-btn" onClick={() => setCdcLimit(e => Math.max(0, e - 1))} aria-label="Decrease CDC dates">▼</button>
                  </div>
                </div>
              </div>
            </div>

            <p className="upload-params-caption">
              Waivers will only be recommended between the chosen From and To dates. Career Development Centre (CDC) attendance allows converting absences into presents across all months. Leave 0 if not applicable. You can adjust all parameters later.
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
                <div className="rd-tool-toggle" role="group" aria-label="Expanded Grid Action Mode">
                  <button
                    type="button"
                    className={`rd-tool-btn ${gridToolMode === 'waiver' ? 'active' : ''}`}
                    onClick={() => setGridToolMode('waiver')}
                  >
                    Waivers ({selectedWaivers.size}/{maxWaivers})
                  </button>
                  {cdcLimit > 0 && (
                    <button
                      type="button"
                      className={`rd-tool-btn cdc ${gridToolMode === 'cdc' ? 'active' : ''}`}
                      onClick={() => setGridToolMode('cdc')}
                    >
                      CDC Attendance ({selectedCdcDays.size}/{cdcLimit})
                    </button>
                  )}
                  <button
                    type="button"
                    className={`rd-tool-btn priority ${gridToolMode === 'priority' ? 'active' : ''}`}
                    onClick={() => setGridToolMode(gridToolMode === 'priority' ? 'waiver' : 'priority')}
                    title="Click column headers to toggle approved society priority dates"
                  >
                    ★ Priority Dates ({priorityDates.size})
                  </button>
                  <button
                    type="button"
                    className={`rd-tool-btn edit ${gridToolMode === 'edit' ? 'active' : ''}`}
                    onClick={() => setGridToolMode(gridToolMode === 'edit' ? 'waiver' : 'edit')}
                    title="Manually edit, add, or delete classes and dates"
                  >
                    ✎ Edit Attendance {customizationDiff.totalChanges > 0 ? `(${customizationDiff.totalChanges})` : ''}
                  </button>
                </div>
                {selectedWaivers.size === 0 && selectedCdcDays.size === 0 && (solverResult?.chosenDays?.length > 0 || solverResult?.chosenCdcDays?.length > 0) && (
                  <button
                    type="button"
                    className="rd-btn-outline sm rd-btn-accent"
                    onClick={handleApplyRecommended}
                  >
                    Apply recommended
                  </button>
                )}
                {hasPendingPriorityChange && (
                  <button
                    type="button"
                    className="rd-btn-outline sm rd-btn-priority-recalc"
                    onClick={handleRecalculateWithPriorities}
                    title="Recalculate and apply optimal waivers with updated starred priorities"
                  >
                    ★ Recalculate with priorities
                  </button>
                )}
                {canFillRemaining && (
                  <button
                    type="button"
                    className="rd-btn-outline sm rd-btn-fill-remaining"
                    onClick={handleFillRemainingWaivers}
                    title={`Keep current ${selectedWaivers.size} selected dates and solve for remaining ${remainingWaiversCount} waivers`}
                  >
                    💡 Fill remaining ({remainingWaiversCount})
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

            {gridToolMode === 'edit' && (
              <div className="rd-edit-banner exp">
                <span className="rd-edit-banner-text">
                  ✏️ <strong>Edit Mode:</strong> Click any cell to add/modify classes. Click ✕ on date headers to delete a day.
                </span>
                <div className="rd-edit-banner-acts">
                  <button
                    type="button"
                    className="rd-btn-outline xs rd-btn-accent"
                    onClick={() => { setIsAddDateModalOpen(true); setNewDateError(''); setNewDateInput(''); }}
                  >
                    + Add Date
                  </button>
                  {customizationDiff.hasCustomizations && (
                    <button
                      type="button"
                      className="rd-btn-outline xs muted"
                      onClick={() => setIsResetConfirmOpen(true)}
                      title="Revert all manual edits back to the original uploaded Excel sheet"
                    >
                      ↺ Reset to Original ({customizationDiff.totalChanges})
                    </button>
                  )}
                </div>
              </div>
            )}

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
                    <i /> CDC Attendance day (absence marked present)
                  </span>
                )}
              </div>
              <span>Frozen Theory & Tutorial columns show real-time percentage shifts</span>
            </div>
          </section>
        </div>
      )}

      {/* Custom Timeline Modal Overlay */}
      {renderTimelineModal()}

      {/* Approved Society Priority Dates Modal Overlay */}
      {renderPriorityDatesModal()}

      {/* Manual Attendance Customization Modals */}
      {renderCellEditorModal()}
      {renderAddDateModal()}
      {renderConfirmDeleteDateModal()}
      {renderConfirmResetModal()}

      {/* One-Third (1/3rd) Rule Double-Check Modal */}
      {renderOneThirdAlertModal()}
    </div>
  );
}
