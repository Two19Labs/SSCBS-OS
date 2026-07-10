import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import './WaiverToolPage.css';

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function WaiverToolPage({ onBack }) {
  const [file, setFile] = useState(null);
  const [startingMonth, setStartingMonth] = useState(0); // 0 = Jan
  const [maxWaivers, setMaxWaivers] = useState(12);
  const [threshold, setThreshold] = useState(85);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Parsed attendance data
  const [parsedData, setParsedData] = useState(null);
  // User's active selected waivers (set of dateStr)
  const [selectedWaivers, setSelectedWaivers] = useState(new Set());
  // Recommended optimal waivers
  const [recommendedWaivers, setRecommendedWaivers] = useState([]);
  const [solverResult, setSolverResult] = useState(null); // { success: boolean, waiversCount: number }

  // Clean error on changes
  useEffect(() => {
    setError(null);
  }, [file, startingMonth, maxWaivers, threshold]);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Main parser runner
  const processAttendance = () => {
    if (!file) {
      setError("Please select or drop an attendance file first.");
      return;
    }
    setIsProcessing(true);
    setError(null);

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        const arr = new Uint8Array(buffer);
        
        let isHtml = false;
        let encoding = 'utf-8';

        // 1. Detect UTF-16LE BOM (0xFF, 0xFE)
        if (arr[0] === 0xFF && arr[1] === 0xFE) {
          encoding = 'utf-16le';
          const sample = new TextDecoder('utf-16le').decode(arr.subarray(0, Math.min(arr.length, 1000)));
          if (sample.toLowerCase().includes('<table')) {
            isHtml = true;
          }
        } else if (arr[0] === 0xFE && arr[1] === 0xFF) {
          encoding = 'utf-16be';
          const sample = new TextDecoder('utf-16be').decode(arr.subarray(0, Math.min(arr.length, 1000)));
          if (sample.toLowerCase().includes('<table')) {
            isHtml = true;
          }
        } else {
          // Check standard UTF-8 / ASCII
          const sample = new TextDecoder('utf-8').decode(arr.subarray(0, Math.min(arr.length, 1000)));
          if (sample.toLowerCase().includes('<table')) {
            isHtml = true;
          }
        }

        if (isHtml) {
          const text = new TextDecoder(encoding).decode(arr);
          parseHtmlSpreadsheet(text);
        } else {
          parseBinarySpreadsheet(buffer);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to parse the file. Please ensure it is a valid attendance report exported from the college portal.");
        setIsProcessing(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Helper to extract nested cell text
  const extractNestedClasses = (cellHtml) => {
    const list = [];
    const cellTdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let match;
    while ((match = cellTdRegex.exec(cellHtml)) !== null) {
      const val = match[1].replace(/<[^>]*>/g, '').trim(); // strip inner tags if any
      if (val) list.push(val);
    }
    return list;
  };

  // Custom HTML table parser for malformed ERP exports
  const parseHtmlSpreadsheet = (htmlText) => {
    // Strip comments which contain commented <th> elements
    const cleanHtml = htmlText.replace(/<!--[\s\S]*?-->/g, '');

    // Nesting-aware walker to find top-level TR tags
    const outerRows = [];
    let idx = 0;
    let tableNesting = 0;
    let insideTr = false;
    let currentTrContent = "";

    while (idx < cleanHtml.length) {
      const next6 = cleanHtml.substring(idx, idx + 6).toLowerCase();
      const next8 = cleanHtml.substring(idx, idx + 8).toLowerCase();
      const next3 = cleanHtml.substring(idx, idx + 3).toLowerCase();
      const next5 = cleanHtml.substring(idx, idx + 5).toLowerCase();

      if (next6 === "<table") {
        tableNesting++;
        if (insideTr) currentTrContent += "<table";
        idx += 6;
        continue;
      }
      if (next8 === "</table>") {
        tableNesting--;
        if (insideTr) currentTrContent += "</table>";
        idx += 8;
        continue;
      }
      if (next3 === "<tr" && tableNesting === 1) {
        insideTr = true;
        currentTrContent = "<tr";
        idx += 3;
        continue;
      }
      if (next5 === "</tr>" && tableNesting === 1 && insideTr) {
        insideTr = false;
        currentTrContent += "</tr>";
        outerRows.push(currentTrContent);
        idx += 5;
        continue;
      }
      if (insideTr) {
        currentTrContent += cleanHtml[idx];
      }
      idx++;
    }

    if (outerRows.length < 2) {
      throw new Error("No outer table rows found in attendance file.");
    }

    // Helper to parse cells from TR
    const parseCells = (rowHtml) => {
      const cells = [];
      let cIdx = 0;
      let cellNesting = 0;
      let insideCell = false;
      let cellTag = "";
      let currentCellContent = "";

      while (cIdx < rowHtml.length) {
        const next6 = rowHtml.substring(cIdx, cIdx + 6).toLowerCase();
        const next8 = rowHtml.substring(cIdx, cIdx + 8).toLowerCase();
        const next3 = rowHtml.substring(cIdx, cIdx + 3).toLowerCase();
        const next5 = rowHtml.substring(cIdx, cIdx + 5).toLowerCase();

        if (next6 === "<table") {
          cellNesting++;
          currentCellContent += "<table";
          cIdx += 6;
          continue;
        }
        if (next8 === "</table>") {
          cellNesting--;
          currentCellContent += "</table>";
          cIdx += 8;
          continue;
        }
        if (cellNesting === 0 && !insideCell && (next3 === "<td" || next3 === "<th")) {
          insideCell = true;
          cellTag = rowHtml.substring(cIdx + 1, cIdx + 3).toLowerCase();
          currentCellContent = "";
          while (rowHtml[cIdx] !== ">" && cIdx < rowHtml.length) {
            cIdx++;
          }
          cIdx++;
          continue;
        }
        if (cellNesting === 0 && insideCell && next5 === `</${cellTag}>`) {
          insideCell = false;
          cells.push(currentCellContent.trim().replace(/\s+/g, ' '));
          cIdx += 5;
          continue;
        }
        if (insideCell) {
          currentCellContent += rowHtml[cIdx];
        }
        cIdx++;
      }
      return cells;
    };

    // Header cells
    const headerCells = parseCells(outerRows[0]).map(h => h.replace(/<[^>]*>/g, '').trim());

    if (headerCells.length < 5) {
      throw new Error("Invalid header structure.");
    }

    // Map columns 3 to N-2 as dates (last two columns are total present/absent)
    const dateColsCount = headerCells.length - 5;
    const totalPresentIdx = headerCells.length - 2;
    const totalAbsentIdx = headerCells.length - 1;
    
    // Reconstruct dates mapping starting from the chosen Starting Month
    let currentMonthOffset = startingMonth;
    let lastDateVal = 0;
    const parsedDates = [];

    for (let c = 3; c < totalPresentIdx; c++) {
      const dateVal = parseInt(headerCells[c], 10);
      if (isNaN(dateVal)) continue;

      if (dateVal < lastDateVal) {
        currentMonthOffset = (currentMonthOffset + 1) % 12;
      }
      lastDateVal = dateVal;

      // Inferred date label
      const monthLabel = MONTHS[currentMonthOffset];
      const dateStr = `2026-${String(currentMonthOffset + 1).padStart(2, '0')}-${String(dateVal).padStart(2, '0')}`;

      parsedDates.push({
        colIdx: c,
        dateStr,
        label: `${dateVal} ${monthLabel.substring(0, 3)}`
      });
    }

    // Parse subjects rows
    const parsedSubjects = [];
    for (let r = 1; r < outerRows.length; r++) {
      const cells = parseCells(outerRows[r]);
      if (cells.length < headerCells.length) continue;

      const subjectName = cells[1];
      const rollNo = cells[2];
      const reportedPresent = parseInt(cells[totalPresentIdx], 10);
      const reportedAbsent = parseInt(cells[totalAbsentIdx], 10);

      // Baseline arrays
      const dateAttendanceMap = {};
      let baselineThAttended = 0;
      let baselineThHeld = 0;
      let baselineTuAttended = 0;
      let baselineTuHeld = 0;
      let baselinePrAttended = 0;
      let baselinePrHeld = 0;

      parsedDates.forEach(d => {
        const cellHtml = cells[d.colIdx] || "";
        const classes = extractNestedClasses(cellHtml);

        const dateRecord = [];

        classes.forEach(c => {
          if (c === 'P( Th)') {
            baselineThAttended++;
            baselineThHeld++;
            dateRecord.push({ type: 'Th', attended: true });
          } else if (c === 'A( Th)') {
            baselineThHeld++;
            dateRecord.push({ type: 'Th', attended: false });
          } else if (c === 'P( tu)') {
            baselineTuAttended++;
            baselineTuHeld++;
            dateRecord.push({ type: 'tu', attended: true });
          } else if (c === 'A( tu)') {
            baselineTuHeld++;
            dateRecord.push({ type: 'tu', attended: false });
          } else if (c === 'P( PR)') {
            baselinePrAttended++;
            baselinePrHeld++;
            dateRecord.push({ type: 'PR', attended: true });
          } else if (c === 'A( PR)') {
            baselinePrHeld++;
            dateRecord.push({ type: 'PR', attended: false });
          }
        });

        if (dateRecord.length > 0) {
          dateAttendanceMap[d.dateStr] = dateRecord;
        }
      });

      parsedSubjects.push({
        name: subjectName,
        rollNo,
        reportedPresent,
        reportedAbsent,
        baselineStats: {
          Th: { attended: baselineThAttended, held: baselineThHeld },
          tu: { attended: baselineTuAttended, held: baselineTuHeld },
          PR: { attended: baselinePrAttended, held: baselinePrHeld }
        },
        dateAttendance: dateAttendanceMap
      });
    }

    finalizeData(parsedDates, parsedSubjects);
  };

  // Fallback XLSX parser (reading binary sheets)
  const parseBinarySpreadsheet = (arrayBuffer) => {
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // SheetJS sheet_to_json
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    // We assume the first row represents headers
    if (rows.length < 2) {
      throw new Error("No attendance data rows found.");
    }

    const headerRow = rows[0].map(c => String(c || '').trim());
    const totalPresentIdx = headerRow.findIndex(h => h.toLowerCase().includes('present'));
    const totalAbsentIdx = headerRow.findIndex(h => h.toLowerCase().includes('absent'));

    if (totalPresentIdx === -1 || totalAbsentIdx === -1) {
      throw new Error("Could not locate 'Total Present' or 'Total Absent' summary columns.");
    }

    // Dates columns: index 3 to totalPresentIdx - 1
    const parsedDates = [];
    let currentMonthOffset = startingMonth;
    let lastDateVal = 0;

    for (let c = 3; c < totalPresentIdx; c++) {
      const cellVal = headerRow[c];
      const dateVal = parseInt(cellVal, 10);
      if (isNaN(dateVal)) continue;

      if (dateVal < lastDateVal) {
        currentMonthOffset = (currentMonthOffset + 1) % 12;
      }
      lastDateVal = dateVal;

      const monthLabel = MONTHS[currentMonthOffset];
      const dateStr = `2026-${String(currentMonthOffset + 1).padStart(2, '0')}-${String(dateVal).padStart(2, '0')}`;

      parsedDates.push({
        colIdx: c,
        dateStr,
        label: `${dateVal} ${monthLabel.substring(0, 3)}`
      });
    }

    const parsedSubjects = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0 || !row[1]) continue;

      const subjectName = String(row[1]).trim();
      const rollNo = String(row[2] || '').trim();
      const reportedPresent = parseInt(row[totalPresentIdx], 10) || 0;
      const reportedAbsent = parseInt(row[totalAbsentIdx], 10) || 0;

      const dateAttendanceMap = {};
      let baselineThAttended = 0;
      let baselineThHeld = 0;
      let baselineTuAttended = 0;
      let baselineTuHeld = 0;
      let baselinePrAttended = 0;
      let baselinePrHeld = 0;

      parsedDates.forEach(d => {
        const val = String(row[d.colIdx] || '').trim();
        if (!val) return;

        const tokens = val.split(/[,\s+]+/).map(t => t.trim()).filter(Boolean);
        const dateRecord = [];

        tokens.forEach(token => {
          if (token.includes('P(Th)')) {
            baselineThAttended++;
            baselineThHeld++;
            dateRecord.push({ type: 'Th', attended: true });
          } else if (token.includes('A(Th)')) {
            baselineThHeld++;
            dateRecord.push({ type: 'Th', attended: false });
          } else if (token.includes('P(tu)')) {
            baselineTuAttended++;
            baselineTuHeld++;
            dateRecord.push({ type: 'tu', attended: true });
          } else if (token.includes('A(tu)')) {
            baselineTuHeld++;
            dateRecord.push({ type: 'tu', attended: false });
          } else if (token.includes('P(PR)') || token.includes('P(Prac)')) {
            baselinePrAttended++;
            baselinePrHeld++;
            dateRecord.push({ type: 'PR', attended: true });
          } else if (token.includes('A(PR)') || token.includes('A(Prac)')) {
            baselinePrHeld++;
            dateRecord.push({ type: 'PR', attended: false });
          }
        });

        if (dateRecord.length > 0) {
          dateAttendanceMap[d.dateStr] = dateRecord;
        }
      });

      parsedSubjects.push({
        name: subjectName,
        rollNo,
        reportedPresent,
        reportedAbsent,
        baselineStats: {
          Th: { attended: baselineThAttended, held: baselineThHeld },
          tu: { attended: baselineTuAttended, held: baselineTuHeld },
          PR: { attended: baselinePrAttended, held: baselinePrHeld }
        },
        dateAttendance: dateAttendanceMap
      });
    }

    finalizeData(parsedDates, parsedSubjects);
  };

  // Compile final results & execute solver
  const finalizeData = (parsedDates, parsedSubjects) => {
    // Filter out subjects that have 0 Th classes AND 0 tu classes
    const monitoredSubjects = parsedSubjects.filter(sub => 
      sub.baselineStats.Th.held > 0 || sub.baselineStats.tu.held > 0
    );

    const targetGroups = [];
    monitoredSubjects.forEach((sub) => {
      if (sub.baselineStats.Th.held > 0) {
        targetGroups.push({
          subjectName: sub.name,
          type: "Theory",
          baselineAttended: sub.baselineStats.Th.attended,
          baselineHeld: sub.baselineStats.Th.held,
          key: `${sub.name}-Th`
        });
      }
      if (sub.baselineStats.tu.held > 0) {
        targetGroups.push({
          subjectName: sub.name,
          type: "Tutorial",
          baselineAttended: sub.baselineStats.tu.attended,
          baselineHeld: sub.baselineStats.tu.held,
          key: `${sub.name}-tu`
        });
      }
    });

    // 2. Pre-calculate date-wise stats for the groups
    const datesWithAbsences = [];
    
    parsedDates.forEach(d => {
      let absencesCount = 0;
      let presentsCount = 0;
      
      const groupEffects = targetGroups.map(g => {
        let attended = 0;
        let held = 0;
        
        const sub = parsedSubjects.find(s => s.name === g.subjectName);
        const dayRecord = sub.dateAttendance[d.dateStr] || [];
        
        dayRecord.forEach(cls => {
          if (g.type === "Theory" && cls.type === "Th") {
            held++;
            if (cls.attended) {
              attended++;
              presentsCount++;
            } else {
              absencesCount++;
            }
          } else if (g.type === "Tutorial" && cls.type === "tu") {
            held++;
            if (cls.attended) {
              attended++;
              presentsCount++;
            } else {
              absencesCount++;
            }
          }
        });
        
        return { attended, held };
      });

      if (absencesCount > 0) {
        datesWithAbsences.push({
          dateStr: d.dateStr,
          label: d.label,
          groupEffects,
          totalAbsences: absencesCount,
          totalPresents: presentsCount
        });
      }
    });

    // 3. Run Optimization Solver
    const targetRatio = threshold / 100;
    
    // Sort candidate days: High absences first
    const highAbsence = datesWithAbsences.filter(c => c.totalAbsences >= 2);
    const lowAbsence = datesWithAbsences.filter(c => c.totalAbsences === 1);
    
    let bestMinRatio = -1;
    let bestWaivers = [];
    let solverSuccess = false;

    const checkSolution = (selectedCandidates) => {
      const adjusted = targetGroups.map((g, gIdx) => {
        let attended = g.baselineAttended;
        let held = g.baselineHeld;
        
        selectedCandidates.forEach(c => {
          const eff = c.groupEffects[gIdx];
          attended -= eff.attended;
          held -= eff.held;
        });
        
        const pct = held > 0 ? (attended / held) : 1.0;
        return pct;
      });
      
      const allClear = adjusted.every(pct => pct >= targetRatio);
      const minPct = Math.min(...adjusted);
      return { allClear, minPct };
    };

    let solvedSize = 99;
    
    for (let size = 1; size <= maxWaivers; size++) {
      let foundSolution = false;
      const solutions = [];

      const maxHighToCheck = Math.min(size, highAbsence.length);
      const minHighToCheck = Math.max(0, size - lowAbsence.length);

      for (let hc = maxHighToCheck; hc >= minHighToCheck; hc--) {
        if (foundSolution) break;
        const lc = size - hc;
        
        const hcCombos = [];
        const getHcCombos = (start, curr) => {
          if (curr.length === hc) {
            hcCombos.push([...curr]);
            return;
          }
          for (let i = start; i < highAbsence.length; i++) {
            curr.push(highAbsence[i]);
            getHcCombos(i + 1, curr);
            curr.pop();
          }
        };
        getHcCombos(0, []);

        const lcCombos = [];
        const getLcCombos = (start, curr) => {
          if (curr.length === lc) {
            lcCombos.push([...curr]);
            return;
          }
          if (lcCombos.length > 5000) return; 
          for (let i = start; i < lowAbsence.length; i++) {
            curr.push(lowAbsence[i]);
            getLcCombos(i + 1, curr);
            curr.pop();
          }
        };
        getLcCombos(0, []);

        for (let hCombo of hcCombos) {
          for (let lCombo of lcCombos) {
            const selected = [...hCombo, ...lCombo];
            const evalRes = checkSolution(selected);
            if (evalRes.allClear) {
              solutions.push({
                combo: selected,
                minPct: evalRes.minPct
              });
              foundSolution = true;
            }
          }
        }
      }

      if (foundSolution) {
        solutions.sort((a, b) => b.minPct - a.minPct);
        bestWaivers = solutions[0].combo;
        bestMinRatio = solutions[0].minPct;
        solvedSize = size;
        solverSuccess = true;
        break;
      }
    }

    if (!solverSuccess) {
      let currentSelected = [];
      const tempCandidates = [...datesWithAbsences];

      for (let step = 0; step < maxWaivers; step++) {
        let bestIdx = -1;
        let highestMinPct = -1;
        
        for (let i = 0; i < tempCandidates.length; i++) {
          if (currentSelected.includes(tempCandidates[i])) continue;
          currentSelected.push(tempCandidates[i]);
          const evalRes = checkSolution(currentSelected);
          currentSelected.pop();
          
          if (evalRes.minPct > highestMinPct) {
            highestMinPct = evalRes.minPct;
            bestIdx = i;
          }
        }

        if (bestIdx !== -1) {
          currentSelected.push(tempCandidates[bestIdx]);
        }
      }
      bestWaivers = currentSelected;
      const finalEval = checkSolution(bestWaivers);
      bestMinRatio = finalEval.minPct;
      solvedSize = maxWaivers;
      solverSuccess = false;
    }

    const recDates = bestWaivers.map(w => w.dateStr);
    setRecommendedWaivers(recDates);
    setSelectedWaivers(new Set(recDates));
    setSolverResult({
      success: solverSuccess,
      waiversCount: solvedSize,
      minPctAchieved: bestMinRatio * 100
    });

    setParsedData({
      allDates: parsedDates,
      allSubjects: parsedSubjects,
      targetGroups,
      candidates: datesWithAbsences
    });

    setIsProcessing(false);
  };

  const getSimulatedStats = () => {
    if (!parsedData) return [];

    return parsedData.targetGroups.map(g => {
      let attended = g.baselineAttended;
      let held = g.baselineHeld;
      
      selectedWaivers.forEach(dateStr => {
        const cand = parsedData.candidates.find(c => c.dateStr === dateStr);
        if (!cand) return;
        
        const gIdx = parsedData.targetGroups.findIndex(tg => tg.key === g.key);
        const eff = cand.groupEffects[gIdx];
        attended -= eff.attended;
        held -= eff.held;
      });

      const pct = held > 0 ? (attended / held * 100) : 100;
      const baselinePct = g.baselineHeld > 0 ? (g.baselineAttended / g.baselineHeld * 100) : 100;
      
      return {
        ...g,
        baselinePct,
        baselineAttended: g.baselineAttended,
        baselineHeld: g.baselineHeld,
        simPct: pct,
        simAttended: attended,
        simHeld: held
      };
    });
  };

  const handleCheckboxChange = (dateStr) => {
    const updated = new Set(selectedWaivers);
    if (updated.has(dateStr)) {
      updated.delete(dateStr);
    } else {
      updated.add(dateStr);
    }
    setSelectedWaivers(updated);
  };

  const resetToRecommended = () => {
    setSelectedWaivers(new Set(recommendedWaivers));
  };

  const clearAllWaivers = () => {
    setSelectedWaivers(new Set());
  };

  const simulatedStats = getSimulatedStats();
  const allSafe = simulatedStats.every(s => s.simPct >= threshold);

  return (
    <div className="waiver-tool-page">
      <div className="page-header-row">
        <button className="btn-back-glow" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Workspace
        </button>
        <h2>SSCBS Attendance Waiver Assistant</h2>
      </div>

      {!parsedData ? (
        <div className="upload-view-container">
          <div className="settings-glass-panel">
            <h3>Configuration Panel</h3>
            <p className="settings-intro">Set up your semester targets and waiver constraints before uploading your sheet.</p>
            
            <div className="form-group-row">
              <div className="form-item">
                <label htmlFor="starting-month">Starting Month</label>
                <select 
                  id="starting-month" 
                  value={startingMonth} 
                  onChange={(e) => setStartingMonth(parseInt(e.target.value))}
                >
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx}>{m}</option>
                  ))}
                </select>
                <span className="field-help">Semester commencement anchor</span>
              </div>

              <div className="form-item">
                <label htmlFor="max-waivers">Max Available Waivers</label>
                <input 
                  id="max-waivers"
                  type="number" 
                  min="1" 
                  max="30" 
                  value={maxWaivers} 
                  onChange={(e) => setMaxWaivers(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <span className="field-help">Maximum dates you can waive</span>
              </div>

              <div className="form-item">
                <label htmlFor="target-threshold">Target Threshold (%)</label>
                <input 
                  id="target-threshold"
                  type="number" 
                  min="50" 
                  max="100" 
                  value={threshold} 
                  onChange={(e) => setThreshold(Math.max(50, Math.min(100, parseInt(e.target.value) || 85)))}
                />
                <span className="field-help">Minimum target requirement</span>
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
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
                  <p className="format-spec">Accepts .xls (HTML-export) or .xlsx formats</p>
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
            {isProcessing ? "Processing Spreadsheet..." : "Extract & Calculate Optimal Waivers"}
          </button>
        </div>
      ) : (
        <div className="results-view-grid">
          {/* Left Column: Adjusted statistics dashboard */}
          <div className="results-card-glass stats-dashboard">
            <div className="card-header-row">
              <h3>Adjusted Attendance Summary</h3>
              <div className={`status-pill ${allSafe ? 'safe' : 'alert'}`}>
                {allSafe ? "ALL SAFE (≥85%)" : "SHORTAGE DETECTED"}
              </div>
            </div>

            <div className="stats-comparison-table-wrapper">
              <table className="stats-comparison-table">
                <thead>
                  <tr>
                    <th>Subject Name</th>
                    <th>Type</th>
                    <th className="center">Baseline</th>
                    <th className="center">Adjusted</th>
                    <th className="right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {simulatedStats.map((s, idx) => {
                    const isShort = s.simPct < threshold;
                    return (
                      <tr key={idx} className={isShort ? "row-alert" : ""}>
                        <td className="subject-name">{s.subjectName}</td>
                        <td className="subject-type-badge">{s.type}</td>
                        <td className="center txt-muted">
                          {s.baselineAttended}/{s.baselineHeld} ({s.baselinePct.toFixed(1)}%)
                        </td>
                        <td className="center bold">
                          {s.simAttended}/{s.simHeld} <span className={isShort ? "text-red" : "text-green"}>({s.simPct.toFixed(1)}%)</span>
                        </td>
                        <td className="right">
                          <span className={`status-badge-mini ${isShort ? 'badge-short' : 'badge-safe'}`}>
                            {isShort ? 'SHORT' : 'SAFE'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="subjects-note-container">
              <p>📌 <strong>Theory & Tutorial Monitored Separately:</strong> Theory (`Th`) and Tutorial (`tu`) are independent requirements. Practical (`PR`) classes are completely ignored.</p>
            </div>
          </div>

          {/* Right Column: Waiver Dates Selector */}
          <div className="results-card-glass dates-selector">
            <div className="card-header-row">
              <div className="title-block">
                <h3>Recommended Waiver Dates</h3>
                <p className="subtitle">
                  {solverResult?.success ? (
                    <span>Successfully cleared target requirement using <strong>{solverResult.waiversCount}</strong> waivers.</span>
                  ) : (
                    <span className="text-orange">Max waivers ({maxWaivers}) used. Adjusting to closest solution.</span>
                  )}
                </p>
              </div>
              <div className="actions-cluster">
                <button className="btn-sec-small" onClick={resetToRecommended}>Reset</button>
                <button className="btn-sec-small" onClick={clearAllWaivers}>Clear All</button>
              </div>
            </div>

            <div className="dates-selector-list">
              {parsedData.candidates
                .sort((a, b) => b.totalAbsences - a.totalAbsences)
                .map((cand, idx) => {
                  const isChecked = selectedWaivers.has(cand.dateStr);
                  const isRecommended = recommendedWaivers.includes(cand.dateStr);
                  
                  return (
                    <div 
                      key={idx} 
                      className={`date-selection-item ${isChecked ? 'active' : ''} ${isRecommended ? 'recommended-border' : ''}`}
                      onClick={() => handleCheckboxChange(cand.dateStr)}
                    >
                      <div className="checkbox-glow-wrapper">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {}} 
                          id={`date-chk-${idx}`}
                        />
                        <label htmlFor={`date-chk-${idx}`} onClick={(e) => e.stopPropagation()}></label>
                      </div>
                      <div className="date-info">
                        <span className="date-label">{cand.label}</span>
                        <span className="date-sub">Absences: <strong>{cand.totalAbsences}</strong> | Presents: <strong>{cand.totalPresents}</strong></span>
                      </div>
                      {isRecommended && <span className="recommended-tag">Rec</span>}
                    </div>
                  );
                })}
            </div>

            <div className="control-stats-footer">
              <div className="totals-row">
                <span>Selected Waivers: <strong>{selectedWaivers.size}</strong> / {maxWaivers}</span>
                <button className="btn-reoptimize-back" onClick={() => setParsedData(null)}>
                  Upload New Sheet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WaiverToolPage;
