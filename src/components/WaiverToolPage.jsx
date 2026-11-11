import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { canAccessWaiver } from '../lib/admin';
import { PercentIcon } from './icons';
import { trackWaiverEvent } from '../lib/analytics';
import { parseAttendanceFile, WEEKDAYS, MONTH_NAMES, MONTHS_FULL } from '../lib/waiverParser';
import {
  cloneParsedData,
  editCellClasses,
  deleteDateColumn,
  diffCustomizations,
  findRecentDaySchedule,
  batchAddDates,
  clearFutureDates
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
import {
  calculateComponentMarks,
  calculateSubjectMarks,
  calculateAggregateMarks,
  inferDefaultMaxMarks,
  CREDIT_OPTIONS,
  getSubjectCreditOptions
} from '../lib/marksEngine';
import {
  compileAttendanceChangelog,
  countTotalAuditChanges
} from '../lib/attendanceAuditLogger';
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

function getSubjAbbreviation(name) {
  if (!name) return '';
  const clean = name.replace(/\b(BMS|BBA|FIA|DU|CBCS|LOCF|UGCF)\b/gi, '').trim();
  if (/creativity/i.test(clean)) return 'C&I';
  if (/macro/i.test(clean)) return 'Macro';
  if (/hindi/i.test(clean)) return 'Hindi';
  if (/organi[sz]ational/i.test(clean)) return 'OB';
  if (/business analytics/i.test(clean)) return 'IBA';
  if (/intelligence/i.test(clean)) return 'BI';
  const words = clean.split(/\s+/).filter(w => !['and', '&', 'to', 'for', 'of', 'in', 'the'].includes(w.toLowerCase()));
  if (words.length >= 2) {
    return words.slice(0, 3).map(w => w[0].toUpperCase()).join('');
  }
  return clean.substring(0, 5);
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
  const [addDateMode, setAddDateMode] = useState('single'); // 'single' | 'range'
  const [newDateInput, setNewDateInput] = useState('');
  const [newEndDateInput, setNewEndDateInput] = useState('');
  const [timetableTemplateMode, setTimetableTemplateMode] = useState('copy_weekday'); // 'copy_weekday' | 'blank'
  const [timetableDefaultStatus, setTimetableDefaultStatus] = useState('p'); // 'p' | 'a' | 'as_is'
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

  // Blacklisted Dates (dates blocked from receiving waivers e.g. unapproved bunks)
  const [blacklistedDates, setBlacklistedDates] = useState(new Set());
  const [isBlacklistedDatesModalOpen, setIsBlacklistedDatesModalOpen] = useState(false);
  const [tempBlacklistedDates, setTempBlacklistedDates] = useState(new Set());
  const [blacklistDateSearch, setBlacklistDateSearch] = useState('');

  // Special Attendance Adjustment (aggregate-only extra credits, e.g. college representation/duty leaves)
  const [specialAttendanceAdjustment, setSpecialAttendanceAdjustment] = useState({ attended: 0, held: 0 });
  const [isSpecialAdjOpen, setIsSpecialAdjOpen] = useState(false);
  
  // Granular Undo & Redo History Stacks (Excel-grade for all grid mutations)
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Ineligibility acknowledgement state (shown when baseline overall attendance < 66.7%)
  const [hasAcknowledgedIneligible, setHasAcknowledgedIneligible] = useState(false);

  // One-third rule alert dismiss state
  const [isOneThirdAlertDismissed, setIsOneThirdAlertDismissed] = useState(false);

  // Subject credit overrides for internal assessment marks calculation
  const [creditOverrides, setCreditOverrides] = useState(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = localStorage.getItem(`sscbs_credit_overrides_${userKey}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleSetCreditOverride = (subjectName, value) => {
    setCreditOverrides(prev => {
      const next = { ...prev, [subjectName]: value };
      try {
        localStorage.setItem(`sscbs_credit_overrides_${userKey}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

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

  // Total count of active user modifications (waivers, CDC, edits, dates, rules)
  const totalAuditChanges = useMemo(() => {
    return countTotalAuditChanges({
      selectedWaivers,
      selectedCdcDays,
      priorityDates,
      blacklistedDates,
      creditOverrides,
      specialAttendanceAdjustment,
      customizationDiff
    });
  }, [selectedWaivers, selectedCdcDays, priorityDates, blacklistedDates, creditOverrides, specialAttendanceAdjustment, customizationDiff]);

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
          if (Array.isArray(saved.blacklistedDates)) {
            setBlacklistedDates(new Set(saved.blacklistedDates));
          }
          if (saved.specialAttendanceAdjustment && typeof saved.specialAttendanceAdjustment === 'object') {
            setSpecialAttendanceAdjustment({
              attended: Number(saved.specialAttendanceAdjustment.attended) || 0,
              held: Number(saved.specialAttendanceAdjustment.held) || 0
            });
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
        blacklistedDates: Array.from(blacklistedDates),
        gridToolMode,
        customStartDate,
        customEndDate
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (err) {
      console.warn('Failed to persist Waiver Tool state:', err);
    }
  }, [rawParsedData, parsedData, selectedWaivers, lockedWaivers, lockedCdcDays, starredSubjects, priorityDates, blacklistedDates, solverResult, kPlusOneResult, maxWaivers, threshold, fileMeta, hasAcknowledgedIneligible, cdcLimit, selectedCdcDays, gridToolMode, customStartDate, customEndDate, storageKey]);

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
        setIsBlacklistedDatesModalOpen(false);
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
    const actualBlockedDates = extraOpts.blockedDates !== undefined
      ? (Array.isArray(extraOpts.blockedDates) ? extraOpts.blockedDates : Array.from(extraOpts.blockedDates || []))
      : (blacklistedDates.size > 0 ? Array.from(blacklistedDates) : []);
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
        priorityWaiverDates: actualPriorityDates,
        blockedDates: actualBlockedDates
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
            priorityWaiverDates: actualPriorityDates,
            blockedDates: actualBlockedDates
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

  const selectedDateInfo = useMemo(() => {
    if (!newDateInput) return null;
    const parts = newDateInput.split('-');
    if (parts.length < 3) return null;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const dn = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(dn)) return null;

    const dateObj = new Date(Date.UTC(y, m - 1, dn));
    const dayOfWeek = dateObj.getUTCDay();
    const weekday = WEEKDAYS[dayOfWeek];
    const isFuture = Boolean(parsedData?.reportDate && newDateInput > parsedData.reportDate);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const sched = parsedData ? findRecentDaySchedule(parsedData, weekday, newDateInput) : null;

    return {
      weekday,
      isFuture,
      isWeekend,
      recentSchedule: sched
    };
  }, [newDateInput, parsedData]);

  const sheetMinDate = useMemo(() => parsedData?.dayColumns?.[0]?.dateStr || '', [parsedData]);
  const sheetMaxDate = useMemo(() => parsedData?.dayColumns?.[parsedData.dayColumns.length - 1]?.dateStr || '', [parsedData]);

  const activeWaiverStart = customStartDate || '';
  const activeWaiverEnd = customEndDate || '';

  const currentSolverOptions = useMemo(() => ({
    waiverStartDate: activeWaiverStart || null,
    waiverEndDate: activeWaiverEnd || null,
    priorityWaiverDates: priorityDates.size > 0 ? Array.from(priorityDates) : [],
    blockedDates: blacklistedDates.size > 0 ? Array.from(blacklistedDates) : []
  }), [activeWaiverStart, activeWaiverEnd, priorityDates, blacklistedDates]);

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
    setPriorityDates(new Set());
    setIsPriorityDatesModalOpen(false);
    setBlacklistedDates(new Set());
    setIsBlacklistedDatesModalOpen(false);
    setSpecialAttendanceAdjustment({ attended: 0, held: 0 });
    setIsSpecialAdjOpen(false);
    setUndoStack([]);
    setRedoStack([]);
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
  
  // Record an immutable history snapshot before grid mutations (Excel-grade Undo/Redo)
  const recordHistorySnapshot = (description) => {
    if (!parsedData) return;
    const snapshot = {
      id: `${Date.now()}_${Math.random()}`,
      description,
      timestamp: Date.now(),
      parsedData: cloneParsedData(parsedData),
      selectedWaivers: new Set(selectedWaivers),
      selectedCdcDays: new Set(selectedCdcDays),
      lockedWaivers: new Set(lockedWaivers),
      lockedCdcDays: new Set(lockedCdcDays),
      priorityDates: new Set(priorityDates),
      blacklistedDates: new Set(blacklistedDates)
    };
    setUndoStack(prev => [...prev.slice(-49), snapshot]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0 || !parsedData) return;
    const previousSnapshot = undoStack[undoStack.length - 1];
    const nextUndoStack = undoStack.slice(0, -1);

    const currentSnapshot = {
      id: `${Date.now()}_${Math.random()}`,
      description: previousSnapshot.description,
      timestamp: Date.now(),
      parsedData: cloneParsedData(parsedData),
      selectedWaivers: new Set(selectedWaivers),
      selectedCdcDays: new Set(selectedCdcDays),
      lockedWaivers: new Set(lockedWaivers),
      lockedCdcDays: new Set(lockedCdcDays),
      priorityDates: new Set(priorityDates),
      blacklistedDates: new Set(blacklistedDates)
    };

    setRedoStack(prev => [...prev, currentSnapshot]);
    setUndoStack(nextUndoStack);

    const restoredParsedData = cloneParsedData(previousSnapshot.parsedData);
    setParsedData(restoredParsedData);
    setSelectedWaivers(new Set(previousSnapshot.selectedWaivers));
    setSelectedCdcDays(new Set(previousSnapshot.selectedCdcDays));
    setLockedWaivers(new Set(previousSnapshot.lockedWaivers));
    setLockedCdcDays(new Set(previousSnapshot.lockedCdcDays));
    setPriorityDates(new Set(previousSnapshot.priorityDates));
    setBlacklistedDates(new Set(previousSnapshot.blacklistedDates));

    setIsProcessing(true);
    executeSolverAsync(restoredParsedData, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
      if (solution?.chosenDays && isOptimalSuggested) {
        setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
        setSelectedCdcDays(solution.chosenCdcDays?.length ? new Set(solution.chosenCdcDays.map(d => d.dateStr)) : new Set());
      }
      setIsOneThirdAlertDismissed(false);
    }, {
      ...currentSolverOptions,
      priorityWaiverDates: Array.from(previousSnapshot.priorityDates),
      blockedDates: Array.from(previousSnapshot.blacklistedDates)
    });
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !parsedData) return;
    const nextSnapshot = redoStack[redoStack.length - 1];
    const nextRedoStack = redoStack.slice(0, -1);

    const currentSnapshot = {
      id: `${Date.now()}_${Math.random()}`,
      description: nextSnapshot.description,
      timestamp: Date.now(),
      parsedData: cloneParsedData(parsedData),
      selectedWaivers: new Set(selectedWaivers),
      selectedCdcDays: new Set(selectedCdcDays),
      lockedWaivers: new Set(lockedWaivers),
      lockedCdcDays: new Set(lockedCdcDays),
      priorityDates: new Set(priorityDates),
      blacklistedDates: new Set(blacklistedDates)
    };

    setUndoStack(prev => [...prev, currentSnapshot]);
    setRedoStack(nextRedoStack);

    const restoredParsedData = cloneParsedData(nextSnapshot.parsedData);
    setParsedData(restoredParsedData);
    setSelectedWaivers(new Set(nextSnapshot.selectedWaivers));
    setSelectedCdcDays(new Set(nextSnapshot.selectedCdcDays));
    setLockedWaivers(new Set(nextSnapshot.lockedWaivers));
    setLockedCdcDays(new Set(nextSnapshot.lockedCdcDays));
    setPriorityDates(new Set(nextSnapshot.priorityDates));
    setBlacklistedDates(new Set(nextSnapshot.blacklistedDates));

    setIsProcessing(true);
    executeSolverAsync(restoredParsedData, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
      if (solution?.chosenDays && isOptimalSuggested) {
        setSelectedWaivers(new Set(solution.chosenDays.map(d => d.dateStr)));
        setSelectedCdcDays(solution.chosenCdcDays?.length ? new Set(solution.chosenCdcDays.map(d => d.dateStr)) : new Set());
      }
      setIsOneThirdAlertDismissed(false);
    }, {
      ...currentSolverOptions,
      priorityWaiverDates: Array.from(nextSnapshot.priorityDates),
      blockedDates: Array.from(nextSnapshot.blacklistedDates)
    });
  };

  // Global Keyboard Shortcuts for Undo (Ctrl+Z / Cmd+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z / Cmd+Shift+Z)
  const handleUndoRef = useRef(handleUndo);
  const handleRedoRef = useRef(handleRedo);
  handleUndoRef.current = handleUndo;
  handleRedoRef.current = handleRedo;

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl && !e.altKey) {
        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            e.preventDefault();
            handleRedoRef.current?.();
          } else {
            e.preventDefault();
            handleUndoRef.current?.();
          }
        } else if (e.key === 'y' || e.key === 'Y') {
          e.preventDefault();
          handleRedoRef.current?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSaveCellClasses = () => {
    if (!editingCell || !parsedData) return;
    const { subjectName, dateStr, classes } = editingCell;
    recordHistorySnapshot(`Edit cell: ${subjectName} on ${dateStr}`);
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
    recordHistorySnapshot(`Clear cell: ${subjectName} on ${dateStr}`);
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

  // Add a new date column (or date range) with future attendance simulation & timetable autofill
  const handleAddDate = () => {
    if (!newDateInput) {
      setNewDateError('Please choose a valid date.');
      return;
    }

    let datesToAdd = [];
    if (addDateMode === 'single') {
      datesToAdd = [newDateInput];
    } else {
      if (!newEndDateInput) {
        setNewDateError('Please choose an end date for the date range.');
        return;
      }
      if (newEndDateInput < newDateInput) {
        setNewDateError('End date must be on or after start date.');
        return;
      }

      // Generate date range
      const cur = new Date(newDateInput + 'T00:00:00Z');
      const end = new Date(newEndDateInput + 'T00:00:00Z');
      const maxDays = 31; // Safety limit
      let count = 0;

      while (cur <= end && count < maxDays) {
        const y = cur.getUTCFullYear();
        const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
        const d = String(cur.getUTCDate()).padStart(2, '0');
        const ds = `${y}-${m}-${d}`;
        // Skip weekends in range mode (Saturday = 6, Sunday = 0)
        const dayOfWeek = cur.getUTCDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          datesToAdd.push(ds);
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
        count++;
      }

      if (datesToAdd.length === 0) {
        setNewDateError('No weekday dates (Mon – Fri) found in the chosen range.');
        return;
      }
    }

    // Filter out dates that already exist
    const existingSet = new Set((parsedData?.dayColumns || []).map(d => d.dateStr));
    const newDates = datesToAdd.filter(d => !existingSet.has(d));

    if (newDates.length === 0) {
      setNewDateError(addDateMode === 'single' ? 'This date already exists in the grid.' : 'All dates in this range already exist in the grid.');
      return;
    }

    recordHistorySnapshot(addDateMode === 'single' ? `Add date ${newDates[0]}` : `Add date range ${newDates[0]} to ${newDates[newDates.length - 1]}`);
    const updated = batchAddDates(parsedData, newDates, timetableTemplateMode, timetableDefaultStatus);
    setParsedData(updated);
    setIsAddDateModalOpen(false);
    setNewDateInput('');
    setNewEndDateInput('');
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

  // Clear only speculative future dates strictly after original reportDate
  const handleClearFutureDates = () => {
    if (!parsedData || !rawParsedData?.reportDate) return;
    const repDate = rawParsedData.reportDate;
    const futureSet = new Set(
      (parsedData.dayColumns || []).filter(d => d.dateStr > repDate).map(d => d.dateStr)
    );
    if (futureSet.size === 0) return;
    recordHistorySnapshot('Clear speculative future dates');
    const updated = clearFutureDates(parsedData, repDate);
    setParsedData(updated);

    // Clean up any waivers, CDC, or priority dates referencing purged future dates
    setSelectedWaivers(prev => {
      let changed = false;
      const next = new Set(prev);
      futureSet.forEach(d => { if (next.delete(d)) changed = true; });
      return changed ? next : prev;
    });
    setSelectedCdcDays(prev => {
      let changed = false;
      const next = new Set(prev);
      futureSet.forEach(d => { if (next.delete(d)) changed = true; });
      return changed ? next : prev;
    });
    setLockedWaivers(prev => {
      let changed = false;
      const next = new Set(prev);
      futureSet.forEach(d => { if (next.delete(d)) changed = true; });
      return changed ? next : prev;
    });
    setLockedCdcDays(prev => {
      let changed = false;
      const next = new Set(prev);
      futureSet.forEach(d => { if (next.delete(d)) changed = true; });
      return changed ? next : prev;
    });
    setPriorityDates(prev => {
      let changed = false;
      const next = new Set(prev);
      futureSet.forEach(d => { if (next.delete(d)) changed = true; });
      return changed ? next : prev;
    });

    setIsProcessing(true);
    executeSolverAsync(updated, threshold, maxWaivers, cdcLimit, starredSubjects, (solution) => {
      if (solution?.chosenDays && (selectedWaivers.size > 0 || selectedCdcDays.size > 0)) {
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
    recordHistorySnapshot(`Delete date ${delDate}`);
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
    recordHistorySnapshot('Reset grid to original file');
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
      executeSolverAsync(parsedData, threshold, maxWaivers, cdcLimit, next, (_solution) => {
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
      // Mutual exclusivity: remove from blacklisted if prioritized
      setBlacklistedDates(prev => {
        if (!prev.has(dateStr)) return prev;
        const next = new Set(prev);
        next.delete(dateStr);
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

  // Transparent label for Apply Recommended button showing CDC vs waiver breakdown
  const getApplyRecommendedLabel = (short = false) => {
    const cCount = solverResult?.chosenCdcDays?.length || 0;
    const wCount = solverResult?.chosenDays?.length || 0;
    if (cCount > 0 && wCount > 0) {
      return short ? `Apply recommended (${cCount} CDC + ${wCount} Waivers)` : `Apply recommended dates (${cCount} CDC + ${wCount} waivers)`;
    }
    if (cCount > 0) {
      return short ? `Apply recommended (${cCount} CDC)` : `Apply recommended dates (${cCount} CDC)`;
    }
    if (wCount > 0) {
      return short ? `Apply recommended (${wCount} Waivers)` : `Apply recommended dates (${wCount} waivers)`;
    }
    return short ? 'Apply recommended' : 'Apply recommended dates';
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

  // Copy full audit log of all changes to clipboard
  const handleCopyFullChangelog = () => {
    const text = compileAttendanceChangelog({
      rawParsedData,
      currentParsedData: parsedData,
      selectedWaivers,
      selectedCdcDays,
      priorityDates,
      blacklistedDates,
      creditOverrides,
      specialAttendanceAdjustment,
      totalsSummary,
      aggregateMarks,
      fileMeta
    });

    const onSuccess = () => {
      setCopyFeedback('✓ Copied all changes to clipboard!');
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
  // Aggregate totals across all subjects (plus special aggregate attendance adjustment)
  const totalsSummary = useMemo(() => {
    let baseTotals = simStats?.totals;
    const subsList = simStats?.subjectSummaries || simStats?.subjectsStats || [];
    if (!baseTotals && subsList.length > 0) {
      let totAtt = 0, totHeld = 0, totBaseAtt = 0, totBaseHeld = 0;
      let thAtt = 0, thHeld = 0, thBaseAtt = 0, thBaseHeld = 0;
      let tuAtt = 0, tuHeld = 0, tuBaseAtt = 0, tuBaseHeld = 0;

      subsList.forEach(sub => {
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

      baseTotals = {
        overall: {
          att: totAtt,
          held: totHeld,
          pct: calcPct(totAtt, totHeld),
          baseAtt: totBaseAtt,
          baseHeld: totBaseHeld,
          basePct: calcPct(totBaseAtt, totBaseHeld)
        },
        theory: {
          att: thAtt,
          held: thHeld,
          pct: calcPct(thAtt, thHeld),
          baseAtt: thBaseAtt,
          baseHeld: thBaseHeld,
          basePct: calcPct(thBaseAtt, thBaseHeld)
        },
        tutorial: {
          att: tuAtt,
          held: tuHeld,
          pct: calcPct(tuAtt, tuHeld),
          baseAtt: tuBaseAtt,
          baseHeld: tuBaseHeld,
          basePct: calcPct(tuBaseAtt, tuBaseHeld)
        }
      };
    }

    if (!baseTotals) return null;

    const adjAtt = Number(specialAttendanceAdjustment.attended) || 0;
    const adjHeld = Number(specialAttendanceAdjustment.held) || 0;

    const rawAtt = baseTotals.overall.att;
    const rawHeld = baseTotals.overall.held;
    const rawBaseAtt = baseTotals.overall.baseAtt ?? rawAtt;
    const rawBaseHeld = baseTotals.overall.baseHeld ?? rawHeld;

    const effectiveAtt = Math.max(0, rawAtt + adjAtt);
    const effectiveHeld = Math.max(effectiveAtt, rawHeld + adjHeld);
    const effectiveBaseAtt = Math.max(0, rawBaseAtt + adjAtt);
    const effectiveBaseHeld = Math.max(effectiveBaseAtt, rawBaseHeld + adjHeld);

    const calcPct = (a, h) => (h > 0 ? (a / h) * 100 : 100);

    return {
      overall: {
        att: effectiveAtt,
        held: effectiveHeld,
        pct: calcPct(effectiveAtt, effectiveHeld),
        baseAtt: effectiveBaseAtt,
        baseHeld: effectiveBaseHeld,
        basePct: calcPct(effectiveBaseAtt, effectiveBaseHeld),
        rawAtt,
        rawHeld,
        rawPct: calcPct(rawAtt, rawHeld),
        rawBasePct: calcPct(rawBaseAtt, rawBaseHeld),
        specialAdjustment: { attended: adjAtt, held: adjHeld }
      },
      theory: baseTotals.theory,
      tutorial: baseTotals.tutorial
    };
  }, [simStats, specialAttendanceAdjustment]);

  // Real-time aggregate internal assessment attendance marks based on DU percentage slabs
  const aggregateMarks = useMemo(() => {
    if (!subjectSummaries || subjectSummaries.length === 0) return null;
    return calculateAggregateMarks(subjectSummaries, creditOverrides);
  }, [subjectSummaries, creditOverrides]);

  // Target components list for Status Bar parts on target
  const bannerParts = useMemo(() => {
    if (!subjectSummaries || subjectSummaries.length === 0) return [];
    const parts = [];
    subjectSummaries.forEach(sub => {
      const pList = sub.partsList || Object.values(sub.parts || {});
      pList.forEach(p => {
        if ((p.type === 'th' || p.type === 'tu') && ((p.simN ?? p.n ?? 0) > 0 || (p.baseHeld ?? 0) > 0)) {
          const held = p.simN ?? p.n ?? 0;
          const att = p.simAttended ?? p.simP ?? 0;
          const pct = held > 0 ? (att / held) * 100 : 100;
          const abbr = getSubjAbbreviation(sub.name);
          const shortName = `${abbr} ${p.type === 'th' ? 'Th' : 'Tu'}`;
          let color = '#15803d'; // green >= threshold
          if (pct < 66.666) color = '#b91c1c'; // red < 66.7%
          else if (pct < threshold) color = '#d97706'; // amber < threshold
          parts.push({
            id: `${sub.name}_${p.type}`,
            subjName: sub.name,
            type: p.type,
            shortName,
            label: `${sub.name} ${p.shortType || (p.type === 'th' ? 'Theory' : 'Tutorial')}`,
            pct,
            color,
            needsAttention: pct < threshold
          });
        }
      });
    });
    return parts;
  }, [subjectSummaries, threshold]);

  // Overall university eligibility check:
  // If a student's total attendance across all subjects combined is below 66.7%,
  // they cannot officially apply for waivers in college (per DU Ordinance VII).
  const baselineOverallPct = totalsSummary?.overall?.basePct ?? 100;
  const isOverallIneligible = Boolean(parsedData && (totalsSummary?.overall?.held ?? 0) > 0 && baselineOverallPct < 66.666);

  const partOrder = { th: 0, tu: 1, pr: 2 };

  const renderPart = (part, sub, subMarks) => {
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

    let partMaxM = 0;
    let partEarnedM = 0;
    if (part.type === 'th') {
      partMaxM = subMarks?.thMax ?? 6.0;
      partEarnedM = subMarks?.thEarned ?? 0.0;
    } else if (part.type === 'tu') {
      partMaxM = subMarks?.tuMax ?? 5.0;
      partEarnedM = subMarks?.tuEarned ?? 0.0;
    }

    return (
      <div key={part.type} className="rd-part">
        <div className="rd-part-top">
          <div className="rd-part-left">
            <span className="rd-part-name">{part.shortType || (part.type === 'th' ? 'Theory' : part.type === 'tu' ? 'Tutorial' : 'Practical')}</span>
            <span className="rd-part-frac">{part.simP ?? part.simAttended}/{held} classes</span>
            {status === 'info' && (
              <span
                className="rd-info-tag"
                title="Counted in Total Attendance aggregate, but not prioritized for individual subject waivers."
              >
                Info only
              </span>
            )}
            {part.cdcAtt > 0 && (
              <span
                className="rd-part-cdc-tag"
                title={`${part.cdcAtt} class(es) converted from absent to present via Career Development Centre (CDC) attendance`}
              >
                +{part.cdcAtt} CDC
              </span>
            )}
          </div>
          <div className="rd-part-right">
            <span className="rd-was">{hasChanged ? `was ${basePct.toFixed(1)}%` : 'unchanged'}</span>
            <div className="rd-part-score-box">
              <span className={`rd-pct s-${status}`}>{currentPct.toFixed(1)}%</span>
              {partMaxM > 0 ? (
                <span className="rd-part-marks-chip" title={`${part.shortType || part.type} attendance marks`}>
                  <strong>{partEarnedM}</strong>/{partMaxM} M
                </span>
              ) : (
                <span className="rd-part-marks-chip muted" title="Practical attendance carries 0 internal marks per DU UGCF">
                  0 M
                </span>
              )}
            </div>
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
            `Counted in aggregate attendance · Not targeted for individual waivers (0 marks)`
          ) : status === 'fail' ? (
            <>⚠️ <strong style={{ color: 'var(--red, #b91c1c)' }}>Risk:</strong> Below 66.7% minimum. Attend <strong>{buff.classesNeededForDebarSafe || 1}</strong> class(es) to avoid risk (currently 0 M).</>
          ) : buff.passes ? (
            <>Full marks ({partMaxM} M) · Can miss <strong>{buff.missableBuffer}</strong> more without dropping below {threshold}%</>
          ) : (
            <>Safe from debarment ({partEarnedM}/{partMaxM} M) · Attend <strong>{buff.classesNeeded}</strong> in a row to reach {threshold}%{partMaxM > partEarnedM ? ` (+${(partMaxM - partEarnedM).toFixed(1)} M)` : ''}</>
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

  
  const renderHistoryButtons = () => {
    const canUndo = undoStack.length > 0;
    const canRedo = redoStack.length > 0;
    const lastUndo = canUndo ? undoStack[undoStack.length - 1] : null;
    const lastRedo = canRedo ? redoStack[redoStack.length - 1] : null;

    return (
      <div className="rd-history-btns" role="group" aria-label="Undo and Redo changes">
        <button
          type="button"
          className="rd-history-btn"
          disabled={!canUndo}
          onClick={handleUndo}
          title={canUndo ? `Undo ${lastUndo.description} (Ctrl+Z)` : 'Undo (Ctrl+Z)'}
          aria-label="Undo last change"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 14 4 9 9 4" />
            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
          </svg>
          <span>Undo{canUndo ? ` (${undoStack.length})` : ''}</span>
        </button>
        <button
          type="button"
          className="rd-history-btn"
          disabled={!canRedo}
          onClick={handleRedo}
          title={canRedo ? `Redo ${lastRedo.description} (Ctrl+Y)` : 'Redo (Ctrl+Y)'}
          aria-label="Redo last change"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 14 20 9 15 4" />
            <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
          </svg>
          <span>Redo{canRedo ? ` (${redoStack.length})` : ''}</span>
        </button>
      </div>
    );
  };

  const renderStatusBar = () => {
    if (!simStats) return null;

    const allPassing = simStats.allPassing;
    const debarSafeCount = simStats.debarSafeTargetCount ?? 0;
    let tone = 'warn';
    let toneLabel = 'Below target';

    if (allPassing) {
      tone = 'safe';
      toneLabel = 'Target met';
    } else if (debarSafeCount < totalTargetParts) {
      tone = 'fail';
      toneLabel = 'At risk';
    }

    const headline = allPassing
      ? `All ${totalTargetParts} parts meet ${threshold}%`
      : `${passingTargetCount} of ${totalTargetParts} parts meet ${threshold}%`;

    const remainingCount = totalTargetParts - passingTargetCount;
    let subHeadline = `${remainingCount} part${remainingCount === 1 ? '' : 's'} still need${remainingCount === 1 ? 's' : ''} attention`;
    if (allPassing) {
      subHeadline = 'All attendance requirements satisfied';
    } else if (cdcLimit > 0 && selectedCdcDays.size > 0) {
      subHeadline = `CDC active · ${remainingCount} part${remainingCount === 1 ? '' : 's'} left`;
    }

    const attentionParts = bannerParts.filter(p => p.needsAttention);
    const marksData = aggregateMarks || { earned: 0, baseEarned: 0, maxMarks: 40, gain: 0, waiverGain: 0, cdcGain: 0 };
    const maxM = marksData.maxMarks > 0 ? marksData.maxMarks : 40;
    const baseW = Math.min(100, (marksData.baseEarned / maxM) * 100);
    const waiverW = Math.max(0, (marksData.waiverGain / maxM) * 100);
    const cdcW = Math.max(0, (marksData.cdcGain / maxM) * 100);

    const totalUsedWaivers = selectedWaivers.size;
    const totalUsedCdc = selectedCdcDays.size;
    const totalWaiverCap = maxWaivers;
    const totalCdcCap = cdcLimit;
    const combinedUsed = totalUsedWaivers + (totalCdcCap > 0 ? totalUsedCdc : 0);
    const combinedCap = totalWaiverCap + (totalCdcCap > 0 ? totalCdcCap : 0);

    return (
      <div role="status" className={`rd-status-bar-5col tone-${tone}`}>
        {/* Col 1: Status Tone & Icon */}
        <div className="rd-sb-col rd-sb-col-1">
          <span className="rd-sb-icon-box">
            {tone === 'safe' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="8 12.5 11 15.5 16 9.5" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
          </span>
          <div className="rd-sb-info-stack">
            <span className="rd-sb-tone-lbl">{toneLabel}</span>
            <strong className="rd-sb-headline">{headline}</strong>
            <span className="rd-sb-sub">{subHeadline}</span>
          </div>
        </div>

        {/* Col 2: Parts on Target */}
        <div className="rd-sb-col rd-sb-col-2">
          <div className="rd-sb-meta-row">
            <span className="rd-sb-col-title">Parts on target</span>
            <span className="rd-sb-col-val">{passingTargetCount}<span>/{totalTargetParts}</span></span>
          </div>
          <div className="rd-sb-parts-seg-bar">
            {bannerParts.map(bp => (
              <span
                key={bp.id}
                title={`${bp.label} ${bp.pct.toFixed(1)}%`}
                className="rd-sb-part-seg"
                style={{ background: bp.color }}
              />
            ))}
          </div>
          <div className="rd-sb-chips-row">
            {attentionParts.length === 0 ? (
              <span className="rd-sb-all-clear">✓ All target parts cleared</span>
            ) : (
              attentionParts.map(bp => (
                <span
                  key={bp.id}
                  className={`rd-sb-attn-chip ${bp.pct < 66.666 ? 'is-risk' : 'is-warn'}`}
                  title={`${bp.label} is at ${bp.pct.toFixed(1)}% (target ${threshold}%)`}
                >
                  {bp.shortName} {bp.pct.toFixed(1)}%
                </span>
              ))
            )}
          </div>
        </div>

        {/* Col 3: Internal Marks */}
        <div className="rd-sb-col rd-sb-col-3">
          <div className="rd-sb-meta-row">
            <span className="rd-sb-col-title">Internal marks</span>
            <span className="rd-sb-marks-tally">
              <b className="rd-sb-marks-num">{marksData.earned.toFixed(1)} / {marksData.maxMarks} M</b>
              {marksData.gain > 0 && (
                <span className="rd-sb-gain-badge">+{marksData.gain.toFixed(1)} M</span>
              )}
            </span>
          </div>
          <div className="rd-sb-stacked-bar" title={`Base: ${marksData.baseEarned.toFixed(1)} M, Waivers gain: +${marksData.waiverGain.toFixed(1)} M, CDC gain: +${marksData.cdcGain.toFixed(1)} M`}>
            <div className="rd-sb-seg-base" style={{ width: `${baseW}%` }} />
            <div className="rd-sb-seg-gain" style={{ left: `${baseW}%`, width: `${waiverW}%` }} />
            <div className="rd-sb-seg-cdc" style={{ left: `${baseW + waiverW}%`, width: `${cdcW}%` }} />
          </div>
          <span className="rd-sb-note">
            {totalCdcCap > 0 && marksData.cdcGain > 0
              ? `+${marksData.waiverGain.toFixed(1)} M waivers · +${marksData.cdcGain.toFixed(1)} M CDC`
              : marksData.gain > 0
                ? `was ${marksData.baseEarned.toFixed(1)} M before waivers`
                : `Full baseline (${marksData.baseEarned.toFixed(1)} M)`}
          </span>
        </div>

        {/* Col 4: Waivers (+ CDC) */}
        <div className="rd-sb-col rd-sb-col-4">
          <div className="rd-sb-meta-row">
            <span className="rd-sb-col-title">{totalCdcCap > 0 ? 'Waivers + CDC' : 'Waivers'}</span>
            <span className="rd-sb-col-val">{combinedUsed}<span>/{combinedCap}</span></span>
          </div>
          <div className="rd-sb-dual-bar">
            <div className="rd-sb-bar-wrap" style={{ flex: `${Math.max(1, totalWaiverCap)} 1 0` }}>
              <div
                className="rd-sb-bar-fill-waivers"
                style={{ width: `${totalWaiverCap > 0 ? Math.min(100, (totalUsedWaivers / totalWaiverCap) * 100) : 0}%` }}
              />
            </div>
            {totalCdcCap > 0 && (
              <div className="rd-sb-bar-wrap" style={{ flex: `${totalCdcCap} 1 0` }}>
                <div
                  className="rd-sb-bar-fill-cdc"
                  style={{ width: `${Math.min(100, (totalUsedCdc / totalCdcCap) * 100)}%` }}
                />
              </div>
            )}
          </div>
          <div className="rd-sb-caption-row">
            {totalCdcCap === 0 ? (
              <span>{totalUsedWaivers >= totalWaiverCap ? 'Limit reached' : `${totalWaiverCap - totalUsedWaivers} remaining`}</span>
            ) : (
              <>
                <span className="rd-sb-legend-item">
                  <i className="rd-dot-maroon" />
                  {totalUsedWaivers}/{totalWaiverCap} waivers
                </span>
                <span className="rd-sb-legend-item">
                  <i className="rd-dot-cdc" />
                  {totalUsedCdc}/{totalCdcCap} CDC
                </span>
              </>
            )}
          </div>
        </div>

        {/* Col 5: Action Button */}
        <div className="rd-sb-col rd-sb-col-5">
          {hasPendingPriorityChange ? (
            <button
              type="button"
              className="rd-sb-action-btn is-priority"
              onClick={handleRecalculateWithPriorities}
              title="Recalculate and apply optimal waivers with updated starred priorities"
            >
              ★ Recalculate
            </button>
          ) : (solverResult?.chosenDays?.length > 0 || solverResult?.chosenCdcDays?.length > 0) ? (
            <button
              type="button"
              className={`rd-sb-action-btn ${isOptimalSuggested ? 'is-applied' : 'is-unapplied'}`}
              onClick={handleApplyRecommended}
              title={isOptimalSuggested ? 'Recommended attendance plan is active (click to re-apply)' : 'Apply recommended attendance dates'}
            >
              {isOptimalSuggested ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Recommended applied
                </>
              ) : (
                getApplyRecommendedLabel(true)
              )}
            </button>
          ) : null}
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
                  {item.key === 'overall' && (
                    <button
                      type="button"
                      className={`rd-special-adj-btn ${(specialAttendanceAdjustment.attended !== 0 || specialAttendanceAdjustment.held !== 0) ? 'is-active' : ''}`}
                      onClick={() => setIsSpecialAdjOpen(!isSpecialAdjOpen)}
                      title="Adjust total attendance for special institutional cases (duty leaves or representation credits)"
                    >
                      {(specialAttendanceAdjustment.attended !== 0 || specialAttendanceAdjustment.held !== 0) ? (
                        <span>⚡ Adjusted ({item.data.att}/{item.data.held}) ✎</span>
                      ) : (
                        <span>✎ Adjust</span>
                      )}
                    </button>
                  )}
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
                  {item.key === 'overall' && (
                    <button
                      type="button"
                      className={`rd-special-adj-btn ${(specialAttendanceAdjustment.attended !== 0 || specialAttendanceAdjustment.held !== 0) ? 'is-active' : ''}`}
                      onClick={() => setIsSpecialAdjOpen(!isSpecialAdjOpen)}
                      title="Adjust total attendance for special institutional cases (duty leaves or representation credits)"
                    >
                      {(specialAttendanceAdjustment.attended !== 0 || specialAttendanceAdjustment.held !== 0) ? (
                        <span>⚡ Special ({specialAttendanceAdjustment.attended >= 0 ? `+${specialAttendanceAdjustment.attended}` : specialAttendanceAdjustment.attended}/{specialAttendanceAdjustment.held >= 0 ? `+${specialAttendanceAdjustment.held}` : specialAttendanceAdjustment.held}) ✎</span>
                      ) : (
                        <span>✎ Adjust Total (+/-)</span>
                      )}
                    </button>
                  )}
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
              {item.key === 'overall' && isSpecialAdjOpen && (
                <div className="rd-special-adj-panel" role="region" aria-label="Adjust Total Attendance">
                  <div className="rd-special-adj-head">
                    <span className="rd-special-adj-title">
                      <strong>Adjust Total Attendance</strong>
                    </span>
                    <button
                      type="button"
                      className="rd-special-adj-close"
                      onClick={() => setIsSpecialAdjOpen(false)}
                      aria-label="Close"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="rd-special-adj-subtext">
                    For special cases where extra attendance is added directly to your total tally.
                  </p>

                  <div className="rd-special-adj-steppers">
                    {/* Attended Stepper */}
                    <div className="rd-adj-stepper-field">
                      <label>Attended (Present):</label>
                      <div className="rd-stepper-row">
                        <button
                          type="button"
                          className="rd-stepper-btn"
                          onClick={() => {
                            setSpecialAttendanceAdjustment(prev => ({
                              ...prev,
                              attended: prev.attended - 1
                            }));
                          }}
                          title="Decrease attended by 1"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          className="rd-stepper-input"
                          value={item.data.att}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!Number.isNaN(val)) {
                              setSpecialAttendanceAdjustment(prev => ({
                                ...prev,
                                attended: val - (item.data.rawAtt || 0)
                              }));
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="rd-stepper-btn"
                          onClick={() => {
                            setSpecialAttendanceAdjustment(prev => ({
                              ...prev,
                              attended: prev.attended + 1
                            }));
                          }}
                          title="Increase attended by 1"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Total Held Stepper */}
                    <div className="rd-adj-stepper-field">
                      <label>Total Classes (Held):</label>
                      <div className="rd-stepper-row">
                        <button
                          type="button"
                          className="rd-stepper-btn"
                          onClick={() => {
                            setSpecialAttendanceAdjustment(prev => ({
                              ...prev,
                              held: prev.held - 1
                            }));
                          }}
                          title="Decrease held by 1"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          className="rd-stepper-input"
                          value={item.data.held}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!Number.isNaN(val)) {
                              setSpecialAttendanceAdjustment(prev => ({
                                ...prev,
                                held: val - (item.data.rawHeld || 0)
                              }));
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="rd-stepper-btn"
                          onClick={() => {
                            setSpecialAttendanceAdjustment(prev => ({
                              ...prev,
                              held: prev.held + 1
                            }));
                          }}
                          title="Increase held by 1"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rd-special-adj-foot">
                    <span className="rd-adj-summary-text">
                      Original: {item.data.rawAtt}/{item.data.rawHeld}
                      {(specialAttendanceAdjustment.attended !== 0 || specialAttendanceAdjustment.held !== 0) && (
                        <> · <strong style={{ color: curPct >= threshold ? '#059669' : '#d97706' }}>Now: {item.data.att}/{item.data.held} ({curPct.toFixed(1)}%)</strong></>
                      )}
                    </span>
                    <div style={{ flex: 1 }} />
                    {(specialAttendanceAdjustment.attended !== 0 || specialAttendanceAdjustment.held !== 0) && (
                      <button
                        type="button"
                        className="rd-btn-outline xs muted"
                        onClick={() => setSpecialAttendanceAdjustment({ attended: 0, held: 0 })}
                      >
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      className="rd-btn-dark xs"
                      onClick={() => setIsSpecialAdjOpen(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
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
        const subMarks = calculateSubjectMarks(sub, creditOverrides[sub.name]);

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

            {/* Redesigned Sleek Marks Row */}
            {subMarks.subjectMax > 0 && (
              <div className="rd-card-marks-section">
                <div className="rd-card-marks-header">
                  <div className="rd-card-marks-score-group">
                    <span className="rd-card-marks-lbl">Marks</span>
                    <b className="rd-card-marks-val">{subMarks.subjectEarned} / {subMarks.subjectMax} M</b>
                    {subMarks.subjectGain > 0 && (
                      <span className="rd-card-marks-gain">+{subMarks.subjectGain.toFixed(1)} M</span>
                    )}
                  </div>
                  {sub.parts?.th && (
                    <div role="radiogroup" aria-label={`Credits for ${sub.name}`} className="rd-card-credits-segmented">
                      {getSubjectCreditOptions(sub).map((opt) => {
                        const isSelected = subMarks.thMax === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            className={`rd-credit-seg-btn ${isSelected ? 'is-active' : ''}`}
                            onClick={() => handleSetCreditOverride(sub.name, opt.value)}
                            title={opt.tooltip || `Set to ${opt.label}`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5px Multi-segment Component Progress Bar */}
                {subMarks.componentSegments?.length > 0 && (
                  <>
                    <div className="rd-card-marks-split-bar">
                      {subMarks.componentSegments.map((g) => (
                        <div
                          key={g.name}
                          title={`${g.name} ${g.got}/${g.max} M`}
                          className="rd-card-marks-comp-track"
                          style={{ flex: `${g.max} 1 0` }}
                        >
                          <div className="rd-card-marks-seg-base" style={{ width: g.baseW }} />
                          <div className="rd-card-marks-seg-gain" style={{ left: g.baseW, width: g.gainW }} />
                          <div className="rd-card-marks-seg-cdc" style={{ left: g.cdcL, width: g.cdcW }} />
                        </div>
                      ))}
                    </div>

                    {/* Component Subtext Labels */}
                    <div className="rd-card-marks-labels-row">
                      {subMarks.componentSegments.map((g) => (
                        <span key={g.name} className="rd-card-marks-comp-lbl" style={{ flex: `${g.max} 1 0` }}>
                          {g.name} <b>{g.got}/{g.max}</b>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {parts.map((p, pIdx) => (
              <React.Fragment key={p.type}>
                {pIdx > 0 && <div className="rd-divider" />}
                {renderPart(p, sub, subMarks)}
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
              const isFutureDate = col.isFuture || customizationDiff.futureDates?.has(col.dateStr) || Boolean(parsedData?.reportDate && col.dateStr > parsedData.reportDate);
              const isAddedDate = col.isCustom || customizationDiff.addedDates?.has(col.dateStr);
              const isPriority = priorityDates.has(col.dateStr);
              const isBlacklisted = blacklistedDates.has(col.dateStr);
              const btnClass = isWaived ? 'on' : (isCdc ? 'cdc-on' : (isPriority ? 'priority-on' : (isBlacklisted ? 'blacklist-on' : '')));
              const thClass = `rd-date-th ${isOutOfTimeline ? 'is-pre-society' : ''} ${isFutureDate ? 'is-future-col' : ''} ${isBlacklisted ? 'is-blacklisted-col' : ''} ${gridToolMode === 'edit' ? 'is-edit-header' : ''} ${gridToolMode === 'priority' ? 'is-priority-header' : ''} ${isPriority ? 'is-priority-col' : ''}`.trim();
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
                      {isBlacklisted ? (
                        <span className="rd-date-blacklist-badge" title="Blacklisted date (strictly excluded from recommended waivers)">🚫</span>
                      ) : isFutureDate ? (
                        <span className="rd-date-future-badge" title="Future speculative date (simulated attendance)">🔮</span>
                      ) : isAddedDate ? (
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
                    (parsedData?.reportDate && col.dateStr > parsedData.reportDate) ? 'is-future-cell' : '',
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
  // Render Blacklisted Dates (Excluded Dates) Modal
  const renderBlacklistedDatesModal = () => {
    if (!isBlacklistedDatesModalOpen) return null;

    const filteredCols = (parsedData?.dayColumns || []).filter(col => {
      if (!blacklistDateSearch.trim()) return true;
      const q = blacklistDateSearch.toLowerCase();
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
      <div className="rd-timeline-modal-overlay" onClick={() => setIsBlacklistedDatesModalOpen(false)}>
        <div className="rd-timeline-modal rd-blacklist-modal" role="dialog" aria-modal="true" aria-labelledby="rd-blacklist-title" onClick={e => e.stopPropagation()}>
          <div className="rd-timeline-modal-head">
            <div className="rd-timeline-modal-title">
              <span className="rd-timeline-modal-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}>🚫</span>
              <div>
                <h3 id="rd-blacklist-title">Blacklisted Dates (Excluded from Waivers)</h3>
                <p>Choose dates that must NEVER receive recommended waivers or CDC attendance (e.g. unapproved casual bunks, rejected teacher slips, or personal leaves).</p>
              </div>
            </div>
            <button
              type="button"
              className="rd-modal-close-btn"
              onClick={() => setIsBlacklistedDatesModalOpen(false)}
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
              value={blacklistDateSearch}
              onChange={e => setBlacklistDateSearch(e.target.value)}
            />
            <div className="rd-priority-quick-actions">
              <button
                type="button"
                className="rd-btn-outline sm"
                onClick={() => {
                  const next = new Set(tempBlacklistedDates);
                  candidateDatesWithAbsences.forEach(c => next.add(c.dateStr));
                  setTempBlacklistedDates(next);
                }}
                title="Select all dates with absences to exclude them from waivers"
              >
                Blacklist All Missed Dates ({candidateDatesWithAbsences.length})
              </button>
              <button
                type="button"
                className="rd-btn-outline sm muted"
                onClick={() => setTempBlacklistedDates(new Set())}
                disabled={tempBlacklistedDates.size === 0}
              >
                Clear Blacklist
              </button>
            </div>
          </div>

          <div className="rd-priority-modal-body">
            <div className="rd-priority-date-grid">
              {filteredCols.map(col => {
                const cand = candidateDaysMap.get(col.dateStr);
                const hasAbs = cand && cand.thOrTuAbsences > 0;
                const isSelected = tempBlacklistedDates.has(col.dateStr);
                const isAlsoPriority = priorityDates.has(col.dateStr);

                return (
                  <div
                    key={col.dateStr}
                    className={`rd-priority-date-card rd-blacklist-card ${isSelected ? 'selected' : ''} ${!hasAbs ? 'no-absences' : ''}`}
                    onClick={() => {
                      setTempBlacklistedDates(prev => {
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
                      className="rd-priority-check rd-blacklist-check"
                    />
                    <div className="rd-priority-card-info">
                      <div className="rd-priority-card-date">
                        <strong>{col.weekday}, {col.dayNum} {MONTH_NAMES[col.month - 1]}</strong>
                        {isSelected && <span className="rd-blacklist-card-tag">🚫 Blacklisted</span>}
                        {!isSelected && isAlsoPriority && <span className="rd-priority-card-star">★ Currently Priority</span>}
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
            <span className="rd-priority-count-badge" style={{ background: tempBlacklistedDates.size > 0 ? '#fee2e2' : undefined, color: tempBlacklistedDates.size > 0 ? '#991b1b' : undefined }}>
              <strong>{tempBlacklistedDates.size}</strong> date{tempBlacklistedDates.size === 1 ? '' : 's'} blacklisted
            </span>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="rd-btn-outline"
              onClick={() => setIsBlacklistedDatesModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rd-btn-dark rd-btn-danger"
              onClick={() => {
                const nextBlacklistedDates = Array.from(tempBlacklistedDates);
                setBlacklistedDates(tempBlacklistedDates);

                // Mutual exclusivity: remove newly blacklisted dates from priorityDates
                setPriorityDates(prev => {
                  let changed = false;
                  const next = new Set(prev);
                  tempBlacklistedDates.forEach(d => { if (next.delete(d)) changed = true; });
                  return changed ? next : prev;
                });

                // Revoke any active waivers or CDC on newly blacklisted dates
                setSelectedWaivers(prev => {
                  let changed = false;
                  const next = new Set(prev);
                  tempBlacklistedDates.forEach(d => { if (next.delete(d)) changed = true; });
                  return changed ? next : prev;
                });
                setSelectedCdcDays(prev => {
                  let changed = false;
                  const next = new Set(prev);
                  tempBlacklistedDates.forEach(d => { if (next.delete(d)) changed = true; });
                  return changed ? next : prev;
                });
                setLockedWaivers(prev => {
                  let changed = false;
                  const next = new Set(prev);
                  tempBlacklistedDates.forEach(d => { if (next.delete(d)) changed = true; });
                  return changed ? next : prev;
                });
                setLockedCdcDays(prev => {
                  let changed = false;
                  const next = new Set(prev);
                  tempBlacklistedDates.forEach(d => { if (next.delete(d)) changed = true; });
                  return changed ? next : prev;
                });

                setIsBlacklistedDatesModalOpen(false);

                if (parsedData) {
                  setIsProcessing(true);
                  const opts = {
                    ...currentSolverOptions,
                    blockedDates: nextBlacklistedDates,
                    priorityWaiverDates: Array.from(priorityDates).filter(d => !tempBlacklistedDates.has(d))
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
              Save & Recalculate ({tempBlacklistedDates.size})
            </button>
          </div>
        </div>
      </div>
    );
  };

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
                const isAlsoBlacklisted = blacklistedDates.has(col.dateStr);

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
                        {!isSelected && isAlsoBlacklisted && <span className="rd-blacklist-card-tag" style={{ marginLeft: 6 }}>🚫 Blacklisted</span>}
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
                // Mutual exclusivity: remove newly prioritized dates from blacklistedDates
                setBlacklistedDates(prev => {
                  let changed = false;
                  const next = new Set(prev);
                  tempPriorityDates.forEach(d => { if (next.delete(d)) changed = true; });
                  return changed ? next : prev;
                });
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

  // Render Add Date / Future Attendance Modal
  const renderAddDateModal = () => {
    if (!isAddDateModalOpen) return null;

    const repDate = parsedData?.reportDate || '';
    const isSingleFuture = Boolean(repDate && newDateInput && newDateInput > repDate);

    return (
      <div className="rd-modal-overlay" onClick={() => { setIsAddDateModalOpen(false); setNewDateError(''); }}>
        <div className="rd-modal-card rd-future-modal-card" style={{ maxWidth: '460px' }} onClick={e => e.stopPropagation()}>
          <div className="rd-modal-head">
            <div>
              <h3>Add Dates & Future Attendance</h3>
              <p className="rd-modal-sub">Add past corrections or speculate upcoming dates</p>
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
            {/* Mode Toggle: Single Date vs Date Range */}
            <div className="rd-add-mode-tabs">
              <button
                type="button"
                className={`rd-add-mode-tab ${addDateMode === 'single' ? 'active' : ''}`}
                onClick={() => { setAddDateMode('single'); setNewDateError(''); }}
              >
                📅 Single Date
              </button>
              <button
                type="button"
                className={`rd-add-mode-tab ${addDateMode === 'range' ? 'active' : ''}`}
                onClick={() => { setAddDateMode('range'); setNewDateError(''); }}
              >
                🗓️ Date Range (Multi-day)
              </button>
            </div>

            {addDateMode === 'single' ? (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
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
                {selectedDateInfo && (
                  <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ink)' }}>
                      {selectedDateInfo.weekday}
                    </span>
                    {selectedDateInfo.isWeekend && (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', background: 'var(--surface-subtle)', padding: '2px 7px', borderRadius: '4px' }}>
                        Weekend / Extra Class
                      </span>
                    )}
                    {selectedDateInfo.isFuture && (
                      <span className="rd-future-pill">
                        🔮 Future Date (Speculative)
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', marginBottom: '6px' }}>
                  Select Date Range (Mon – Fri, excludes weekends):
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="date"
                    className="rd-timeline-input"
                    style={{ flex: 1, boxSizing: 'border-box' }}
                    value={newDateInput}
                    onChange={(e) => {
                      setNewDateInput(e.target.value);
                      setNewDateError('');
                    }}
                  />
                  <span style={{ color: 'var(--ink-dim)', fontWeight: 600 }}>→</span>
                  <input
                    type="date"
                    className="rd-timeline-input"
                    style={{ flex: 1, boxSizing: 'border-box' }}
                    value={newEndDateInput}
                    min={newDateInput}
                    onChange={(e) => {
                      setNewEndDateInput(e.target.value);
                      setNewDateError('');
                    }}
                  />
                </div>
              </div>
            )}

            {newDateError && (
              <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--red)', fontWeight: 600 }}>
                {newDateError}
              </div>
            )}

            {/* Timetable Autofill Options */}
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>
                Class Schedule & Initial Attendance:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'var(--ink)', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="rd-template-mode"
                    checked={timetableTemplateMode === 'copy_weekday'}
                    onChange={() => setTimetableTemplateMode('copy_weekday')}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <strong>Auto-fill classes from matching weekday</strong>
                    <div style={{ fontSize: '11.5px', color: 'var(--ink-dim)', marginTop: '2px' }}>
                      Automatically copies your typical subjects & periods for that day of the week from previous weeks.
                    </div>
                  </div>
                </label>

                {timetableTemplateMode === 'copy_weekday' && (
                  <div style={{ marginLeft: '24px', marginTop: '4px', background: 'var(--surface-subtle)', padding: '10px 12px', borderRadius: '8px' }}>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--ink)', marginBottom: '4px' }}>
                      Initial Attendance Status for Planned Classes:
                    </label>
                    <select
                      className="rd-class-select"
                      style={{ width: '100%', fontSize: '12px', padding: '6px 8px' }}
                      value={timetableDefaultStatus}
                      onChange={(e) => setTimetableDefaultStatus(e.target.value)}
                    >
                      <option value="p">Mark all as Present (P) — Simulate 100% attendance</option>
                      <option value="a">Mark all as Absent (A) — Simulate duty leave / event absence</option>
                      <option value="as_is">Keep original past status</option>
                    </select>
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: 'var(--ink)', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="rd-template-mode"
                    checked={timetableTemplateMode === 'blank'}
                    onChange={() => setTimetableTemplateMode('blank')}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <strong>Start with blank day</strong>
                    <div style={{ fontSize: '11.5px', color: 'var(--ink-dim)', marginTop: '2px' }}>
                      Adds an empty column so you can manually click cells to add individual periods.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {isSingleFuture && (
              <div style={{ marginTop: '14px', background: 'rgba(124, 58, 237, 0.08)', border: '1px solid rgba(124, 58, 237, 0.2)', padding: '8px 12px', borderRadius: '6px', fontSize: '11.5px', color: '#6d28d9', lineHeight: 1.4 }}>
                💡 <strong>Future Speculation:</strong> This date is after your ERP export. The tool will project your updated attendance in real-time. You can clear future dates anytime with 1 click.
              </div>
            )}
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
              className="rd-btn-dark sm rd-btn-accent"
              onClick={handleAddDate}
            >
              {addDateMode === 'single' ? 'Add Date' : 'Add Date Range'}
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>ATTENDANCE NOTICE</span>
            </div>

            <h2 id="rd-ineligible-title" className="rd-ineligible-title">
              {solverResult?.cdcRescue?.cdcRescued
                ? 'CDC Attendance Rescues Eligibility!'
                : 'Overall Attendance is Below 66.7%'}
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
                  <p className="rd-ineligible-lead-text">
                    While society waivers require &ge; 66.7% aggregate attendance under DU rules, <strong>Career Development Centre (CDC) attendance is an official placement cell award and CAN be claimed regardless of your attendance percentage</strong>.
                  </p>
                  <div className="rd-ineligible-action-card">
                    <div className="rd-ineligible-action-item">
                      <span className="rd-ineligible-action-heading">🔮 Project Future Attendance</span>
                      <p>
                        Expecting upcoming lectures or pending marks? Use <strong>✎ Edit Attendance</strong> to project classes and see if they lift your total above 66.7%.
                      </p>
                    </div>
                    <div className="rd-ineligible-action-item">
                      <span className="rd-ineligible-action-heading">📋 Claim CDC & Plan Ahead</span>
                      <p>
                        Claim your CDC attendance dates below and test waiver combinations so you are prepared once your total crosses 66.7%.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="rd-ineligible-lead-text">
                    Under University of Delhi Ordinance VII, an overall aggregate of at least <strong>66.7%</strong> across all subjects is required to submit society waivers. Individual subject waivers can only be claimed once your combined total crosses this threshold.
                  </p>
                  <div className="rd-ineligible-action-card">
                    <div className="rd-ineligible-action-item">
                      <span className="rd-ineligible-action-heading">🔮 Project Future Attendance</span>
                      <p>
                        Expecting upcoming lectures or pending marks? Use <strong>✎ Edit Attendance</strong> to project future classes and test what it takes to hit 66.7%.
                      </p>
                    </div>
                    <div className="rd-ineligible-action-item">
                      <span className="rd-ineligible-action-heading">📋 Plan Waivers & CDC Days</span>
                      <p>
                        Find your optimal waiver dates now, or enter CDC attendance dates if you have them, so you're ready once your attendance clears 66.7%.
                      </p>
                    </div>
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
                <div className="rd-ineligible-footer-btns">
                  <button
                    type="button"
                    className="rd-ineligible-secondary-btn"
                    onClick={() => {
                      setHasAcknowledgedIneligible(true);
                      setGridToolMode('edit');
                      setIsGridExpanded(true);
                    }}
                    title="Open Edit Attendance in full expanded grid to project classes"
                  >
                    ✎ Project Classes in Edit Attendance
                  </button>
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
                    Apply CDC Attendance & Continue →
                  </button>
                </div>
              ) : (
                <div className="rd-ineligible-footer-btns">
                  <button
                    type="button"
                    className="rd-ineligible-secondary-btn"
                    onClick={() => {
                      setHasAcknowledgedIneligible(true);
                      setGridToolMode('edit');
                      setIsGridExpanded(true);
                    }}
                    title="Open Edit Attendance in full expanded grid to project classes"
                  >
                    ✎ Project Classes in Edit Attendance
                  </button>
                  <button
                    type="button"
                    className="rd-ineligible-ack-btn"
                    onClick={() => setHasAcknowledgedIneligible(true)}
                  >
                    Continue to Planner →
                  </button>
                </div>
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
            <div className="rd-stats-grid">
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

            {/* Blacklisted Dates (Never Waived) Stat */}
            <div
              className={`rd-stat blacklist-stat ${blacklistedDates.size > 0 ? 'active' : ''}`}
              onClick={() => {
                setTempBlacklistedDates(new Set(blacklistedDates));
                setBlacklistDateSearch('');
                setIsBlacklistedDatesModalOpen(true);
              }}
              title="Click to view or edit blacklisted dates that must never receive waivers"
            >
              <span className="lbl" title="Dates excluded from ever receiving waivers">
                Blacklisted
              </span>
              <div className="row timeline-stat-row">
                <span className="timeline-stat-dates">
                  {blacklistedDates.size === 0 ? 'None' : `${blacklistedDates.size} date${blacklistedDates.size > 1 ? 's' : ''} 🚫`}
                </span>
                <button
                  type="button"
                  className="rd-timeline-edit-btn"
                  title="Edit blacklisted dates"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTempBlacklistedDates(new Set(blacklistedDates));
                    setBlacklistDateSearch('');
                    setIsBlacklistedDatesModalOpen(true);
                  }}
                >
                  ✎
                </button>
              </div>
            </div>
            </div>

            {/* Redesigned 5-Column Status Bar */}
            {renderStatusBar()}
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
                  <span className="rd-legend-credits" title="Internal assessment marks are calculated per DU UGCF continuous assessment guidelines. Credits are auto-estimated from timetables—adjust using the credit buttons on each card if needed.">
                    ℹ️ Credits auto-estimated · Adjust on cards if needed
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
                  <div className="rd-panel-title-wrap">
                    <div className="rd-panel-title-row">
                      <h2>Spreadsheet grid</h2>
                      {renderHistoryButtons()}
                    </div>
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
                        ★ Priority ({priorityDates.size})
                    </button>
                    <button
                      type="button"
                      className={`rd-tool-btn blacklist ${blacklistedDates.size > 0 ? 'active' : ''}`}
                      onClick={() => {
                        setTempBlacklistedDates(new Set(blacklistedDates));
                        setBlacklistDateSearch('');
                        setIsBlacklistedDatesModalOpen(true);
                      }}
                      title="Manage blacklisted dates that must never receive waivers"
                    >
                      🚫 Blacklist ({blacklistedDates.size})
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
                    {(solverResult?.chosenDays?.length > 0 || solverResult?.chosenCdcDays?.length > 0) && (
                      <button
                        type="button"
                        className={`rd-btn-outline sm ${!isOptimalSuggested ? 'rd-btn-accent' : 'muted'}`}
                        onClick={handleApplyRecommended}
                        title={isOptimalSuggested ? 'Recommended attendance plan is active (click to re-apply)' : 'Apply recommended attendance dates'}
                      >
                        {isOptimalSuggested
                          ? '✓ Recommended applied'
                          : getApplyRecommendedLabel(true)}
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
                    <button
                      type="button"
                      className="rd-btn-outline sm muted"
                      onClick={handleClearAll}
                      disabled={selectedWaivers.size === 0 && selectedCdcDays.size === 0}
                      title="Clear all active waivers & CDC days"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      className="rd-btn-outline sm rd-copy-changes-btn"
                      onClick={handleCopyFullChangelog}
                      title="Copy complete audit log of all waivers, edits, and adjustments to clipboard"
                    >
                      📋 Copy All Changes {totalAuditChanges > 0 ? `(${totalAuditChanges})` : ''}
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
                {customizationDiff.futureDates?.size > 0 && (
                  <div className="rd-future-banner">
                    <div className="rd-future-banner-text">
                      🔮 <strong>Future Speculation:</strong>{' '}
                      {customizationDiff.futureDates.size} upcoming date{customizationDiff.futureDates.size === 1 ? '' : 's'} simulated{' '}
                      ({customizationDiff.futureClassesStats?.total || 0} classes: {customizationDiff.futureClassesStats?.p || 0} Present, {customizationDiff.futureClassesStats?.a || 0} Absent)
                    </div>
                    <div className="rd-future-banner-acts">
                      {gridToolMode === 'edit' && (
                        <button
                          type="button"
                          className="rd-btn-outline xs"
                          onClick={() => { setIsAddDateModalOpen(true); setNewDateError(''); setNewDateInput(''); }}
                        >
                          + Add More
                        </button>
                      )}
                      <button
                        type="button"
                        className="rd-btn-outline xs rd-future-clear-btn"
                        onClick={handleClearFutureDates}
                        title="Remove all speculative future dates and restore current attendance"
                      >
                        ✕ Clear Future ({customizationDiff.futureDates.size})
                      </button>
                    </div>
                  </div>
                )}
                {gridToolMode === 'edit' && (
                  <div className="rd-edit-banner">
                    <span className="rd-edit-banner-text">
                      ✏️ <strong>Edit Mode:</strong> Click any cell to add/modify classes. Click ✕ on date headers to delete a day.
                    </span>
                    <div className="rd-edit-banner-acts">
                      {renderHistoryButtons()}
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
                    {(solverResult?.chosenDays?.length > 0 || solverResult?.chosenCdcDays?.length > 0) && (
                      <button
                        type="button"
                        className={`rd-btn-outline sm ${!isOptimalSuggested ? 'rd-btn-accent' : 'muted'}`}
                        onClick={handleApplyRecommended}
                        title={isOptimalSuggested ? 'Recommended attendance plan is active (click to re-apply)' : 'Apply recommended attendance dates'}
                      >
                        {isOptimalSuggested
                          ? '✓ Recommended applied'
                          : getApplyRecommendedLabel(true)}
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
                      className="rd-btn-outline sm rd-copy-changes-btn"
                      onClick={handleCopyFullChangelog}
                      title="Copy complete audit log of all waivers, edits, and adjustments to clipboard"
                    >
                      📋 Copy All Changes {totalAuditChanges > 0 ? `(${totalAuditChanges})` : ''}
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
                        {getApplyRecommendedLabel(false)}
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
              <div className="rd-panel-title-wrap">
                <div className="rd-panel-title-row">
                  <h2>Spreadsheet grid</h2>
                  {renderHistoryButtons()}
                </div>
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
                    ★ Priority ({priorityDates.size})
                    </button>
                    <button
                      type="button"
                      className={`rd-tool-btn blacklist ${blacklistedDates.size > 0 ? 'active' : ''}`}
                      onClick={() => {
                        setTempBlacklistedDates(new Set(blacklistedDates));
                        setBlacklistDateSearch('');
                        setIsBlacklistedDatesModalOpen(true);
                      }}
                      title="Manage blacklisted dates that must never receive waivers"
                    >
                      🚫 Blacklist ({blacklistedDates.size})
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
                {(solverResult?.chosenDays?.length > 0 || solverResult?.chosenCdcDays?.length > 0) && (
                  <button
                    type="button"
                    className={`rd-btn-outline sm ${!isOptimalSuggested ? 'rd-btn-accent' : 'muted'}`}
                    onClick={handleApplyRecommended}
                    title={isOptimalSuggested ? 'Recommended attendance plan is active (click to re-apply)' : 'Apply recommended attendance dates'}
                  >
                    {isOptimalSuggested
                      ? '✓ Recommended applied'
                      : getApplyRecommendedLabel(true)}
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
                <button
                  type="button"
                  className="rd-btn-outline sm muted"
                  onClick={handleClearAll}
                  disabled={selectedWaivers.size === 0 && selectedCdcDays.size === 0}
                  title="Clear all active waivers & CDC days"
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="rd-btn-outline sm rd-copy-changes-btn"
                  onClick={handleCopyFullChangelog}
                  title="Copy complete audit log of all waivers, edits, and adjustments to clipboard"
                >
                  📋 Copy All Changes {totalAuditChanges > 0 ? `(${totalAuditChanges})` : ''}
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

            {customizationDiff.futureDates?.size > 0 && (
              <div className="rd-future-banner exp">
                <div className="rd-future-banner-text">
                  🔮 <strong>Future Speculation Active:</strong>{' '}
                  {customizationDiff.futureDates.size} upcoming date{customizationDiff.futureDates.size === 1 ? '' : 's'} simulated{' '}
                  ({customizationDiff.futureClassesStats?.total || 0} classes: {customizationDiff.futureClassesStats?.p || 0} Present, {customizationDiff.futureClassesStats?.a || 0} Absent)
                </div>
                <div className="rd-future-banner-acts">
                  {gridToolMode === 'edit' && (
                    <button
                      type="button"
                      className="rd-btn-outline xs"
                      onClick={() => { setIsAddDateModalOpen(true); setNewDateError(''); setNewDateInput(''); }}
                    >
                      + Add More
                    </button>
                  )}
                  <button
                    type="button"
                    className="rd-btn-outline xs rd-future-clear-btn"
                    onClick={handleClearFutureDates}
                    title="Remove all speculative future dates and restore current attendance"
                  >
                    ✕ Clear Future ({customizationDiff.futureDates.size})
                  </button>
                </div>
              </div>
            )}
            {gridToolMode === 'edit' && (
              <div className="rd-edit-banner exp">
                <span className="rd-edit-banner-text">
                  ✏️ <strong>Edit Mode:</strong> Click any cell to add/modify classes. Click ✕ on date headers to delete a day.
                </span>
                <div className="rd-edit-banner-acts">
                  {renderHistoryButtons()}
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
      {renderBlacklistedDatesModal()}

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
