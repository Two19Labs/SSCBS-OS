import React, { useState, useEffect, useRef } from 'react';
import timetablesData from '../data/timetables.json';
import { PERIODS, DAYS } from '../data/timetables';
import './FindMyProfessor.css';

// Normalize teacher name by removing titles, group markers, and converting to lowercase
const normalizeName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\(g\d+\)/g, '')
    .replace(/g\d+:\s*/g, '')
    .replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, '')
    .replace(/[\s.-]+/g, ' ')
    .trim();
};

// Splits a teacher cell into individual names
const splitTeachers = (teacherStr) => {
  if (!teacherStr || typeof teacherStr !== 'string') return [];
  return teacherStr
    .split(/\/|\band\b|,/gi)
    .map(t => t.trim())
    .filter(t => {
      const lower = t.toLowerCase();
      return t && 
             t !== '-' && 
             !lower.includes('free') && 
             !lower.includes('unsupervised') && 
             !lower.includes('break') &&
             lower !== 'ee2' &&
             !lower.startsWith('social enter') &&
             !lower.startsWith('social ent');
    });
};

// Clean display names (remove group suffixes, etc.)
const cleanDisplayName = (name) => {
  if (!name) return '';
  return name
    .replace(/\(g\d+\)/gi, '')
    .replace(/\b(g\d+)\b/gi, '')
    .replace(/g\d+:\s*/gi, '')
    .replace(/[\s-]+/g, ' ')
    .trim();
};

// Parse time string to minutes since midnight
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

export default function FindMyProfessor({ isOpen, onClose }) {
  const [professorsList, setProfessorsList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProf, setSelectedProf] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Time & Simulation States
  const [time, setTime] = useState(getISTTime());
  const [isSimulated, setIsSimulated] = useState(false);
  const [simulatedDay, setSimulatedDay] = useState('Monday');
  const [simulatedTimeStr, setSimulatedTimeStr] = useState('10:15');
  const [showDebugger, setShowDebugger] = useState(false);

  // View mode: 'today' or 'weekly'
  const [viewMode, setViewMode] = useState('today');

  // Helper: Get exact date/time in Indian Standard Time (IST = UTC+5.5)
  function getISTTime() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 5.5));
  }

  // Ticking clock for live mode
  useEffect(() => {
    if (isSimulated || !isOpen) return;
    const interval = setInterval(() => {
      setTime(getISTTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [isSimulated, isOpen]);

  // Sync simulated time
  useEffect(() => {
    if (!isSimulated) {
      setTime(getISTTime());
    } else {
      const [hours, minutes] = simulatedTimeStr.split(':').map(Number);
      const newTime = new Date();
      newTime.setHours(hours);
      newTime.setMinutes(minutes);
      newTime.setSeconds(0);
      setTime(newTime);
    }
  }, [isSimulated, simulatedDay, simulatedTimeStr]);

  // Parse list of unique professors
  useEffect(() => {
    const uniqueProfs = new Map();
    for (const course in timetablesData) {
      for (const sem in timetablesData[course]) {
        for (const sec in timetablesData[course][sem]) {
          for (const day in timetablesData[course][sem][sec]) {
            const classes = timetablesData[course][sem][sec][day];
            classes.forEach(c => {
              const teachers = splitTeachers(c.teacher);
              teachers.forEach(t => {
                const cleanName = cleanDisplayName(t);
                const norm = normalizeName(cleanName);
                if (norm) {
                  if (!uniqueProfs.has(norm) || (cleanName.length > uniqueProfs.get(norm).length)) {
                    uniqueProfs.set(norm, cleanName);
                  }
                }
              });
            });
          }
        }
      }
    }
    const sorted = Array.from(uniqueProfs.values()).sort();
    setProfessorsList(sorted);
    
    // Default select first professor on list
    if (sorted.length > 0 && !selectedProf) {
      setSelectedProf(sorted[0]);
      setSearchQuery(sorted[0]);
    }
  }, []);

  // Handle clicks outside of dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // Filtered dropdown list
  const filteredProfs = professorsList.filter(p => 
    p.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Extract selected professor schedule
  const getProfessorSchedule = (profName) => {
    if (!profName) return [];
    const normSelected = normalizeName(profName);
    const schedules = [];

    for (const course in timetablesData) {
      for (const sem in timetablesData[course]) {
        for (const sec in timetablesData[course][sem]) {
          for (const day in timetablesData[course][sem][sec]) {
            const classes = timetablesData[course][sem][sec][day];
            classes.forEach(c => {
              const teachers = splitTeachers(c.teacher);
              const isTeaching = teachers.some(t => normalizeName(cleanDisplayName(t)) === normSelected);
              if (isTeaching) {
                schedules.push({
                  course,
                  semester: sem,
                  section: sec,
                  day,
                  period: c.period,
                  subject: c.subject,
                  room: c.room,
                  isBreak: c.isBreak
                });
              }
            });
          }
        }
      }
    }
    return schedules;
  };

  const profSchedules = getProfessorSchedule(selectedProf);

  // Time metrics
  const dayOfWeek = isSimulated ? simulatedDay : DAYS[time.getDay() - 1] || 'Sunday';
  const isWeekend = dayOfWeek === 'Sunday' || dayOfWeek === 'Saturday';
  const currentMinutes = time.getHours() * 60 + time.getMinutes();

  // Compute live tracking status
  const getLiveStatus = () => {
    if (isWeekend) {
      return { status: 'weekend', message: 'Weekend — No lectures scheduled today.' };
    }

    let activePeriod = null;
    PERIODS.forEach(p => {
      const startMin = parseTimeToMinutes(p.start);
      const endMin = parseTimeToMinutes(p.end);
      if (currentMinutes >= startMin && currentMinutes < endMin) {
        activePeriod = p;
      }
    });

    if (!activePeriod) {
      return { status: 'completed', message: 'Outside academic hours (9:00 AM - 5:00 PM).' };
    }

    if (activePeriod.id === 0) {
      return { status: 'break', message: 'Infinity Hour (Break)', period: activePeriod };
    }

    // Find classes taught right now
    const currentClasses = profSchedules.filter(s => s.day === dayOfWeek && s.period === activePeriod.id);

    if (currentClasses.length > 0) {
      // Group merged sections
      const sections = currentClasses.map(s => `${s.course} Sem ${s.semester}${s.section}`).join(' & ');
      const subject = currentClasses[0].subject;
      const room = currentClasses[0].room;

      return {
        status: 'teaching',
        subject,
        classes: sections,
        room: room && room !== '-' ? room : 'TBA',
        period: activePeriod
      };
    }

    return { status: 'free', message: 'No ongoing lecture (Free Slot / Self Study).', period: activePeriod };
  };

  const currentStatus = getLiveStatus();

  // Find next class today
  const getNextClass = () => {
    if (isWeekend) return null;
    let next = null;
    let nextStartMin = 1440; // End of day

    profSchedules.forEach(s => {
      if (s.day !== dayOfWeek) return;
      const periodInfo = PERIODS.find(p => p.id === s.period);
      if (!periodInfo) return;
      const startMin = parseTimeToMinutes(periodInfo.start);

      if (startMin > currentMinutes && startMin < nextStartMin) {
        next = s;
        nextStartMin = startMin;
      }
    });

    return next;
  };

  const nextClass = getNextClass();

  // Helper: Format countdown remaining time
  const getRemainingTimeStr = (periodInfo) => {
    if (!periodInfo) return '';
    const endMin = parseTimeToMinutes(periodInfo.end);
    const endMs = endMin * 60 * 1000;
    const currentMs = (time.getHours() * 3600 + time.getMinutes() * 60 + time.getSeconds()) * 1000 + time.getMilliseconds();
    const diffMs = Math.max(0, endMs - currentMs);
    const totalSeconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s remaining`;
    }
    return `${seconds}s remaining`;
  };

  // Helper: Get period progress percent
  const getProgressPercent = (periodInfo) => {
    if (!periodInfo) return 0;
    const startMin = parseTimeToMinutes(periodInfo.start);
    const endMin = parseTimeToMinutes(periodInfo.end);
    const currentMs = (time.getHours() * 3600 + time.getMinutes() * 60 + time.getSeconds()) * 1000 + time.getMilliseconds();
    const startMs = startMin * 60 * 1000;
    const endMs = endMin * 60 * 1000;
    const progress = ((currentMs - startMs) / (endMs - startMs)) * 100;
    return Math.max(0, Math.min(100, progress));
  };

  // Clock UI
  const rawHours12 = time.getHours() % 12 || 12;
  const clockHours = String(rawHours12).padStart(2, '0');
  const clockMin = String(time.getMinutes()).padStart(2, '0');
  const clockSec = String(time.getSeconds()).padStart(2, '0');
  const clockAmPm = time.getHours() >= 12 ? 'PM' : 'AM';

  return (
    <div className="prof-tracker-overlay" onClick={onClose}>
      <div className="prof-tracker-card animate-scale-up" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <header className="prof-tracker-header">
          <div className="header-title-group">
            <span className="live-pulse-badge">
              <span className="live-pulse-dot"></span>
              {isSimulated ? 'Simulated' : 'IST Live Tracker'}
            </span>
            <h3>Find My Professor</h3>
            <p className="subtitle-description">Track any SSCBS faculty's current room and schedule</p>
          </div>
          <button className="close-btn-round" onClick={onClose} aria-label="Close">×</button>
        </header>

        {/* Modal Body */}
        <div className="prof-tracker-body">
          
          {/* Top Search & Filter Bar */}
          <div className="prof-search-container" ref={dropdownRef}>
            <label htmlFor="prof-search-input" className="search-field-label">Search Professor</label>
            <div className="search-bar-wrapper">
              <svg className="search-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                id="prof-search-input"
                type="text"
                className="prof-search-input"
                placeholder="Type professor's name (e.g. Mona Verma, Rishi Sahay)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
              />
              {searchQuery && (
                <button 
                  className="clear-search-btn" 
                  onClick={() => {
                    setSearchQuery('');
                    setShowDropdown(true);
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {showDropdown && filteredProfs.length > 0 && (
              <ul className="prof-dropdown-list animate-slide-down">
                {filteredProfs.map((prof) => (
                  <li 
                    key={prof} 
                    className={`dropdown-item ${selectedProf === prof ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedProf(prof);
                      setSearchQuery(prof);
                      setShowDropdown(false);
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" style={{ marginRight: '8px', verticalAlign: 'middle', opacity: 0.7 }}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {prof}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedProf ? (
            <div className="prof-results-wrapper">
              
              {/* Tracker Live Overview Widget */}
              <div className="prof-status-widget">
                <div className="status-widget-header">
                  <div className="prof-avatar-badge">
                    {selectedProf.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.)\s+/i, '').charAt(0).toUpperCase()}
                  </div>
                  <div className="widget-prof-info">
                    <h4>{selectedProf}</h4>
                    <p className="status-label-top">Current Location & Status</p>
                  </div>
                  <div className="widget-clock-box">
                    <div className="clock-digits">
                      {clockHours}:{clockMin}<span className="clock-sec-small">:{clockSec}</span> <span className="clock-ampm-small">{clockAmPm}</span>
                    </div>
                    <span className="clock-day-label">{dayOfWeek.toUpperCase()}</span>
                  </div>
                </div>

                <div className="status-widget-body">
                  {currentStatus.status === 'teaching' ? (
                    <div className="status-alert teaching">
                      <div className="status-row-main">
                        <span className="badge-live-now animate-pulse">Ongoing Class</span>
                        <div className="room-badge-large">
                          Room: <strong className="room-highlight">{currentStatus.room}</strong>
                        </div>
                      </div>
                      <h4 className="active-subject">{currentStatus.subject}</h4>
                      <p className="active-class-desc">
                        Teaching: <strong>{currentStatus.classes}</strong>
                      </p>
                      
                      <div className="live-progress-container">
                        <div className="progress-bar-bg">
                          <div className="progress-bar-fill" style={{ width: `${getProgressPercent(currentStatus.period)}%` }}></div>
                        </div>
                        <div className="progress-times">
                          <span>{currentStatus.period.startLabel} - {currentStatus.period.endLabel}</span>
                          <span className="time-remaining-label">{getRemainingTimeStr(currentStatus.period)}</span>
                        </div>
                      </div>
                    </div>
                  ) : currentStatus.status === 'break' ? (
                    <div className="status-alert break">
                      <span className="badge-status-generic break">Infinity Hour</span>
                      <h4>Break Period</h4>
                      <p>SSCBS campus lunch break (12:00 PM - 1:00 PM).</p>
                    </div>
                  ) : currentStatus.status === 'free' ? (
                    <div className="status-alert free">
                      <span className="badge-status-generic free">Free / No Class</span>
                      <h4>No Scheduled Lecture</h4>
                      <p>Professor is currently not assigned to any lecture slot.</p>
                      {currentStatus.period && (
                        <div className="current-slot-time">
                          Slot: {currentStatus.period.startLabel} - {currentStatus.period.endLabel}
                        </div>
                      )}
                    </div>
                  ) : currentStatus.status === 'weekend' ? (
                    <div className="status-alert inactive">
                      <span className="badge-status-generic inactive">Weekend</span>
                      <h4>Weekend Mode</h4>
                      <p>{currentStatus.message}</p>
                    </div>
                  ) : (
                    <div className="status-alert inactive">
                      <span className="badge-status-generic inactive">Completed</span>
                      <h4>Day Concluded</h4>
                      <p>{currentStatus.message}</p>
                    </div>
                  )}

                  {/* Next Block Info */}
                  {!isWeekend && nextClass && (
                    <div className="prof-next-class-card">
                      <span className="next-label-small">Next Lecture Today</span>
                      <div className="next-details-row">
                        <div className="next-subject-group">
                          <h5>{nextClass.subject}</h5>
                          <p>{nextClass.course} Sem {nextClass.semester}{nextClass.section} • Room {nextClass.room || 'TBA'}</p>
                        </div>
                        <div className="next-time-tag">
                          {PERIODS.find(p => p.id === nextClass.period)?.startLabel}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation Tabs (Today's Timeline vs Weekly Grid) */}
              <div className="view-mode-tabs">
                <button 
                  className={`tab-btn ${viewMode === 'today' ? 'active' : ''}`}
                  onClick={() => setViewMode('today')}
                >
                  Today's Timeline
                </button>
                <button 
                  className={`tab-btn ${viewMode === 'weekly' ? 'active' : ''}`}
                  onClick={() => setViewMode('weekly')}
                >
                  Weekly Timetable
                </button>
              </div>

              {/* View Content */}
              {viewMode === 'today' ? (
                <div className="timeline-schedule-container">
                  {isWeekend ? (
                    <div className="timeline-empty-state">
                      <p>No timeline available for weekends.</p>
                    </div>
                  ) : (
                    <div className="timeline-list">
                      {PERIODS.map((period) => {
                        const isBreakPeriod = period.id === 0;
                        const matchingClasses = profSchedules.filter(s => s.day === dayOfWeek && s.period === period.id);
                        
                        // Check if current period
                        const isCurrentPeriod = currentStatus.period?.id === period.id;
                        
                        return (
                          <div 
                            key={period.id} 
                            className={`timeline-slot-row ${isCurrentPeriod ? 'active-slot' : ''} ${isBreakPeriod ? 'break-slot' : ''}`}
                          >
                            <div className="slot-time-col">
                              <span className="slot-period-number">{isBreakPeriod ? "Break" : period.label}</span>
                              <span className="slot-time-range">{period.startLabel} - {period.endLabel}</span>
                              {isCurrentPeriod && <span className="timeline-live-tag">LIVE</span>}
                            </div>

                            <div className="slot-content-col">
                              {isBreakPeriod ? (
                                <div className="break-block-box">
                                  <span>🍽️ Infinity Hour</span>
                                </div>
                              ) : matchingClasses.length > 0 ? (
                                <div className="slot-class-info-card">
                                  <div className="class-header-row">
                                    <h5 className="class-subject-name">{matchingClasses[0].subject}</h5>
                                    {matchingClasses[0].room && (
                                      <span className="class-room-tag">Room {matchingClasses[0].room}</span>
                                    )}
                                  </div>
                                  <p className="class-section-info">
                                    Class: {matchingClasses.map(s => `${s.course} Sem ${s.semester}${s.section}`).join(' & ')}
                                  </p>
                                </div>
                              ) : (
                                <div className="slot-free-box">
                                  <span>☕ Free Block</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Weekly Grid View */
                <div className="weekly-schedule-grid-container">
                  <div className="weekly-grid-table-wrapper">
                    <table className="weekly-grid-table">
                      <thead>
                        <tr>
                          <th>Day</th>
                          {PERIODS.filter(p => !p.isBreak).map(p => (
                            <th key={p.id}>
                              <span className="grid-period-label">{p.label}</span>
                              <span className="grid-time-label">{p.startLabel}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map(day => {
                          const isToday = dayOfWeek === day;
                          return (
                            <tr key={day} className={isToday ? 'current-day-row' : ''}>
                              <td className="grid-day-label">
                                <strong>{day.substring(0, 3)}</strong>
                                {isToday && <span className="today-grid-dot"></span>}
                              </td>
                              {PERIODS.filter(p => !p.isBreak).map(period => {
                                const matchingClasses = profSchedules.filter(s => s.day === day && s.period === period.id);
                                const isCellLive = isToday && currentStatus.period?.id === period.id;
                                
                                return (
                                  <td 
                                    key={period.id} 
                                    className={`weekly-grid-cell ${matchingClasses.length > 0 ? 'occupied' : 'free'} ${isCellLive ? 'live-cell' : ''}`}
                                  >
                                    {matchingClasses.length > 0 ? (
                                      <div className="cell-card-content">
                                        <div className="cell-subject-title" title={matchingClasses[0].subject}>
                                          {matchingClasses[0].subject}
                                        </div>
                                        <div className="cell-meta-details">
                                          <span className="cell-classes" title={matchingClasses.map(s => `${s.course} Sem ${s.semester}${s.section}`).join(' / ')}>
                                            {matchingClasses.map(s => `${s.course.replace('Bsc Comp Sci', 'B.Sc')}:${s.semester}${s.section}`).join(' & ')}
                                          </span>
                                          {matchingClasses[0].room && (
                                            <span className="cell-room">R:{matchingClasses[0].room}</span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="free-cell-dash">-</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="search-empty-state">
              <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="1.5" fill="none" style={{ opacity: 0.3, marginBottom: '12px' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <p>Type a professor's name above to start tracking their live location.</p>
            </div>
          )}

          {/* Time Warp testing controls inside Find My Professor */}
          <div className="prof-debugger-collapsible">
            <button className="btn-toggle-debugger" onClick={() => setShowDebugger(!showDebugger)}>
              {showDebugger ? 'Hide Time Warp Controls ▲' : 'Show Time Warp Controls (Test weekends/timewarp) ▼'}
            </button>
            
            {showDebugger && (
              <div className="debugger-panel-content animate-slide-down">
                <div className="debugger-control-row">
                  <label className="debugger-checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={isSimulated}
                      onChange={(e) => setIsSimulated(e.target.checked)}
                    />
                    Enable Simulated Clock (Time Warp)
                  </label>
                </div>
                {isSimulated && (
                  <div className="debugger-inputs-grid">
                    <div className="input-group-item">
                      <label htmlFor="sim-day-select">Simulated Day</label>
                      <select 
                        id="sim-day-select"
                        className="select-debugger-field"
                        value={simulatedDay} 
                        onChange={(e) => setSimulatedDay(e.target.value)}
                      >
                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                      </select>
                    </div>
                    <div className="input-group-item">
                      <label htmlFor="sim-time-input">Simulated Time (24h)</label>
                      <input 
                        type="time" 
                        id="sim-time-input"
                        className="time-debugger-field"
                        value={simulatedTimeStr}
                        onChange={(e) => setSimulatedTimeStr(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <footer className="prof-tracker-footer">
          <p className="footer-note">☕ Breaks occur daily during Infinity Hour (12:00 PM - 1:00 PM).</p>
          <button className="btn-close-tracker" onClick={onClose}>Close Tracker</button>
        </footer>

      </div>
    </div>
  );
}
