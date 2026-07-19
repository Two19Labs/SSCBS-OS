import React, { useState, useEffect } from 'react';
import { useTimetable } from '../context/TimetableContext';
import { useAuth } from '../context/AuthContext';
import { PERIODS, DAYS } from '../data/timetables';
import { isAdminEmail, isTimeWarpEnabled } from '../lib/admin';
import './FindMyProfessorPage.css';

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

export default function FindMyProfessorPage({ onBack }) {
  const { timetable: timetablesData } = useTimetable();
  const { user } = useAuth();
  const canTimeWarp = isAdminEmail(user?.email) && isTimeWarpEnabled();
  const [professorsList, setProfessorsList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProf, setSelectedProf] = useState('');
  
  // Time & Simulation States
  const [time, setTime] = useState(getISTTime());
  const [isSimulated, setIsSimulated] = useState(false);
  const [simulatedDay, setSimulatedDay] = useState('Monday');
  const [simulatedTimeStr, setSimulatedTimeStr] = useState('10:15');
  const [showDebugger, setShowDebugger] = useState(false);

  // View mode: 'today' or 'weekly'
  const [viewMode, setViewMode] = useState('today');

  // Mobile navigation mode: 'list' (show faculty sidebar) or 'details' (show professor details panel)
  const [mobileActiveTab, setMobileActiveTab] = useState('list');

  // Helper: Get exact date/time in Indian Standard Time (IST = UTC+5.5)
  function getISTTime() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 5.5));
  }

  // Ticking clock for live mode
  useEffect(() => {
    if (isSimulated) return;
    const interval = setInterval(() => {
      setTime(getISTTime());
    }, 1000);
    return () => clearInterval(interval);
  }, [isSimulated]);

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
    }
  }, []);

  // Filtered list of professors for sidebar
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
    <div className="prof-page-container animate-fade-in">
      
      {/* Top Back Navigation Header */}
      <div className="prof-page-nav-header">
        <button className="btn-back-dashboard" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          <span>Back to Dashboard</span>
        </button>
        <div className="page-header-clock">
          <span className="live-pill-small">
            <span className="live-dot-pulse-green"></span>
            {isSimulated ? 'Simulated' : 'IST Live'}
          </span>
          <span className="header-clock-digits">{clockHours}:{clockMin}:{clockSec} {clockAmPm}</span>
        </div>
      </div>

      {/* Main Spacious Dual Column Layout */}
      <div className="prof-page-layout">
        
        {/* Left Column: Sidebar List of Faculty */}
        <aside className={`prof-page-sidebar ${mobileActiveTab === 'list' ? 'show-mobile-sidebar' : 'hide-mobile-sidebar'}`}>
          <div className="sidebar-search-box">
            <h4>SSCBS Faculty List</h4>
            <p className="sidebar-description">Filter and select a professor to track</p>
            <div className="sidebar-input-wrapper">
              <svg className="sidebar-search-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                type="text" 
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="sidebar-search-input"
              />
              {searchQuery && (
                <button className="sidebar-clear-btn" onClick={() => setSearchQuery('')}>×</button>
              )}
            </div>
          </div>
          
          <div className="sidebar-prof-list-wrapper">
            {filteredProfs.length > 0 ? (
              <ul className="sidebar-prof-list">
                {filteredProfs.map((prof) => {
                  const isSelected = selectedProf === prof;
                  return (
                    <li 
                      key={prof} 
                      className={`sidebar-prof-item ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedProf(prof);
                        setMobileActiveTab('details');
                      }}
                    >
                      <div className="sidebar-prof-avatar">
                        {prof.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.)\s+/i, '').charAt(0).toUpperCase()}
                      </div>
                      <div className="sidebar-prof-info">
                        <span className="sidebar-prof-name">{prof}</span>
                      </div>
                      {isSelected && <span className="active-arrow">→</span>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="sidebar-empty-state">
                <p>No faculty found matching "{searchQuery}"</p>
              </div>
            )}
          </div>
        </aside>

        {/* Right Column: Main tracking details */}
        <main className={`prof-page-content ${mobileActiveTab === 'details' ? 'show-mobile-content' : 'hide-mobile-content'}`}>
          {selectedProf ? (
            <div className="prof-details-page-grid">
              
              {/* Mobile Only Back Button to Faculty List */}
              <button className="mobile-prof-back-btn" onClick={() => setMobileActiveTab('list')}>
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                <span>Back to Faculty List</span>
              </button>
              
              {/* Professor Header Info Row */}
              <div className="prof-header-panel">
                <div className="prof-header-avatar">
                  {selectedProf.replace(/^(Dr\.|Prof\.|Mr\.|Ms\.)\s+/i, '').charAt(0).toUpperCase()}
                </div>
                <div className="prof-header-meta">
                  <h2>{selectedProf}</h2>
                  <p className="subtitle-department">Faculty Member • Shaheed Sukhdev College of Business Studies</p>
                </div>
              </div>

              {/* Status & Timing Overview Row */}
              <div className="prof-status-overview-grid">
                
                {/* Real-time Status Card */}
                <div className="prof-page-status-card">
                  <div className="card-top-header">
                    <h4>Current Location & Status</h4>
                    <span className="day-badge-large">{dayOfWeek.toUpperCase()}</span>
                  </div>
                  
                  <div className="card-status-info-area">
                    {currentStatus.status === 'teaching' ? (
                      <div className="alert-box-status teaching">
                        <div className="alert-badge-row">
                          <span className="badge-live-teaching animate-pulse">Ongoing Class</span>
                          <span className="room-label-badge">Room <strong className="room-bold">{currentStatus.room}</strong></span>
                        </div>
                        <h3 className="alert-subject">{currentStatus.subject}</h3>
                        <p className="alert-description">
                          Lecturing: <strong>{currentStatus.classes}</strong>
                        </p>
                        
                        <div className="status-progress-wrapper">
                          <div className="progress-bar-bg-full">
                            <div className="progress-bar-fill-full" style={{ width: `${getProgressPercent(currentStatus.period)}%` }}></div>
                          </div>
                          <div className="progress-bar-text-row">
                            <span>{currentStatus.period.startLabel} - {currentStatus.period.endLabel}</span>
                            <span className="progress-countdown">{getRemainingTimeStr(currentStatus.period)}</span>
                          </div>
                        </div>
                      </div>
                    ) : currentStatus.status === 'break' ? (
                      <div className="alert-box-status break">
                        <span className="badge-generic break">Infinity Hour</span>
                        <h3>Break Period</h3>
                        <p>SSCBS campus lunch break (12:00 PM - 1:00 PM). Professors are usually not in class.</p>
                      </div>
                    ) : currentStatus.status === 'free' ? (
                      <div className="alert-box-status free">
                        <span className="badge-generic free">Free Block</span>
                        <h3>No Scheduled Lecture</h3>
                        <p>The selected professor has no assigned timetable slot during this hour.</p>
                        {currentStatus.period && (
                          <div className="current-slot-time-desc">
                            Period: {currentStatus.period.startLabel} - {currentStatus.period.endLabel}
                          </div>
                        )}
                      </div>
                    ) : currentStatus.status === 'weekend' ? (
                      <div className="alert-box-status weekend">
                        <span className="badge-generic weekend">Weekend</span>
                        <h3>Weekend</h3>
                        <p>It's the weekend. No academic schedules are active today.</p>
                      </div>
                    ) : (
                      <div className="alert-box-status completed">
                        <span className="badge-generic completed">Completed</span>
                        <h3>Day Concluded</h3>
                        <p>All scheduled sessions for today have concluded.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Next Lecture Panel */}
                <div className="prof-page-next-card">
                  <h4>Upcoming Schedule</h4>
                  {!isWeekend && nextClass ? (
                    <div className="next-lecture-inner-card">
                      <div className="next-icon-circle">
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <div className="next-class-meta-details">
                        <span className="next-class-period-time">
                          Starts at {PERIODS.find(p => p.id === nextClass.period)?.startLabel}
                        </span>
                        <h5>{nextClass.subject}</h5>
                        <p className="next-class-desc">
                          {nextClass.course} Sem {nextClass.semester}{nextClass.section} • Room {nextClass.room || 'TBA'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="next-lecture-empty-card">
                      <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="1.5" fill="none" style={{ opacity: 0.3, marginBottom: '8px' }}>
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      <p>No more lectures scheduled for the rest of today.</p>
                    </div>
                  )}
                </div>

              </div>

              {/* Navigation View Tabs */}
              <div className="page-view-tabs">
                <button 
                  className={`view-tab-btn ${viewMode === 'today' ? 'active' : ''}`}
                  onClick={() => setViewMode('today')}
                >
                  Today's Timeline
                </button>
                <button 
                  className={`view-tab-btn ${viewMode === 'weekly' ? 'active' : ''}`}
                  onClick={() => setViewMode('weekly')}
                >
                  Full Weekly Schedule Grid
                </button>
              </div>

              {/* Render Schedule views */}
              <div className="page-view-content-wrapper">
                
                {viewMode === 'today' ? (
                  <div className="spacious-timeline-wrapper">
                    {isWeekend ? (
                      <div className="timeline-empty-card">
                        <p>No timeline schedules available on weekends.</p>
                      </div>
                    ) : (
                      <div className="spacious-timeline-list">
                        {PERIODS.map((period) => {
                          const isBreakPeriod = period.id === 0;
                          const matchingClasses = profSchedules.filter(s => s.day === dayOfWeek && s.period === period.id);
                          const isCurrent = currentStatus.period?.id === period.id;
                          
                          return (
                            <div 
                              key={period.id} 
                              className={`spacious-timeline-row ${isCurrent ? 'active' : ''} ${isBreakPeriod ? 'break' : ''}`}
                            >
                              <div className="timeline-row-time">
                                <span className="period-label">{isBreakPeriod ? "Break" : period.label}</span>
                                <span className="time-range-label">{period.startLabel} - {period.endLabel}</span>
                                {isCurrent && <span className="live-label-glow">LIVE NOW</span>}
                              </div>

                              <div className="timeline-row-card-container">
                                {isBreakPeriod ? (
                                  <div className="timeline-break-card-spacious">
                                    <span className="card-emoji">🍽️</span>
                                    <div>
                                      <h5>Infinity Hour (Break)</h5>
                                      <p>Campus lunch slot. Students and teachers are free.</p>
                                    </div>
                                  </div>
                                ) : matchingClasses.length > 0 ? (
                                  <div className="timeline-class-card-spacious">
                                    <div className="class-card-top">
                                      <h5>{matchingClasses[0].subject}</h5>
                                      {matchingClasses[0].room && (
                                        <span className="class-card-room-badge">Room {matchingClasses[0].room}</span>
                                      )}
                                    </div>
                                    <p className="class-card-subtitle">
                                      Teaching: <strong>{matchingClasses.map(s => `${s.course} Sem ${s.semester}${s.section}`).join(' & ')}</strong>
                                    </p>
                                  </div>
                                ) : (
                                  <div className="timeline-free-card-spacious">
                                    <span className="card-emoji">☕</span>
                                    <div>
                                      <h5>Free Period</h5>
                                      <p>No lecture scheduled during this block.</p>
                                    </div>
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
                  /* Spacious Weekly Schedule Grid */
                  <div className="spacious-weekly-grid-container">
                    <table className="spacious-weekly-grid">
                      <thead>
                        <tr>
                          <th className="corner-sticky">Day</th>
                          {PERIODS.filter(p => !p.isBreak).map(p => (
                            <th key={p.id}>
                              <div className="weekly-th-period">{p.label}</div>
                              <div className="weekly-th-time">{p.startLabel} - {p.endLabel}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {DAYS.map(day => {
                          const isToday = dayOfWeek === day;
                          return (
                            <tr key={day} className={isToday ? 'today-row-highlight' : ''}>
                              <td className="sticky-day-col">
                                <strong>{day}</strong>
                                {isToday && <span className="today-dot-indicator"></span>}
                              </td>
                              {PERIODS.filter(p => !p.isBreak).map(period => {
                                const matchingClasses = profSchedules.filter(s => s.day === day && s.period === period.id);
                                const isCellLive = isToday && currentStatus.period?.id === period.id;
                                
                                return (
                                  <td 
                                    key={period.id} 
                                    className={`weekly-grid-cell-spacious ${matchingClasses.length > 0 ? 'occupied' : 'free'} ${isCellLive ? 'live-cell' : ''}`}
                                  >
                                    {matchingClasses.length > 0 ? (
                                      <div className="cell-card-spacious">
                                        {isCellLive && <span className="live-bubble">LIVE</span>}
                                        <div className="cell-card-subject" title={matchingClasses[0].subject}>
                                          {matchingClasses[0].subject}
                                        </div>
                                        <div className="cell-card-meta-row">
                                          <span className="cell-card-classes" title={matchingClasses.map(s => `${s.course} Sem ${s.semester}${s.section}`).join(' / ')}>
                                            {matchingClasses.map(s => `${s.course.replace('Bsc Comp Sci', 'B.Sc')}:${s.semester}${s.section}`).join(' & ')}
                                          </span>
                                          {matchingClasses[0].room && (
                                            <span className="cell-card-room">R:{matchingClasses[0].room}</span>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="cell-empty-dash">-</span>
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
                )}

              </div>

              {/* Time Warp testing controls — admins only, toggled from Profile */}
              {canTimeWarp && (
              <div className="prof-page-debugger">
                <button className="btn-toggle-debugger-page" onClick={() => setShowDebugger(!showDebugger)}>
                  {showDebugger ? 'Hide Time Warp Controls ▲' : 'Show Time Warp Controls (Test weekends/timewarp) ▼'}
                </button>
                
                {showDebugger && (
                  <div className="debugger-page-content animate-slide-down">
                    <div className="debugger-page-row">
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
                      <div className="debugger-page-inputs">
                        <div className="input-group-field">
                          <label htmlFor="sim-day-select">Simulated Day</label>
                          <select 
                            id="sim-day-select"
                            className="select-debugger-input"
                            value={simulatedDay} 
                            onChange={(e) => setSimulatedDay(e.target.value)}
                          >
                            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                            <option value="Saturday">Saturday</option>
                            <option value="Sunday">Sunday</option>
                          </select>
                        </div>
                        <div className="input-group-field">
                          <label htmlFor="sim-time-input">Simulated Time (24h)</label>
                          <input 
                            type="time" 
                            id="sim-time-input"
                            className="time-debugger-input"
                            value={simulatedTimeStr}
                            onChange={(e) => setSimulatedTimeStr(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}

            </div>
          ) : (
            <div className="prof-empty-details-state">
              <svg viewBox="0 0 24 24" width="72" height="72" stroke="currentColor" strokeWidth="1" fill="none" style={{ opacity: 0.15, marginBottom: '16px' }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <h3>No Professor Selected</h3>
              <p>Choose a faculty member from the left sidebar to start tracking their timetable status.</p>
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
