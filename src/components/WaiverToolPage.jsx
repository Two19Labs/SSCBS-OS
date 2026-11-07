import React, { useState, useEffect, useRef, useMemo } from 'react';
import FooterCredit from './FooterCredit';
import { useAuth } from '../context/AuthContext';
import { trackWaiverEvent } from '../lib/analytics';
import { parseAttendanceFile, WEEKDAYS, MONTH_NAMES } from '../lib/waiverParser';
import {
  solveExactBnb,
  solveKPlusOne,
  calculateSimulatedStats,
  calculateDayImpactDiff
} from '../lib/waiverSolver';
import './WaiverToolPage.css';

function WaiverToolPage({ onBack }) {
  const { user } = useAuth();
  const userKey = user?.id || user?.email || 'guest';
  const storageKey = `sscbs_waiver_tool_state_v2_${userKey}`;

  // Inputs
  const [file, setFile] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [maxWaivers, setMaxWaivers] = useState(12); // K: 1 - 30
  const [threshold, setThreshold] = useState(85); // T: 50 - 99
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(null);

  // Parsed attendance data
  const [parsedData, setParsedData] = useState(null);

  // User's active selected waivers (Set of dateStr 'YYYY-MM-DD')
  const [selectedWaivers, setSelectedWaivers] = useState(new Set());

  // Solver outcome
  const [solverResult, setSolverResult] = useState(null);
  const [kPlusOneResult, setKPlusOneResult] = useState(null);

  // Active view tab: 'grid' | 'calendar' | 'list'
  const [activeTab, setActiveTab] = useState('grid');
  const [activeCalendarMonth, setActiveCalendarMonth] = useState(''); // e.g. "2026-08"

  // Hovered day tooltip for live diff preview
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

  // Restore persisted state on mount or user change
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
          if (saved.activeTab) setActiveTab(saved.activeTab);
          if (saved.activeCalendarMonth) setActiveCalendarMonth(saved.activeCalendarMonth);
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
        activeTab,
        activeCalendarMonth
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (err) {
      console.warn('Failed to persist Waiver Tool state:', err);
    }
  }, [parsedData, selectedWaivers, solverResult, kPlusOneResult, maxWaivers, threshold, fileMeta, activeTab, activeCalendarMonth, storageKey]);

  // Set initial calendar month tab when data is parsed
  useEffect(() => {
    if (parsedData && parsedData.dayColumns.length > 0 && !activeCalendarMonth) {
      const firstDate = parsedData.dayColumns[0].dateStr;
      const [y, m] = firstDate.split('-');
      setActiveCalendarMonth(`${y}-${m}`);
    }
  }, [parsedData, activeCalendarMonth]);

  const handleUploadNewSheet = () => {
    setParsedData(null);
    setFile(null);
    setFileMeta(null);
    setSelectedWaivers(new Set());
    setSolverResult(null);
    setKPlusOneResult(null);
    setError(null);
    try {
      localStorage.removeItem(storageKey);
    } catch (_) {}
  };

  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
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
        setSelectedWaivers(new Set()); // Option A: 0 days selected initially

        // Run solver
        runSolver(parsed, threshold, maxWaivers, (solution) => {
          trackWaiverEvent('solver_executed', {
            status: solution.status,
            pass_count: solution.passCount,
            total_target_parts: solution.totalTargetParts,
            days_used: solution.chosenDays.length,
            target: threshold,
            k: maxWaivers
          });
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

  // Recalculate button handler
  const handleRecalculate = () => {
    if (!parsedData) return;
    setIsProcessing(true);
    runSolver(parsedData, threshold, maxWaivers, (solution) => {
      trackWaiverEvent('solver_recalculated', {
        status: solution.status,
        target: threshold,
        k: maxWaivers
      });
    });
  };

  // Whole-day toggle (Section 2: clicking ANY cell toggles its whole DAY)
  const handleToggleDay = (dateStr) => {
    setSelectedWaivers(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  // Apply suggested days from solver
  const handleApplySuggested = () => {
    if (!solverResult?.chosenDays) return;
    const suggestedSet = new Set(solverResult.chosenDays.map(d => d.dateStr));
    setSelectedWaivers(suggestedSet);
    trackWaiverEvent('suggested_applied', { count: suggestedSet.size });
  };

  // Clear all active waivers
  const handleClearAll = () => {
    setSelectedWaivers(new Set());
    trackWaiverEvent('waivers_cleared');
  };

  // Copy dates plain-text list with weekdays (Section 7.4)
  const handleCopyDates = () => {
    if (!parsedData || selectedWaivers.size === 0) return;
    const sortedDates = Array.from(selectedWaivers).sort();
    const formatted = sortedDates.map(dateStr => {
      const col = parsedData.dayColumns.find(d => d.dateStr === dateStr);
      return col ? col.fullLabel : dateStr;
    });

    const textToCopy = formatted.join(', ');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyFeedback('Copied to clipboard!');
      setTimeout(() => setCopyFeedback(null), 2500);
      trackWaiverEvent('dates_copied', { count: sortedDates.length });
    });
  };

  // Live simulated stats calculated instantaneously on any change
  const simulatedStats = useMemo(() => {
    if (!parsedData) return null;
    return calculateSimulatedStats(parsedData, selectedWaivers, threshold);
  }, [parsedData, selectedWaivers, threshold]);

  // Compute impact diff for hovered day
  const dayImpactTooltip = useMemo(() => {
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

  // Calendar view month keys
  const calendarMonths = useMemo(() => {
    if (!parsedData?.dayColumns) return [];
    const map = new Map();
    parsedData.dayColumns.forEach(d => {
      const key = `${d.year}-${String(d.month).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, `${MONTH_NAMES[d.month - 1]} ${d.year}`);
      }
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [parsedData]);

  // Calendar blocks for active month
  const calendarBlocks = useMemo(() => {
    if (!parsedData || !activeCalendarMonth) return [];
    const [yr, mn] = activeCalendarMonth.split('-').map(Number);
    const daysInMonth = new Date(yr, mn, 0).getDate();
    const firstDayIdx = new Date(yr, mn - 1, 1).getDay(); // 0 = Sun

    const blocks = [];
    for (let i = 0; i < firstDayIdx; i++) {
      blocks.push({ type: 'empty', id: `emp-${i}` });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yr}-${String(mn).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const col = parsedData.dayColumns.find(c => c.dateStr === dateStr);

      let thTuAbs = 0;
      let thTuPres = 0;
      let prCount = 0;

      if (col) {
        parsedData.subjects.forEach(sub => {
          const classes = sub.dayClasses?.[dateStr] || [];
          classes.forEach(c => {
            if (c.type === 'th' || c.type === 'tu') {
              if (c.attended) thTuPres++;
              else thTuAbs++;
            } else if (c.type === 'pr') {
              prCount++;
            }
          });
        });
      }

      blocks.push({
        type: 'day',
        dayNum: d,
        dateStr,
        hasClasses: !!col,
        col,
        thTuAbs,
        thTuPres,
        prCount,
        id: dateStr
      });
    }

    return blocks;
  }, [parsedData, activeCalendarMonth]);

  // Render subject cards for Subject Monitor
  const renderSubjectMonitor = () => {
    if (!simulatedStats) return null;

    return (
      <div className="subjects-cards-list">
        {simulatedStats.subjectsStats.map(sub => {
          const rows = [
            { key: 'th', label: 'Theory', data: sub.parts.th },
            { key: 'tu', label: 'Tutorial', data: sub.parts.tu },
            { key: 'pr', label: 'Practical', data: sub.parts.pr }
          ];

          return (
            <div key={sub.name} className="subject-card-v2">
              <div className="subject-card-header-v2">
                <span className="subject-card-title-v2">{sub.name}</span>
                <span className="subject-card-roll-v2">{sub.rollNo}</span>
              </div>

              <div className="subject-card-body-v2">
                {rows.map(({ key, label, data }) => {
                  if (data.baseHeld === 0) return null;

                  const isPrac = key === 'pr';
                  const isPassing = data.passes;
                  const pct = data.simPct;

                  // Bar color: green only when passing (> T), amber if within 10% below T, red below that, practical grey
                  let barColor = '#10b981'; // green
                  let pctClass = 'text-green';
                  if (isPrac) {
                    barColor = '#94a3b8'; // grey
                    pctClass = 'text-muted';
                  } else if (!isPassing) {
                    if (pct >= threshold - 10) {
                      barColor = '#f59e0b'; // amber
                      pctClass = 'text-orange';
                    } else {
                      barColor = '#ef4444'; // red
                      pctClass = 'text-red';
                    }
                  }

                  return (
                    <div key={key} className="part-monitor-row">
                      <div className="part-monitor-top">
                        <div className="part-label-group">
                          <span className="part-type-name">{label}</span>
                          {isPrac && <span className="badge-info-only">info only</span>}
                          {!isPrac && isPassing && (
                            <span className="badge-passing">pass (&gt;{threshold}%)</span>
                          )}
                        </div>

                        <div className="part-metrics-group">
                          <span className="part-fraction">{data.simAttended} / {data.simHeld}</span>
                          <span className={`part-pct ${pctClass}`}>{pct.toFixed(1)}%</span>
                        </div>
                      </div>

                      {/* Bar track with threshold marker line */}
                      <div className="part-progress-track">
                        <div
                          className="part-progress-fill"
                          style={{
                            width: `${Math.min(100, Math.max(0, pct))}%`,
                            backgroundColor: barColor
                          }}
                        />
                        {!isPrac && (
                          <div
                            className="threshold-marker-line"
                            style={{ left: `${threshold}%` }}
                            title={`Target Threshold: ${threshold}%`}
                          />
                        )}
                      </div>

                      {/* Consecutive classes needed / missable buffer status */}
                      {!isPrac && (
                        <div className="part-advice-caption">
                          {isPassing ? (
                            data.missableBuffer > 0 ? (
                              <span className="text-green-dim">
                                ✓ Can miss <strong>{data.missableBuffer}</strong> more class{data.missableBuffer === 1 ? '' : 'es'} and stay passing
                              </span>
                            ) : (
                              <span className="text-orange-dim">
                                ⚠ On the edge: cannot miss any classes without dropping below {threshold}%
                              </span>
                            )
                          ) : (
                            <span className="text-red-dim">
                              ✕ Must attend <strong>{data.classesNeeded}</strong> class{data.classesNeeded === 1 ? '' : 'es'} in a row to pass
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

  return (
    <div className="waiver-tool-fullpage">
      {/* PC Recommended Advisory Banner */}
      <div className="pc-experience-banner">
        <span>💻 <strong>PC Recommended for Best Experience:</strong> The interactive spreadsheet grid and real-time simulator are built for desktop screens.</span>
      </div>

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
            SSCBS <span className="logo-accent">Waiver Assistant</span>
          </span>
          {fileMeta?.name && (
            <span className="active-file-pill" title={`Active uploaded sheet: ${fileMeta.name}`}>
              📄 {fileMeta.name}
            </span>
          )}
        </div>

        <div className="navbar-badge-area">
          <span className="navbar-portal-badge">Interactive Simulation</span>
        </div>
      </nav>

      {/* Processing Loader */}
      {isProcessing && (
        <div className="loading-screen-inline">
          <div className="loader-container">
            <span className="system-spinner"></span>
            <p>Solving optimal waiver plan...</p>
          </div>
        </div>
      )}

      {/* Upload View (Before Sheet Upload) */}
      {!parsedData ? (
        <div className="upload-view-container">
          <div className="settings-glass-panel">
            <h3>Configuration & Targets</h3>
            <p className="settings-intro">Set your desired targets before uploading your college attendance sheet.</p>

            <div className="form-group-row">
              <div className="form-item">
                <div className="slider-label-row">
                  <label htmlFor="target-threshold">Target Threshold: <strong>{threshold}%</strong></label>
                </div>
                <input
                  id="target-threshold"
                  type="range"
                  min="50"
                  max="99"
                  step="1"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
                />
                <span className="field-help">85% is the target for full attendance marks (range 50–99%)</span>
              </div>

              <div className="form-item">
                <label htmlFor="max-waivers">Max Available Waivers (K)</label>
                <input
                  id="max-waivers"
                  type="number"
                  min="1"
                  max="30"
                  value={maxWaivers}
                  onChange={(e) => setMaxWaivers(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 12)))}
                />
                <span className="field-help">Maximum number of days you can waive (1–30, default 12)</span>
              </div>
            </div>
          </div>

          <div
            className="dropzone-area"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-upload"
              accept=".xls,.xlsx"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <label htmlFor="file-upload" className="dropzone-label">
              <div className="upload-icon-pulse">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
              </div>
              {file ? (
                <div className="file-info-text">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <div className="upload-prompt">
                  <strong>Drag and drop</strong> your college attendance Excel sheet here, or <span>browse files</span>.
                  <p className="format-spec">Upload the original attendance export (.xls) directly downloaded from the portal</p>
                </div>
              )}
            </label>
          </div>

          {error && <div className="error-toast-glass">{error}</div>}

          <button
            className={`btn-optimize-run ${isProcessing ? 'loading' : ''}`}
            onClick={processAttendance}
            disabled={!file || isProcessing}
          >
            {isProcessing ? 'Analyzing Attendance...' : 'Extract & Calculate Optimal Waivers'}
          </button>
        </div>
      ) : (
        /* Workspace Layout (Post Sheet Upload) */
        <div className="fullpage-workspace-layout">
          {/* Top Horizontal Toolbar */}
          <header className="workspace-top-toolbar">
            <div className="toolbar-controls-cluster">
              <div className="toolbar-input-item">
                <label htmlFor="top-thresh">Target (%): <strong>{threshold}%</strong></label>
                <input
                  type="range"
                  id="top-thresh"
                  min="50"
                  max="99"
                  step="1"
                  value={threshold}
                  onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
                />
              </div>

              <div className="toolbar-input-item">
                <label htmlFor="top-max-w">Max Waivers (K)</label>
                <input
                  type="number"
                  id="top-max-w"
                  min="1"
                  max="30"
                  value={maxWaivers}
                  onChange={(e) => setMaxWaivers(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 12)))}
                />
              </div>

              <button className="btn-recalculate-toolbar" onClick={handleRecalculate} title="Recalculate optimal waivers">
                🔄 Recalculate
              </button>
            </div>

            {/* Metrics Cluster */}
            <div className="toolbar-metrics-cluster">
              <div className="metric-pill">
                <span className="metric-lbl">Status:</span>
                <span className={`status-tag ${simulatedStats?.isOptimal ? 'safe-tag' : 'alert-tag'}`}>
                  {simulatedStats?.isOptimal ? 'OPTIMAL' : 'SHORTAGE'}
                </span>
              </div>

              <div className="metric-pill">
                <span className="metric-lbl">Passing:</span>
                <strong className="metric-val">
                  {simulatedStats?.passingTargetCount} of {simulatedStats?.totalTargetParts} parts
                </strong>
              </div>

              <div className="metric-pill">
                <span className="metric-lbl">Lowest Part:</span>
                <strong className={`metric-val ${simulatedStats?.isOptimal ? 'safe-text' : 'alert-text'}`}>
                  {simulatedStats?.lowestPartPct ? `${simulatedStats.lowestPartPct.toFixed(1)}%` : '100%'}
                </strong>
              </div>

              <div className="metric-pill">
                <span className="metric-lbl">Dates Waived:</span>
                <strong className="metric-val">{selectedWaivers.size} / {maxWaivers}</strong>
              </div>

              {!simulatedStats?.isOptimal && kPlusOneResult && (
                <div className="metric-pill k-plus-one-pill" title="Passing parts if you can get one more waiver date">
                  <span className="metric-lbl">With K+1 waivers:</span>
                  <strong>{kPlusOneResult.passCount} of {kPlusOneResult.totalTargetParts} pass</strong>
                </div>
              )}
            </div>

            {/* Actions Cluster */}
            <div className="toolbar-actions-cluster">
              <button
                className="btn-toolbar-primary"
                onClick={handleApplySuggested}
                title="Apply suggested optimal days from solver"
              >
                Apply Suggested ({solverResult?.chosenDays?.length || 0})
              </button>
              <button className="btn-toolbar-sec" onClick={handleClearAll} title="Clear all active waived dates">
                Clear All
              </button>
              <button
                className="btn-toolbar-copy"
                onClick={handleCopyDates}
                disabled={selectedWaivers.size === 0}
                title="Copy plain-text list of selected waiver dates"
              >
                📋 {copyFeedback || 'Copy Dates'}
              </button>
              <button className="btn-toolbar-upload" onClick={handleUploadNewSheet} title="Upload a new attendance sheet">
                📄 New Sheet
              </button>
            </div>
          </header>

          {/* Main 2-Column Split: Left = Interactive Views, Right = Subject Monitor */}
          <div className="workspace-columns-grid">
            {/* Left Pane */}
            <div className="workspace-left-pane">
              <div className="results-card-glass customizer-card-container">
                {/* 3 View Tabs: Grid, Calendar, List (side-by-side removed per instruction) */}
                <div className="selector-view-tabs-row">
                  <div className="selector-view-tabs">
                    <button
                      className={`tab-btn ${activeTab === 'grid' ? 'active' : ''}`}
                      onClick={() => setActiveTab('grid')}
                    >
                      📊 Spreadsheet Grid
                    </button>
                    <button
                      className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
                      onClick={() => setActiveTab('calendar')}
                    >
                      📅 Calendar View
                    </button>
                    <button
                      className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
                      onClick={() => setActiveTab('list')}
                    >
                      📋 Recommended List
                    </button>
                  </div>
                  <div className="tab-quick-info">
                    <span>Click any cell to toggle its whole day</span>
                  </div>
                </div>

                {/* Tab 1: Spreadsheet Grid */}
                {activeTab === 'grid' && (
                  <div className="attendance-grid-container">
                    <div className="grid-scroll-wrapper">
                      <table className="attendance-spreadsheet-table">
                        <thead>
                          <tr className="header-month-row">
                            <th rowSpan={2} className="sticky-col subject-header">Subject Name</th>
                            {monthGroups.map(g => (
                              <th key={g.key} colSpan={g.dates.length} className="month-group-header">
                                {g.monthName.toUpperCase()} {g.year}
                              </th>
                            ))}
                            <th rowSpan={2} className="sticky-col-right stats-header">
                              <div className="header-stacked">
                                <span>Simulated</span>
                                <span>Pres / Held</span>
                              </div>
                            </th>
                            <th rowSpan={2} className="sticky-col-right pct-header">%</th>
                          </tr>
                          <tr className="header-days-row">
                            {parsedData.dayColumns.map(d => {
                              const isChecked = selectedWaivers.has(d.dateStr);
                              const isRecommended = solverResult?.chosenDays?.some(cd => cd.dateStr === d.dateStr);

                              return (
                                <th
                                  key={d.dateStr}
                                  className={`date-header-cell ${isChecked ? 'waived' : ''} ${isRecommended ? 'recommended' : ''}`}
                                  onClick={() => handleToggleDay(d.dateStr)}
                                  onMouseEnter={(e) => {
                                    setHoveredDay(d.dateStr);
                                    setTooltipPos({ x: e.clientX, y: e.clientY });
                                  }}
                                  onMouseLeave={() => setHoveredDay(null)}
                                  title={`${d.fullLabel}: Click to toggle day waiver`}
                                >
                                  <div className="header-weekday-label">{d.weekday}</div>
                                  <div className="header-date-label">{d.dayNum}</div>
                                  {isChecked && <span className="waiver-pill-indicator">W</span>}
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {simulatedStats?.subjectsStats?.map((sub, sIdx) => {
                            const rawSubject = parsedData.subjects[sIdx];
                            const thStats = sub.parts.th;
                            const tuStats = sub.parts.tu;
                            const prStats = sub.parts.pr;

                            // Overall simulated present / held across all parts
                            const totalSimAtt = thStats.simAttended + tuStats.simAttended + prStats.simAttended;
                            const totalSimHeld = thStats.simHeld + tuStats.simHeld + prStats.simHeld;
                            const overallSimPct = totalSimHeld > 0 ? (totalSimAtt / totalSimHeld) * 100 : 100;
                            const totalBaseAtt = thStats.baseAtt + tuStats.baseAtt + prStats.baseAtt;
                            const totalBaseHeld = thStats.baseHeld + tuStats.baseHeld + prStats.baseHeld;
                            const overallBasePct = totalBaseHeld > 0 ? (totalBaseAtt / totalBaseHeld) * 100 : 100;

                            const overallPass = (thStats.baseHeld === 0 || thStats.passes) && (tuStats.baseHeld === 0 || tuStats.passes);

                            return (
                              <tr key={sub.name}>
                                <td className="sticky-col subject-cell">
                                  <div className="sub-name">{sub.name}</div>
                                  <div className="sub-roll txt-muted">Roll: {sub.rollNo}</div>
                                </td>

                                {parsedData.dayColumns.map(d => {
                                  const dayClasses = rawSubject?.dayClasses?.[d.dateStr] || [];
                                  const isChecked = selectedWaivers.has(d.dateStr);

                                  return (
                                    <td
                                      key={d.dateStr}
                                      className={`attendance-cell ${isChecked ? 'waived-cell' : ''}`}
                                      onClick={() => handleToggleDay(d.dateStr)}
                                      onMouseEnter={(e) => {
                                        setHoveredDay(d.dateStr);
                                        setTooltipPos({ x: e.clientX, y: e.clientY });
                                      }}
                                      onMouseLeave={() => setHoveredDay(null)}
                                      title={`${d.fullLabel}: Click to toggle day waiver`}
                                    >
                                      {dayClasses.length === 0 ? (
                                        <span className="no-class">-</span>
                                      ) : (
                                        <div className="cell-classes-stack">
                                          {dayClasses.map((cls, cIdx) => (
                                            <span
                                              key={cIdx}
                                              className={`class-badge ${cls.attended ? 'present' : 'absent'} ${cls.type}`}
                                            >
                                              {cls.attended ? 'P' : 'A'}
                                              <sub className="type-sub">{cls.type.toUpperCase()}</sub>
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}

                                <td className="sticky-col-right stats-cell">
                                  <span className="bold">{totalSimAtt}/{totalSimHeld}</span>
                                  <span className="txt-muted block-size">({totalBaseAtt}/{totalBaseHeld})</span>
                                </td>
                                <td className={`sticky-col-right pct-cell bold ${overallPass ? 'text-green' : 'text-red'}`}>
                                  <span>{overallSimPct.toFixed(1)}%</span>
                                  <span className="txt-muted block-size font-normal">({overallBasePct.toFixed(1)}%)</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab 2: Calendar View */}
                {activeTab === 'calendar' && (
                  <div className="calendar-simulation-view">
                    <div className="calendar-month-tabs">
                      {calendarMonths.map(m => (
                        <button
                          key={m.key}
                          className={`month-tab-btn ${activeCalendarMonth === m.key ? 'active' : ''}`}
                          onClick={() => setActiveCalendarMonth(m.key)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    <div className="calendar-week-headers">
                      <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                    </div>

                    <div className="calendar-days-grid">
                      {calendarBlocks.map(block => {
                        if (block.type === 'empty') {
                          return <div key={block.id} className="calendar-day-cell empty"></div>;
                        }

                        const isChecked = selectedWaivers.has(block.dateStr);
                        const isRecommended = solverResult?.chosenDays?.some(cd => cd.dateStr === block.dateStr);

                        let cellClass = 'calendar-day-cell';
                        if (!block.hasClasses) {
                          cellClass += ' inactive';
                        } else {
                          cellClass += ' active-day';
                          if (isChecked) cellClass += ' waived';
                          if (isRecommended) cellClass += ' recommended-cell';
                        }

                        return (
                          <div
                            key={block.id}
                            className={cellClass}
                            onClick={() => block.hasClasses && handleToggleDay(block.dateStr)}
                            onMouseEnter={(e) => {
                              if (block.hasClasses) {
                                setHoveredDay(block.dateStr);
                                setTooltipPos({ x: e.clientX, y: e.clientY });
                              }
                            }}
                            onMouseLeave={() => setHoveredDay(null)}
                          >
                            <span className="day-number">{block.dayNum}</span>
                            {block.hasClasses && (
                              <div className="day-dot-indicators">
                                {block.thTuAbs > 0 && (
                                  <span className="abs-dot-count" title={`${block.thTuAbs} Theory/Tute absence(s)`}>
                                    {block.thTuAbs}A
                                  </span>
                                )}
                                {block.thTuPres > 0 && (
                                  <span className="pres-dot-count" title={`${block.thTuPres} Theory/Tute present`}>
                                    {block.thTuPres}P
                                  </span>
                                )}
                              </div>
                            )}
                            {isChecked && <span className="waived-cell-indicator">W</span>}
                          </div>
                        );
                      })}
                    </div>

                    <div className="calendar-legend-row">
                      <div className="legend-item"><span className="legend-dot red"></span>Absence</div>
                      <div className="legend-item"><span className="legend-dot green"></span>Present</div>
                      <div className="legend-item"><span className="legend-dot blue"></span>Waived (W)</div>
                    </div>
                  </div>
                )}

                {/* Tab 3: Recommended List View */}
                {activeTab === 'list' && (
                  <div className="recommended-list-view">
                    <div className="card-header-row pt-0">
                      <div className="title-block">
                        <h3>Recommended Waiver Dates</h3>
                        <p className="subtitle">
                          {solverResult?.status === 'OPTIMAL' ? (
                            <span>Optimal combination clears target using <strong>{solverResult.chosenDays.length}</strong> waivers.</span>
                          ) : (
                            <span className="text-orange">Maximum waivers reached. Best available plan shown.</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="recommended-cards-column">
                      {solverResult?.chosenDays?.length === 0 ? (
                        <div className="empty-waivers-notice">
                          <p>All target subjects are already passing at &gt;{threshold}%! No waivers needed.</p>
                        </div>
                      ) : (
                        solverResult?.chosenDays?.map(d => {
                          const isChecked = selectedWaivers.has(d.dateStr);
                          const diff = calculateDayImpactDiff(d.dateStr, parsedData, selectedWaivers, threshold);

                          return (
                            <div
                              key={d.dateStr}
                              className={`recommended-day-card ${isChecked ? 'active' : ''}`}
                              onClick={() => handleToggleDay(d.dateStr)}
                            >
                              <div className="rec-card-top">
                                <div className="rec-card-date-group">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {}}
                                    id={`chk-${d.dateStr}`}
                                  />
                                  <label htmlFor={`chk-${d.dateStr}`} onClick={(e) => e.stopPropagation()}></label>
                                  <strong className="rec-date-text">{d.fullLabel}</strong>
                                </div>

                                <div className="rec-card-badges">
                                  <span className="badge-absences-removed">
                                    -{d.thOrTuAbsences} Absences
                                  </span>
                                  {d.totalPresents > 0 && (
                                    <span className="badge-presents-removed">
                                      -{d.totalPresents} Presents
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Diff description */}
                              <div className="rec-card-diffs-list">
                                {diff.partDiffs.map(pd => (
                                  <div key={pd.label} className={`rec-diff-row ${pd.dropped ? 'dropped-part' : ''}`}>
                                    <span className="diff-part-name">{pd.label}:</span>
                                    <span className="diff-pct-shift">
                                      {pd.beforePct.toFixed(1)}% → <strong>{pd.afterPct.toFixed(1)}%</strong>
                                      <span className={`diff-delta ${pd.delta >= 0 ? 'text-green' : 'text-red'}`}>
                                        ({pd.delta >= 0 ? '+' : ''}{pd.delta.toFixed(1)}%)
                                      </span>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Pane: Subject Monitor */}
            <div className="workspace-right-pane">
              <div className="results-card-glass subjects-summary-card">
                <div className="card-header-row">
                  <div className="title-block">
                    <h3>Subject Monitor</h3>
                    <p className="subtitle">Real-time attendance simulator across Theory, Tutorial & Practical</p>
                  </div>
                  <div className="summary-header-right-cluster">
                    <div className={`status-pill ${simulatedStats?.isOptimal ? 'safe' : 'alert'}`}>
                      {simulatedStats?.isOptimal ? 'ALL SAFE (>85%)' : 'SHORTAGE DETECTED'}
                    </div>
                  </div>
                </div>

                {renderSubjectMonitor()}

                {/* Required Legal Disclaimers (Section 7.5) */}
                <div className="subjects-disclaimers-box">
                  <p>📌 <strong>A waiver removes every class that day,</strong> including the ones you attended.</p>
                  <p>⏳ <strong>Waivers are applied at the end of the semester,</strong> so your portal won't show them yet.</p>
                  <p>⚖️ <strong>Estimates based on your file.</strong> The college's final records decide.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Hover Impact Preview Tooltip (Section 7.1) */}
      {hoveredDay && dayImpactTooltip && (
        <div
          className="day-impact-popover"
          style={{
            position: 'fixed',
            left: `${Math.min(window.innerWidth - 320, Math.max(10, tooltipPos.x + 15))}px`,
            top: `${Math.min(window.innerHeight - 250, Math.max(10, tooltipPos.y + 15))}px`,
            zIndex: 9999
          }}
        >
          <div className="popover-header">
            <strong>{dayImpactTooltip.isCurrentlyWaived ? 'Unwaiving' : 'Waiving'} {hoveredDay}</strong>
          </div>
          <div className="popover-removals">
            <span>Removes: <strong>{dayImpactTooltip.thTuAbsencesRemoved}</strong> absences, <strong>{dayImpactTooltip.thTuPresentsRemoved}</strong> presents</span>
            {dayImpactTooltip.practicalAbsencesRemoved + dayImpactTooltip.practicalPresentsRemoved > 0 && (
              <span className="popover-sub-text">
                +{dayImpactTooltip.practicalAbsencesRemoved + dayImpactTooltip.practicalPresentsRemoved} practical classes (info only)
              </span>
            )}
          </div>
          <div className="popover-diffs-list">
            {dayImpactTooltip.partDiffs.length === 0 ? (
              <span className="text-muted">No attendance changes for target components.</span>
            ) : (
              dayImpactTooltip.partDiffs.map(pd => (
                <div key={pd.label} className={`popover-diff-item ${pd.dropped ? 'dropped' : ''}`}>
                  <span className="part-short-label">{pd.label}</span>
                  <span className="part-shift-vals">
                    {pd.beforePct.toFixed(1)}% → <strong>{pd.afterPct.toFixed(1)}%</strong>
                    <span className={pd.delta >= 0 ? 'text-green' : 'text-red'}>
                      ({pd.delta >= 0 ? '+' : ''}{pd.delta.toFixed(1)}%)
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <FooterCredit />
    </div>
  );
}

export default WaiverToolPage;
