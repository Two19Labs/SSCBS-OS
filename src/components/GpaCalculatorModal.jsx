import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './GpaCalculatorModal.css';

const DEFAULT_SLOTS = [
  { id: 1, name: 'Discipline Specific Core 1 (DSC-1)', credits: 4, mode: 'grade', grade: 'O', theoryMarks: '', internalMarks: '' },
  { id: 2, name: 'Discipline Specific Core 2 (DSC-2)', credits: 4, mode: 'grade', grade: 'O', theoryMarks: '', internalMarks: '' },
  { id: 3, name: 'Discipline Specific Core 3 (DSC-3)', credits: 4, mode: 'grade', grade: 'O', theoryMarks: '', internalMarks: '' },
  { id: 4, name: 'Generic Elective (GE)', credits: 4, mode: 'grade', grade: 'O', theoryMarks: '', internalMarks: '' },
  { id: 5, name: 'Ability Enhancement Course (AEC)', credits: 2, mode: 'grade', grade: 'O', theoryMarks: '', internalMarks: '' },
  { id: 6, name: 'Skill Enhancement Course (SEC)', credits: 2, mode: 'grade', grade: 'O', theoryMarks: '', internalMarks: '' },
  { id: 7, name: 'Value Addition Course (VAC)', credits: 2, mode: 'grade', grade: 'O', theoryMarks: '', internalMarks: '' },
];

const GRADE_POINTS = {
  'O': 10,
  'A+': 9,
  'A': 8,
  'B+': 7,
  'B': 6,
  'C': 5,
  'D': 4,
  'F': 0,
  'Ab': 0
};

export default function GpaCalculatorModal({ isOpen, onClose }) {
  const { user } = useAuth();
  
  // Tabs: 'sgpa' | 'cgpa' | 'planner'
  const [activeTab, setActiveTab] = useState('sgpa');
  
  // SGPA Tab states
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [subjects, setSubjects] = useState(() => 
    DEFAULT_SLOTS.map(s => ({ ...s }))
  );
  const [sgpaResult, setSgpaResult] = useState(0);
  const [totalSgpaCredits, setTotalSgpaCredits] = useState(0);
  const [totalSgpaPoints, setTotalSgpaPoints] = useState(0);

  // CGPA Tab states
  const [semestersData, setSemestersData] = useState(() => 
    Array.from({ length: 8 }, (_, i) => ({
      number: i + 1,
      sgpa: '',
      credits: 22,
      enabled: i === 0 // default Enable Sem 1
    }))
  );
  const [cgpaResult, setCgpaResult] = useState(0);
  const [totalCgpaCredits, setTotalCgpaCredits] = useState(0);

  // Target Planner states
  const [currentCgpa, setCurrentCgpa] = useState('');
  const [currentCredits, setCurrentCredits] = useState('');
  const [targetCgpa, setTargetCgpa] = useState('');
  const [remainingCredits, setRemainingCredits] = useState('');
  const [plannerOutput, setPlannerOutput] = useState(null);

  // Auto-detect user course and semester on open to prefill
  useEffect(() => {
    if (isOpen && user?.user_metadata) {
      const userSem = user.user_metadata.semester;
      if (userSem && parseInt(userSem) >= 1 && parseInt(userSem) <= 8) {
        setSelectedSemester(userSem.toString());
      }
    }
  }, [user, isOpen]);

  // SGPA Calculation Logic
  useEffect(() => {
    let totalCredits = 0;
    let totalPoints = 0;

    subjects.forEach((sub) => {
      const credits = parseFloat(sub.credits) || 0;
      let grade = 'F';

      if (sub.mode === 'grade') {
        grade = sub.grade || 'F';
      } else {
        // Marks Mode conversion
        const theory = parseFloat(sub.theoryMarks) || 0;
        const internal = parseFloat(sub.internalMarks) || 0;
        const totalMarks = theory + internal; // Standard sum (out of 100)
        
        if (totalMarks >= 90) grade = 'O';
        else if (totalMarks >= 80) grade = 'A+';
        else if (totalMarks >= 70) grade = 'A';
        else if (totalMarks >= 60) grade = 'B+';
        else if (totalMarks >= 50) grade = 'B';
        else if (totalMarks >= 45) grade = 'C';
        else if (totalMarks >= 40) grade = 'D';
        else grade = 'F';
      }

      const gp = GRADE_POINTS[grade] !== undefined ? GRADE_POINTS[grade] : 0;
      totalCredits += credits;
      totalPoints += gp * credits;
    });

    const sgpa = totalCredits > 0 ? (totalPoints / totalCredits) : 0;
    setSgpaResult(parseFloat(sgpa.toFixed(2)));
    setTotalSgpaCredits(totalCredits);
    setTotalSgpaPoints(totalPoints);
  }, [subjects]);

  // CGPA Calculation Logic
  useEffect(() => {
    let totalCredits = 0;
    let totalPoints = 0;

    semestersData.forEach((sem) => {
      if (sem.enabled) {
        const sgpa = parseFloat(sem.sgpa) || 0;
        const credits = parseFloat(sem.credits) || 0;
        totalCredits += credits;
        totalPoints += sgpa * credits;
      }
    });

    const cgpa = totalCredits > 0 ? (totalPoints / totalCredits) : 0;
    setCgpaResult(parseFloat(cgpa.toFixed(2)));
    setTotalCgpaCredits(totalCredits);
  }, [semestersData]);

  // Planner Logic
  useEffect(() => {
    const currCgpa = parseFloat(currentCgpa);
    const currCreds = parseFloat(currentCredits);
    const tarCgpa = parseFloat(targetCgpa);
    const remCreds = parseFloat(remainingCredits);

    if (!isNaN(currCgpa) && !isNaN(currCreds) && !isNaN(tarCgpa) && !isNaN(remCreds) && remCreds > 0 && currCreds >= 0) {
      const currentQualityPoints = currCgpa * currCreds;
      const totalFutureCredits = currCreds + remCreds;
      const targetQualityPoints = tarCgpa * totalFutureCredits;
      const qualityPointsNeeded = targetQualityPoints - currentQualityPoints;
      const requiredSgpa = qualityPointsNeeded / remCreds;

      // Max achievable CGPA if student gets a perfect 10 in future semesters
      const maxCgpa = ((currCgpa * currCreds) + (10 * remCreds)) / totalFutureCredits;

      setPlannerOutput({
        requiredSgpa: parseFloat(requiredSgpa.toFixed(2)),
        maxCgpa: parseFloat(maxCgpa.toFixed(2)),
        isPossible: requiredSgpa <= 10.0
      });
    } else {
      setPlannerOutput(null);
    }
  }, [currentCgpa, currentCredits, targetCgpa, remainingCredits]);

  // Helper functions
  const handleSubjectChange = (id, field, value) => {
    setSubjects(prev =>
      prev.map(sub => (sub.id === id ? { ...sub, [field]: value } : sub))
    );
  };

  const handleAddSubject = () => {
    const newId = subjects.length > 0 ? Math.max(...subjects.map(s => s.id)) + 1 : 1;
    setSubjects(prev => [
      ...prev,
      {
        id: newId,
        name: `Subject Slot ${newId}`,
        credits: 4,
        mode: 'grade',
        grade: 'O',
        theoryMarks: '',
        internalMarks: ''
      }
    ]);
  };

  const handleDeleteSubject = (id) => {
    setSubjects(prev => prev.filter(sub => sub.id !== id));
  };

  const handleResetSgpa = () => {
    if (window.confirm('Are you sure you want to reset all subjects?')) {
      setSubjects(DEFAULT_SLOTS.map(s => ({ ...s })));
    }
  };

  const handleCopySgpaToCgpa = () => {
    const semNum = parseInt(selectedSemester);
    setSemestersData(prev =>
      prev.map(sem =>
        sem.number === semNum
          ? { ...sem, sgpa: sgpaResult.toString(), credits: totalSgpaCredits, enabled: true }
          : sem
      )
    );
    // Switch to CGPA tab to let the user see the update
    setActiveTab('cgpa');
  };

  const handleSemesterDataChange = (number, field, value) => {
    setSemestersData(prev =>
      prev.map(sem => (sem.number === number ? { ...sem, [field]: value } : sem))
    );
  };

  const getDivision = (gpa) => {
    if (gpa >= 7.50) return { name: 'First Class with Distinction', class: 'distinction' };
    if (gpa >= 6.00) return { name: 'First Division', class: 'first' };
    if (gpa >= 5.00) return { name: 'Second Division', class: 'second' };
    if (gpa >= 4.00) return { name: 'Third Division (Pass)', class: 'third' };
    return { name: 'Fail / Essential Repeat', class: 'fail' };
  };

  const handlePrintReport = () => {
    window.print();
  };

  const getSubjectCalculatedGrade = (sub) => {
    if (sub.mode === 'grade') return sub.grade;
    const theory = parseFloat(sub.theoryMarks) || 0;
    const internal = parseFloat(sub.internalMarks) || 0;
    const total = theory + internal;
    if (total >= 90) return 'O';
    if (total >= 80) return 'A+';
    if (total >= 70) return 'A';
    if (total >= 60) return 'B+';
    if (total >= 50) return 'B';
    if (total >= 45) return 'C';
    if (total >= 40) return 'D';
    return 'F';
  };

  if (!isOpen) return null;

  return (
    <div className="gpa-modal-overlay" onClick={onClose}>
      <div className="gpa-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <header className="gpa-modal-header">
          <div className="header-title-area">
            <svg className="gpa-header-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
              <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
            </svg>
            <h3>DU NEP GPA Calculator</h3>
          </div>
          <button className="gpa-close-btn" onClick={onClose} aria-label="Close Calculator">×</button>
        </header>

        {/* Modal Tabs */}
        <nav className="gpa-modal-tabs">
          <button 
            className={`gpa-tab-btn ${activeTab === 'sgpa' ? 'active' : ''}`}
            onClick={() => setActiveTab('sgpa')}
          >
            SGPA Calculator
          </button>
          <button 
            className={`gpa-tab-btn ${activeTab === 'cgpa' ? 'active' : ''}`}
            onClick={() => setActiveTab('cgpa')}
          >
            CGPA Calculator
          </button>
          <button 
            className={`gpa-tab-btn ${activeTab === 'planner' ? 'active' : ''}`}
            onClick={() => setActiveTab('planner')}
          >
            Target CGPA Planner
          </button>
        </nav>

        {/* Modal Scrollable Content */}
        <div className="gpa-modal-content">
          
          {/* TAB 1: SGPA CALCULATOR */}
          {activeTab === 'sgpa' && (
            <div className="gpa-tab-pane pane-sgpa">
              <div className="pane-main-layout">
                {/* Inputs Area */}
                <div className="inputs-section">
                  <div className="semester-selection-bar">
                    <label htmlFor="modal-sem-select">Selected Semester:</label>
                    <select
                      id="modal-sem-select"
                      value={selectedSemester}
                      onChange={(e) => setSelectedSemester(e.target.value)}
                      className="gpa-select-field"
                    >
                      {Array.from({ length: 8 }, (_, i) => (
                        <option key={i+1} value={i+1}>Semester {i+1}</option>
                      ))}
                    </select>
                    <p className="semester-help-text">
                      Pre-populated with standard 22-credit NEP slot layout (7 subjects). Feel free to customize.
                    </p>
                  </div>

                  <div className="table-responsive">
                    <table className="gpa-calc-table">
                      <thead>
                        <tr>
                          <th>Subject Name</th>
                          <th className="width-credits">Credits</th>
                          <th className="width-mode">Input Mode</th>
                          <th className="width-grade">Grade / Marks</th>
                          <th className="width-action"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map((sub) => (
                          <tr key={sub.id}>
                            <td>
                              <input
                                type="text"
                                className="gpa-input-text table-input-name"
                                value={sub.name}
                                onChange={(e) => handleSubjectChange(sub.id, 'name', e.target.value)}
                                placeholder="Enter subject name..."
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="gpa-input-number table-input-credits"
                                value={sub.credits}
                                min="1"
                                max="10"
                                onChange={(e) => handleSubjectChange(sub.id, 'credits', e.target.value)}
                              />
                            </td>
                            <td>
                              <div className="input-mode-toggle">
                                <button
                                  type="button"
                                  className={`mode-toggle-btn ${sub.mode === 'grade' ? 'active' : ''}`}
                                  onClick={() => handleSubjectChange(sub.id, 'mode', 'grade')}
                                >
                                  Grade
                                </button>
                                <button
                                  type="button"
                                  className={`mode-toggle-btn ${sub.mode === 'marks' ? 'active' : ''}`}
                                  onClick={() => handleSubjectChange(sub.id, 'mode', 'marks')}
                                >
                                  Marks
                                </button>
                              </div>
                            </td>
                            <td>
                              {sub.mode === 'grade' ? (
                                <select
                                  className="gpa-select-field table-select-grade"
                                  value={sub.grade}
                                  onChange={(e) => handleSubjectChange(sub.id, 'grade', e.target.value)}
                                >
                                  {Object.keys(GRADE_POINTS).map(g => (
                                    <option key={g} value={g}>{g} ({GRADE_POINTS[g]} GP)</option>
                                  ))}
                                </select>
                              ) : (
                                <div className="table-marks-inputs">
                                  <input
                                    type="number"
                                    className="gpa-input-number marks-field"
                                    placeholder="Th /75"
                                    min="0"
                                    max="75"
                                    value={sub.theoryMarks}
                                    onChange={(e) => handleSubjectChange(sub.id, 'theoryMarks', e.target.value)}
                                    title="Theory Marks (Out of 75)"
                                  />
                                  <span className="marks-separator">+</span>
                                  <input
                                    type="number"
                                    className="gpa-input-number marks-field"
                                    placeholder="Int /25"
                                    min="0"
                                    max="25"
                                    value={sub.internalMarks}
                                    onChange={(e) => handleSubjectChange(sub.id, 'internalMarks', e.target.value)}
                                    title="Internal Marks (Out of 25)"
                                  />
                                  <span className="marks-total-badge" title="Calculated Grade">
                                    = {getSubjectCalculatedGrade(sub)}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="gpa-delete-row-btn"
                                onClick={() => handleDeleteSubject(sub.id)}
                                title="Delete Subject"
                              >
                                &times;
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="table-bottom-actions">
                    <button type="button" className="btn-secondary-gpa" onClick={handleAddSubject}>
                      <span className="action-icon">+</span> Add Subject Row
                    </button>
                    <button type="button" className="btn-danger-gpa" onClick={handleResetSgpa}>
                      Reset
                    </button>
                  </div>
                </div>

                {/* Dashboard Results Panel */}
                <div className="results-sidebar">
                  <div className="result-card">
                    <h4 className="result-card-title">Semester SGPA</h4>
                    
                    {/* SVG Progress Ring */}
                    <div className="progress-ring-container">
                      <svg className="progress-ring" width="160" height="160">
                        <circle className="progress-ring-bg" cx="80" cy="80" r="70" />
                        <circle 
                          className="progress-ring-fill" 
                          cx="80" 
                          cy="80" 
                          r="70" 
                          style={{
                            strokeDasharray: `${2 * Math.PI * 70}`,
                            strokeDashoffset: `${2 * Math.PI * 70 * (1 - sgpaResult / 10)}`
                          }}
                        />
                      </svg>
                      <div className="ring-text-overlay">
                        <span className="gpa-value-large">{sgpaResult.toFixed(2)}</span>
                        <span className="gpa-label-small">SGPA</span>
                      </div>
                    </div>

                    <div className="result-stats-list">
                      <div className="stat-row">
                        <span>Total Credits:</span>
                        <strong className="stat-val">{totalSgpaCredits}</strong>
                      </div>
                      <div className="stat-row">
                        <span>Total Grade Points:</span>
                        <strong className="stat-val">{totalSgpaPoints}</strong>
                      </div>
                      <div className="stat-row">
                        <span>Equivalent %:</span>
                        <strong className="stat-val">{(sgpaResult * 10).toFixed(1)}%</strong>
                      </div>
                    </div>

                    <div className={`division-badge-card ${getDivision(sgpaResult).class}`}>
                      {getDivision(sgpaResult).name}
                    </div>

                    <div className="sidebar-action-buttons">
                      <button 
                        type="button" 
                        className="btn-primary-gpa btn-full-width"
                        onClick={handleCopySgpaToCgpa}
                        disabled={totalSgpaCredits === 0}
                      >
                        Copy to CGPA Calculator
                      </button>
                      <button 
                        type="button" 
                        className="btn-secondary-gpa btn-full-width btn-icon-row"
                        onClick={handlePrintReport}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 6 2 18 2 18 9"></polyline>
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                          <rect x="6" y="14" width="12" height="8"></rect>
                        </svg>
                        Print Report Card
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CGPA CALCULATOR */}
          {activeTab === 'cgpa' && (
            <div className="gpa-tab-pane pane-cgpa">
              <div className="pane-main-layout">
                {/* Inputs Area */}
                <div className="inputs-section">
                  <h4 className="section-title-small">Enter SGPA for Completed Semesters</h4>
                  <p className="section-desc-small">
                    Toggle checkboxes to include semesters in the cumulative CGPA. 
                    If you calculated your SGPA in the first tab, use the <strong>"Copy Current"</strong> button next to the semester.
                  </p>

                  <div className="cgpa-semester-grid">
                    {semestersData.map((sem) => (
                      <div key={sem.number} className={`cgpa-sem-card ${sem.enabled ? 'enabled' : 'disabled'}`}>
                        <div className="sem-card-top">
                          <label className="sem-checkbox-label">
                            <input
                              type="checkbox"
                              checked={sem.enabled}
                              onChange={(e) => handleSemesterDataChange(sem.number, 'enabled', e.target.checked)}
                            />
                            Semester {sem.number}
                          </label>
                          {sem.number === parseInt(selectedSemester) && (
                            <button
                              type="button"
                              className="btn-tiny-copy"
                              onClick={() => handleSemesterDataChange(sem.number, 'sgpa', sgpaResult.toString())}
                              title="Copy SGPA from the SGPA calculator tab"
                            >
                              Copy Current ({sgpaResult})
                            </button>
                          )}
                        </div>
                        
                        <div className="sem-card-inputs">
                          <div className="sem-input-group">
                            <label htmlFor={`cgpa-sgpa-${sem.number}`}>SGPA:</label>
                            <input
                              id={`cgpa-sgpa-${sem.number}`}
                              type="number"
                              className="gpa-input-number sem-gpa-input"
                              placeholder="0.00"
                              min="0"
                              max="10"
                              step="0.01"
                              value={sem.sgpa}
                              onChange={(e) => handleSemesterDataChange(sem.number, 'sgpa', e.target.value)}
                              disabled={!sem.enabled}
                            />
                          </div>
                          
                          <div className="sem-input-group">
                            <label htmlFor={`cgpa-credits-${sem.number}`}>Credits:</label>
                            <input
                              id={`cgpa-credits-${sem.number}`}
                              type="number"
                              className="gpa-input-number sem-credits-input"
                              min="1"
                              max="40"
                              value={sem.credits}
                              onChange={(e) => handleSemesterDataChange(sem.number, 'credits', e.target.value)}
                              disabled={!sem.enabled}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dashboard Results Panel */}
                <div className="results-sidebar">
                  <div className="result-card">
                    <h4 className="result-card-title">Cumulative CGPA</h4>
                    
                    {/* SVG Progress Ring */}
                    <div className="progress-ring-container">
                      <svg className="progress-ring" width="160" height="160">
                        <circle className="progress-ring-bg" cx="80" cy="80" r="70" />
                        <circle 
                          className="progress-ring-fill fill-cgpa" 
                          cx="80" 
                          cy="80" 
                          r="70" 
                          style={{
                            strokeDasharray: `${2 * Math.PI * 70}`,
                            strokeDashoffset: `${2 * Math.PI * 70 * (1 - cgpaResult / 10)}`
                          }}
                        />
                      </svg>
                      <div className="ring-text-overlay">
                        <span className="gpa-value-large">{cgpaResult.toFixed(2)}</span>
                        <span className="gpa-label-small">CGPA</span>
                      </div>
                    </div>

                    <div className="result-stats-list">
                      <div className="stat-row">
                        <span>Semesters Counted:</span>
                        <strong className="stat-val">{semestersData.filter(s => s.enabled).length}</strong>
                      </div>
                      <div className="stat-row">
                        <span>Total Accumulated Credits:</span>
                        <strong className="stat-val">{totalCgpaCredits}</strong>
                      </div>
                      <div className="stat-row">
                        <span>Final NEP %:</span>
                        <strong className="stat-val">{(cgpaResult * 10).toFixed(1)}%</strong>
                      </div>
                    </div>

                    <div className={`division-badge-card ${getDivision(cgpaResult).class}`}>
                      {getDivision(cgpaResult).name}
                    </div>

                    <div className="sidebar-action-buttons">
                      <button 
                        type="button" 
                        className="btn-secondary-gpa btn-full-width btn-icon-row"
                        onClick={handlePrintReport}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 6 2 18 2 18 9"></polyline>
                          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                          <rect x="6" y="14" width="12" height="8"></rect>
                        </svg>
                        Print CGPA Report
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TARGET PLANNER */}
          {activeTab === 'planner' && (
            <div className="gpa-tab-pane pane-planner">
              <div className="planner-grid-layout">
                {/* Inputs Panel */}
                <div className="planner-inputs-card">
                  <h4 className="planner-heading">Target CGPA Goal Settings</h4>
                  <p className="planner-subheading">
                    Determine the average GPA you must achieve in your upcoming semesters to hit a target graduation CGPA.
                  </p>

                  <div className="planner-form-grid">
                    <div className="form-item">
                      <label htmlFor="planner-current-cgpa">Current CGPA</label>
                      <input
                        type="number"
                        id="planner-current-cgpa"
                        className="gpa-input-number"
                        placeholder="e.g. 7.85"
                        min="0"
                        max="10"
                        step="0.01"
                        value={currentCgpa}
                        onChange={(e) => setCurrentCgpa(e.target.value)}
                      />
                      <span className="input-helper">Your CGPA up to this point.</span>
                    </div>

                    <div className="form-item">
                      <label htmlFor="planner-current-credits">Credits Earned So Far</label>
                      <input
                        type="number"
                        id="planner-current-credits"
                        className="gpa-input-number"
                        placeholder="e.g. 44 (2 semesters)"
                        min="0"
                        value={currentCredits}
                        onChange={(e) => setCurrentCredits(e.target.value)}
                      />
                      <span className="input-helper">Total credits completed.</span>
                    </div>

                    <div className="form-item">
                      <label htmlFor="planner-target-cgpa">Target CGPA Goal</label>
                      <input
                        type="number"
                        id="planner-target-cgpa"
                        className="gpa-input-number"
                        placeholder="e.g. 8.50"
                        min="0"
                        max="10"
                        step="0.01"
                        value={targetCgpa}
                        onChange={(e) => setTargetCgpa(e.target.value)}
                      />
                      <span className="input-helper">The CGPA you want to graduate with.</span>
                    </div>

                    <div className="form-item">
                      <label htmlFor="planner-remaining-credits">Remaining Credits</label>
                      <input
                        type="number"
                        id="planner-remaining-credits"
                        className="gpa-input-number"
                        placeholder="e.g. 88 (4 semesters)"
                        min="0"
                        value={remainingCredits}
                        onChange={(e) => setRemainingCredits(e.target.value)}
                      />
                      <span className="input-helper">Credits you will study in future.</span>
                    </div>
                  </div>
                </div>

                {/* Outputs Panel */}
                <div className="planner-results-card">
                  <h4 className="planner-heading">Feasibility Assessment</h4>
                  
                  {!plannerOutput ? (
                    <div className="planner-empty-state">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-state-icon">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <p>Please enter your academic metrics on the left to calculate your planning goals.</p>
                    </div>
                  ) : (
                    <div className="planner-output-content">
                      {plannerOutput.isPossible ? (
                        <div className="planner-alert success">
                          <div className="alert-header">
                            <span className="alert-badge success">Goal Achievable</span>
                            <h5>SGPA Required: <strong>{plannerOutput.requiredSgpa.toFixed(2)}</strong></h5>
                          </div>
                          <p className="alert-message">
                            To achieve your target CGPA of <strong>{targetCgpa}</strong>, you need to maintain an average SGPA of <strong>{plannerOutput.requiredSgpa.toFixed(2)}</strong> across your remaining <strong>{remainingCredits}</strong> credits.
                          </p>
                          {plannerOutput.requiredSgpa <= parseFloat(currentCgpa) ? (
                            <div className="planner-micro-tip">
                              💡 Tip: This target SGPA is lower than your current performance ({currentCgpa}). Keep up your current pace and you will comfortably hit your target!
                            </div>
                          ) : (
                            <div className="planner-micro-tip">
                              📈 Note: This target SGPA is higher than your current performance ({currentCgpa}). You'll need to step up your marks slightly in future classes.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="planner-alert danger">
                          <div className="alert-header">
                            <span className="alert-badge danger">Goal Out of Reach</span>
                            <h5>Required SGPA: <strong>{plannerOutput.requiredSgpa.toFixed(2)}</strong></h5>
                          </div>
                          <p className="alert-message">
                            Mathematically, you cannot hit a target CGPA of <strong>{targetCgpa}</strong>. 
                            Even if you secure a perfect <strong>10.00 SGPA</strong> in all remaining classes, your maximum possible graduating CGPA is <strong>{plannerOutput.maxCgpa.toFixed(2)}</strong>.
                          </p>
                          <div className="planner-micro-tip">
                            💡 Suggestion: Consider lowering your target CGPA goal to <strong>{plannerOutput.maxCgpa.toFixed(2)}</strong> or below to make it achievable.
                          </div>
                        </div>
                      )}

                      <div className="planner-stats-box">
                        <div className="planner-stat-row">
                          <span>Total Cumulative Credits:</span>
                          <strong>{parseFloat(currentCredits) + parseFloat(remainingCredits)}</strong>
                        </div>
                        <div className="planner-stat-row">
                          <span>Maximum Possible CGPA:</span>
                          <strong>{plannerOutput.maxCgpa.toFixed(2)}</strong>
                        </div>
                        <div className="planner-stat-row">
                          <span>Quality Points Needed:</span>
                          <strong>{((targetCgpa * (parseFloat(currentCredits) + parseFloat(remainingCredits))) - (currentCgpa * currentCredits)).toFixed(1)}</strong>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
        
        {/* Printable representation for Export Report Card (Invisible on screen, styled for print) */}
        <div className="gpa-print-only-container">
          <div className="print-report-header">
            <img src="/sscbs_logo.png" alt="SSCBS Crest" width="50" height="50" />
            <div className="print-header-text">
              <h2>SHAHEED SUKHDEV COLLEGE OF BUSINESS STUDIES</h2>
              <h3>University of Delhi</h3>
              <h4>Academic Performance Report Card (NEP UGCF)</h4>
            </div>
          </div>

          <div className="print-meta-grid">
            <div><strong>Student Name:</strong> {user?.user_metadata?.full_name || 'N/A'}</div>
            <div><strong>Email Address:</strong> {user?.email || 'N/A'}</div>
            <div><strong>Academic Course:</strong> {user?.user_metadata?.course || 'N/A'}</div>
            <div><strong>Report Date:</strong> {new Date().toLocaleDateString('en-IN')}</div>
          </div>

          <hr className="print-divider" />

          {activeTab === 'sgpa' ? (
            <div className="print-main-content">
              <h3>Semester {selectedSemester} Performance Assessment</h3>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Subject Title</th>
                    <th className="text-center">Credits</th>
                    <th className="text-center">Calculated Grade</th>
                    <th className="text-center">Grade Point</th>
                    <th className="text-center">Quality Points</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map(sub => {
                    const grade = getSubjectCalculatedGrade(sub);
                    const gp = GRADE_POINTS[grade] !== undefined ? GRADE_POINTS[grade] : 0;
                    const creds = parseFloat(sub.credits) || 0;
                    return (
                      <tr key={sub.id}>
                        <td>{sub.name}</td>
                        <td className="text-center">{creds}</td>
                        <td className="text-center">{grade}</td>
                        <td className="text-center">{gp}</td>
                        <td className="text-center">{(gp * creds).toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="print-summary-box">
                <div className="print-summary-row">
                  <span>Semester SGPA:</span>
                  <strong>{sgpaResult.toFixed(2)}</strong>
                </div>
                <div className="print-summary-row">
                  <span>Total Credits Registered:</span>
                  <strong>{totalSgpaCredits}</strong>
                </div>
                <div className="print-summary-row">
                  <span>Cumulative Grade Points:</span>
                  <strong>{totalSgpaPoints}</strong>
                </div>
                <div className="print-summary-row">
                  <span>Equivalent Percentage:</span>
                  <strong>{(sgpaResult * 10).toFixed(1)}%</strong>
                </div>
                <div className="print-summary-row">
                  <span>Qualifying Division:</span>
                  <strong>{getDivision(sgpaResult).name}</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="print-main-content">
              <h3>Cumulative Graduation CGPA Report</h3>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Semester Name</th>
                    <th className="text-center">Semester SGPA</th>
                    <th className="text-center">Credit Weight</th>
                    <th className="text-center">Quality Points Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {semestersData.filter(s => s.enabled).map(sem => {
                    const sgpa = parseFloat(sem.sgpa) || 0;
                    const creds = parseFloat(sem.credits) || 0;
                    return (
                      <tr key={sem.number}>
                        <td>Semester {sem.number}</td>
                        <td className="text-center">{sgpa.toFixed(2)}</td>
                        <td className="text-center">{creds}</td>
                        <td className="text-center">{(sgpa * creds).toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="print-summary-box">
                <div className="print-summary-row">
                  <span>Grand CGPA:</span>
                  <strong>{cgpaResult.toFixed(2)}</strong>
                </div>
                <div className="print-summary-row">
                  <span>Total Completed Credits:</span>
                  <strong>{totalCgpaCredits}</strong>
                </div>
                <div className="print-summary-row">
                  <span>Degree Final Percentage:</span>
                  <strong>{(cgpaResult * 10).toFixed(1)}%</strong>
                </div>
                <div className="print-summary-row">
                  <span>Declared Class / Division:</span>
                  <strong>{getDivision(cgpaResult).name}</strong>
                </div>
              </div>
            </div>
          )}

          <div className="print-footer">
            <p>Generated via SSCBS Campus OS Dashboard. This is an unofficial estimation worksheet for student advising purposes.</p>
            <div className="print-signatures">
              <div className="sig-line">Prepared by AI Assistant</div>
              <div className="sig-line">Student Signature</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
