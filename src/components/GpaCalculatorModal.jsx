import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './GpaCalculatorModal.css';

const DEFAULT_SLOTS = [
  { id: 1, name: 'DSC-1', credits: 4, grade: 'O' },
  { id: 2, name: 'DSC-2', credits: 4, grade: 'O' },
  { id: 3, name: 'DSC-3', credits: 4, grade: 'O' },
  { id: 4, name: 'GE', credits: 4, grade: 'O' },
  { id: 5, name: 'AEC', credits: 2, grade: 'O' },
  { id: 6, name: 'SEC', credits: 2, grade: 'O' },
  { id: 7, name: 'VAC', credits: 2, grade: 'O' },
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
  
  // Tabs: 'sgpa' | 'cgpa'
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
      const grade = sub.grade || 'F';
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
        grade: 'O'
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
                      Pre-populated with standard 22-credit NEP slot layout (7 subjects). Custom slots supported.
                    </p>
                  </div>

                  <div className="table-responsive">
                    <table className="gpa-calc-table">
                      <thead>
                        <tr>
                          <th>Subject Name</th>
                          <th className="width-credits">Credits</th>
                          <th className="width-grade">Grade</th>
                          <th className="width-action"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.map((sub) => (
                          <tr key={sub.id}>
                            <td data-label="Subject Name">
                              <input
                                type="text"
                                className="gpa-input-text table-input-name"
                                value={sub.name}
                                onChange={(e) => handleSubjectChange(sub.id, 'name', e.target.value)}
                                placeholder="Enter subject name..."
                              />
                            </td>
                            <td data-label="Credits">
                              <input
                                type="number"
                                className="gpa-input-number table-input-credits"
                                value={sub.credits}
                                min="1"
                                max="10"
                                onChange={(e) => handleSubjectChange(sub.id, 'credits', e.target.value)}
                              />
                            </td>
                            <td data-label="Grade">
                              <select
                                className="gpa-select-field table-select-grade"
                                value={sub.grade}
                                onChange={(e) => handleSubjectChange(sub.id, 'grade', e.target.value)}
                              >
                                {Object.keys(GRADE_POINTS).map(g => (
                                  <option key={g} value={g}>{g} ({GRADE_POINTS[g]} GPA)</option>
                                ))}
                              </select>
                            </td>
                            <td className="cell-action">
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
                      <svg className="progress-ring" width="160" height="160" viewBox="0 0 160 160">
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
                    Toggle checkboxes to include semesters in the cumulative CGPA calculation.
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
                              ⚡ Copy SGPA ({sgpaResult})
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
                      <svg className="progress-ring" width="160" height="160" viewBox="0 0 160 160">
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
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
        

      </div>
    </div>
  );
}
