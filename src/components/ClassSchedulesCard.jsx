import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTimetable } from '../context/TimetableContext';
import { PERIODS, DAYS } from '../data/timetables';
import { isAdminEmail, isTimeWarpEnabled } from '../lib/admin';
import './ClassSchedulesCard.css';

export default function ClassSchedulesCard({ onOpenProfile }) {
  const { user } = useAuth();
  const { getTimetable } = useTimetable();
  
  // Profile settings
  const course = user?.user_metadata?.course;
  const semester = user?.user_metadata?.semester;
  const section = user?.user_metadata?.section;
  
  const hasConfiguredProfile = course && semester && section;
  const canTimeWarp = isAdminEmail(user?.email) && isTimeWarpEnabled();

  // Real-time & Debug states
  const [time, setTime] = useState(getISTTime());
  const [isSimulated, setIsSimulated] = useState(false);
  const [simulatedDay, setSimulatedDay] = useState('Monday');
  const [simulatedTimeStr, setSimulatedTimeStr] = useState('10:15'); // 10:15 AM
  
  // Weekly modal states
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [weeklyLayoutMode, setWeeklyLayoutMode] = useState('grid'); // 'grid' or 'list'
  const [activeWeeklyTab, setActiveWeeklyTab] = useState('Monday');

  // Collapsible debugger state
  const [showDebugger, setShowDebugger] = useState(false);

  // Auto-detect screen size to set default weekly layout on modal open
  useEffect(() => {
    if (showWeeklyModal) {
      const isMobileScreen = window.innerWidth <= 768;
      setWeeklyLayoutMode(isMobileScreen ? 'list' : 'grid');
      
      const currentDay = isSimulated ? simulatedDay : DAYS[getISTTime().getDay() - 1] || 'Monday';
      if (DAYS.includes(currentDay)) {
        setActiveWeeklyTab(currentDay);
      } else {
        setActiveWeeklyTab('Monday');
      }
    }
  }, [showWeeklyModal]);

  // Helper: Get exact date/time in Indian Standard Time (IST = UTC+5.5)
  function getISTTime() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 5.5));
  }

  // Update real-time clock every second for live ticking countdown and sub-second progress
  useEffect(() => {
    if (isSimulated) return;
    
    const interval = setInterval(() => {
      setTime(getISTTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [isSimulated]);

  // Handle simulation changes
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

  // Extract date variables
  const dayOfWeek = isSimulated ? simulatedDay : DAYS[time.getDay() - 1] || 'Sunday';
  const isWeekend = dayOfWeek === 'Sunday' || dayOfWeek === 'Saturday';

  // Get current minutes since midnight
  const currentMinutes = time.getHours() * 60 + time.getMinutes();

  // Load timetable
  const timetable = hasConfiguredProfile ? getTimetable(course, semester, section) : null;
  const todayClasses = timetable ? timetable[dayOfWeek] || [] : [];

  // Parse time string e.g. "09:00" to minutes (540)
  const parseTimeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Helper: Get remaining time formatted as "MMm SSs" or "HHh MMm"
  const getFormattedRemainingTime = (periodInfo) => {
    if (!periodInfo) return '';
    const endMin = parseTimeToMinutes(periodInfo.end);
    const endMs = endMin * 60 * 1000;
    
    const currentMs = (time.getHours() * 3600 + time.getMinutes() * 60 + time.getSeconds()) * 1000 + time.getMilliseconds();
    const diffMs = Math.max(0, endMs - currentMs);
    
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s left`;
    } else {
      return `${seconds}s left`;
    }
  };

  // Helper: Get smooth progress percent
  const getProgressPercent = (periodInfo) => {
    if (!periodInfo) return 0;
    const startMin = parseTimeToMinutes(periodInfo.start);
    const endMin = parseTimeToMinutes(periodInfo.end);
    
    const startMs = startMin * 60 * 1000;
    const endMs = endMin * 60 * 1000;
    const currentMs = (time.getHours() * 3600 + time.getMinutes() * 60 + time.getSeconds()) * 1000 + time.getMilliseconds();
    
    const progress = ((currentMs - startMs) / (endMs - startMs)) * 100;
    return Math.max(0, Math.min(100, progress));
  };

  // Find active and next classes
  let activeClass = null;
  let nextClass = null;
  let activePeriodInfo = null;

  if (timetable && !isWeekend) {
    todayClasses.forEach((cls) => {
      const periodInfo = PERIODS.find(p => p.id === cls.period || (cls.isBreak && p.id === 0));
      if (!periodInfo) return;

      const startMin = parseTimeToMinutes(periodInfo.start);
      const endMin = parseTimeToMinutes(periodInfo.end);

      // Active check
      if (currentMinutes >= startMin && currentMinutes < endMin) {
        activeClass = cls;
        activePeriodInfo = periodInfo;
      }

      // Next check (first class starting after current time)
      if (startMin > currentMinutes) {
        if (!nextClass || startMin < parseTimeToMinutes(PERIODS.find(p => p.id === nextClass.period || (nextClass.isBreak && p.id === 0)).start)) {
          nextClass = cls;
        }
      }
    });
  }

  const progressPercent = getProgressPercent(activePeriodInfo);

  const handleToggleSimulated = (e) => {
    setIsSimulated(e.target.checked);
  };

  // Get time components for ticking clock with seconds
  const hours = time.getHours();
  const rawHours12 = hours % 12 || 12;
  const hours12 = String(rawHours12).padStart(2, '0');
  const minutes = String(time.getMinutes()).padStart(2, '0');
  const seconds = String(time.getSeconds()).padStart(2, '0');
  const amPm = hours >= 12 ? 'PM' : 'AM';

  return (
    <div className={`schedule-card-container ${hasConfiguredProfile ? 'active-tracker' : 'configure-prompt'}`}>
      
      {/* 1. Prompt state if profile not configured */}
      {!hasConfiguredProfile ? (
        <div className="setup-banner-wrapper">
          <div className="lock-icon-glow">
            <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h3>Class Schedules Locked</h3>
          <p>Configure your college Course, Semester, and Section in your student profile to synchronize your live class timetable.</p>
          <button className="btn-setup-action" onClick={onOpenProfile}>
            Set Up Student Profile
          </button>
        </div>
      ) : (
        <>
          {/* 2. Main Live Tracker Widget */}
          <div className="tracker-grid">
            
            {/* Header info */}
            <div className="tracker-header">
              <div className="tracker-title-group">
                <span className="live-pill">
                  <span className="live-dot-pulse"></span>
                  {isSimulated ? 'Simulated' : 'IST Live'}
                </span>
                <h2>Class Timetable</h2>
                <p className="subtitle">{course} Sem {semester} Section {section}</p>
              </div>
              <div className="tracker-time-display">
                <div className="clock-wrapper">
                  <span className="clock-digits">{hours12}:{minutes}</span>
                  <span className="clock-seconds">:{seconds}</span>
                  <span className="clock-ampm">{amPm}</span>
                </div>
                <span className="clock-sec">
                  {dayOfWeek.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Current status display */}
            <div className="tracker-main-status">
              {isWeekend ? (
                <div className="status-hero inactive">
                  <div className="hero-details">
                    <span className="badge-status weekend">Break</span>
                    <h3>No Classes Today</h3>
                    <p>It's the weekend. Relax, catch up on projects, and enjoy your free time!</p>
                  </div>
                </div>
              ) : activeClass && activeClass.subject !== 'Free' && !activeClass.isBreak ? (
                <div className="status-hero ongoing">
                  <div className="hero-details">
                    <div className="hero-status-row">
                      <span className="badge-status live">Ongoing Now</span>
                      {activeClass.room && activeClass.room !== '-' && (
                        <span className="room-label">Room: <strong className="highlight-tag">{activeClass.room}</strong></span>
                      )}
                    </div>
                    <h3>{activeClass.subject}</h3>
                    {activeClass.teacher && activeClass.teacher !== '-' && (
                      <p className="teacher-name">
                        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2.5" fill="none" style={{ marginRight: '4px', verticalAlign: 'middle', opacity: 0.8 }}>
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        {activeClass.teacher}
                      </p>
                    )}
                  </div>
                  <div className="hero-progress">
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <div className="progress-details">
                      <span>{activePeriodInfo.startLabel} - {activePeriodInfo.endLabel}</span>
                      <span className="time-remaining">{getFormattedRemainingTime(activePeriodInfo)}</span>
                    </div>
                  </div>
                </div>
              ) : activeClass && activeClass.isBreak ? (
                <div className="status-hero break">
                  <div className="hero-details">
                    <span className="badge-status break-badge">Infinity Hour</span>
                    <h3>Break</h3>
                    <p className="break-note">It's Infy, go to Nescafe/Amul and chill! :)</p>
                  </div>
                  <div className="hero-progress">
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill break" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <div className="progress-details">
                      <span>12:00 PM - 1:00 PM</span>
                      <span className="time-remaining">{getFormattedRemainingTime(activePeriodInfo || PERIODS.find(p => p.id === 0))}</span>
                    </div>
                  </div>
                </div>
              ) : activeClass && activeClass.subject === 'Free' ? (
                <div className="status-hero free-slot">
                  <div className="hero-details">
                    <span className="badge-status free">Free</span>
                    <h3>Free Block</h3>
                    <p className="free-note">Use this block for coursework revision or project collaboration.</p>
                  </div>
                  <div className="hero-progress">
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill free" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <div className="progress-details">
                      <span>{activePeriodInfo.startLabel} - {activePeriodInfo.endLabel}</span>
                      <span className="time-remaining">{getFormattedRemainingTime(activePeriodInfo)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="status-hero inactive">
                  <div className="hero-details">
                    <span className="badge-status offline">Classes Completed</span>
                    <h3>Academic Slots Inactive</h3>
                    <p className="inactive-note">All scheduled sessions for today have concluded. Have a great evening!</p>
                  </div>
                </div>
              )}

              {/* Next Class Panel */}
              <div className="tracker-next-class-panel">
                <h4>Next Scheduled Block</h4>
                {nextClass ? (
                  <div className="next-class-card">
                    <div className="next-class-icon">
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="next-class-info">
                      <p className="next-sub">{nextClass.subject}</p>
                      <p className="next-details">
                        {nextClass.room && `${nextClass.room} • `} 
                        {PERIODS.find(p => p.id === nextClass.period || (nextClass.isBreak && p.id === 0))?.startLabel}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="next-class-empty">
                    <p>No upcoming classes for the rest of today.</p>
                  </div>
                )}
                <button className="btn-view-weekly" onClick={() => setShowWeeklyModal(true)}>
                  <span>View Weekly Timetable</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Daily Timeline Tracker */}
            {!isWeekend && (
              <div className="daily-timeline-section">
                <h3>Today's Timeline</h3>
                <div className="timeline-trail-container">
                  <div className="timeline-trail">
                    {todayClasses.map((cls) => {
                      const periodInfo = PERIODS.find(p => p.id === cls.period || (cls.isBreak && p.id === 0));
                      if (!periodInfo) return null;
                      
                      const startMin = parseTimeToMinutes(periodInfo.start);
                      const endMin = parseTimeToMinutes(periodInfo.end);
                      
                      const isPast = currentMinutes >= endMin;
                      const isActive = currentMinutes >= startMin && currentMinutes < endMin;
                      const isUpcoming = currentMinutes < startMin;
                      
                      return (
                        <div 
                          key={cls.period} 
                          className={`timeline-slot-card ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${isUpcoming ? 'upcoming' : ''}`}
                        >
                          <div className="timeline-slot-time">
                            <span>{periodInfo.startLabel}</span>
                            {isActive && <span className="active-glow-dot"></span>}
                          </div>
                          <div className="timeline-slot-content">
                            <h5 className="slot-subject" title={cls.isBreak ? "Break" : cls.subject}>
                              {cls.isBreak ? "Break" : cls.subject}
                            </h5>
                            {!cls.isBreak && cls.subject !== 'Free' && cls.room ? (
                              <p className="slot-meta" title={`${cls.room} • ${cls.teacher}`}>{cls.room} • {cls.teacher}</p>
                            ) : (
                              <p className="slot-meta-empty">-</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            
          </div>

          {/* Time Warp Testing Debugger — admins only, toggled from Profile */}
          {canTimeWarp && (
          <div className="debugger-collapsible">
            <button className="btn-toggle-debugger" onClick={() => setShowDebugger(!showDebugger)}>
              {showDebugger ? 'Hide Time Warp Controls ▲' : 'Show Time Warp Controls (Test timewarp/weekends) ▼'}
            </button>
            
            {showDebugger && (
              <div className="debugger-panel animate-slide-down">
                <div className="debugger-row">
                  <label className="checkbox-label">
                    <input 
                      type="checkbox" 
                      checked={isSimulated}
                      onChange={handleToggleSimulated}
                    />
                    Enable Simulated Clock (Time Warp)
                  </label>
                </div>
                {isSimulated && (
                  <div className="debugger-controls-row">
                    <div className="control-item">
                      <label htmlFor="simDay">Simulated Day</label>
                      <select 
                        id="simDay"
                        value={simulatedDay} 
                        onChange={(e) => setSimulatedDay(e.target.value)}
                      >
                        {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        <option value="Saturday">Saturday</option>
                        <option value="Sunday">Sunday</option>
                      </select>
                    </div>
                    <div className="control-item">
                      <label htmlFor="simTime">Simulated Time (24h)</label>
                      <input 
                        type="time" 
                        id="simTime"
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
        </>
      )}

      {/* 3. Weekly Timetable Modal Dialog */}
      {showWeeklyModal && hasConfiguredProfile && (
        <div className="weekly-modal-overlay" onClick={() => setShowWeeklyModal(false)}>
          <div className="weekly-modal-card" onClick={(e) => e.stopPropagation()}>
            <header className="weekly-modal-header">
              <div className="header-meta-group">
                <h3>Full Weekly Timetable</h3>
                <p>{course} Sem {semester} Section {section}</p>
              </div>
              <div className="weekly-layout-toggle-group">
                <button 
                  className={`btn-layout-toggle ${weeklyLayoutMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setWeeklyLayoutMode('grid')}
                  title="Grid View"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <span>Grid</span>
                </button>
                <button 
                  className={`btn-layout-toggle ${weeklyLayoutMode === 'list' ? 'active' : ''}`}
                  onClick={() => setWeeklyLayoutMode('list')}
                  title="List View"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="3" />
                    <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="3" />
                    <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="3" />
                  </svg>
                  <span>List</span>
                </button>
              </div>
              <button className="close-btn" onClick={() => setShowWeeklyModal(false)}>×</button>
            </header>
            
            <div className="weekly-modal-body">
              {weeklyLayoutMode === 'list' ? (
                <div className="weekly-list-view">
                  {/* Day tabs selector */}
                  <div className="weekly-tabs-container">
                    {DAYS.map((day) => {
                      const isTabActive = activeWeeklyTab === day;
                      const isCurrentDay = dayOfWeek === day;
                      return (
                        <button
                          key={day}
                          className={`weekly-day-tab ${isTabActive ? 'active' : ''} ${isCurrentDay ? 'is-today' : ''}`}
                          onClick={() => setActiveWeeklyTab(day)}
                        >
                          <span className="tab-day-name">{day.substring(0, 3)}</span>
                          <span className="tab-day-full">{day}</span>
                          {isCurrentDay && <span className="today-dot"></span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* List of periods for selected day */}
                  <div className="weekly-list-timeline">
                    {(() => {
                      const dayClasses = timetable ? timetable[activeWeeklyTab] || [] : [];
                      
                      return PERIODS.map((period) => {
                        const matchClass = dayClasses.find(c => c.period === period.id || (period.isBreak && c.isBreak));
                        const isCurrentPeriod = dayOfWeek === activeWeeklyTab && 
                          (period.isBreak 
                            ? (activeClass && activeClass.isBreak) 
                            : (activeClass && activeClass.period === period.id)
                          );
                        
                        return (
                          <div 
                            key={period.id} 
                            className={`list-timeline-item ${isCurrentPeriod ? 'active-timeline-item' : ''} ${period.isBreak ? 'break-item' : ''}`}
                          >
                            <div className="timeline-time-col">
                              <span className="timeline-period-label">
                                {period.isBreak ? "Break" : period.label}
                              </span>
                              <span className="timeline-time-label">
                                {period.startLabel} - {period.endLabel}
                              </span>
                              {isCurrentPeriod && (
                                <span className="timeline-live-badge">
                                  <span className="live-ping-dot"></span>
                                  LIVE NOW
                                </span>
                              )}
                            </div>

                            <div className="timeline-card-col">
                              {matchClass ? (
                                matchClass.subject === 'Free' ? (
                                  <div className="timeline-free-card">
                                    <span className="free-card-emoji">☕</span>
                                    <div>
                                      <h5>Free Block</h5>
                                      <p>No lectures scheduled during this hour.</p>
                                    </div>
                                  </div>
                                ) : period.isBreak ? (
                                  <div className="timeline-break-card">
                                    <span className="break-card-emoji">🍽️</span>
                                    <div>
                                      <h5>Infinity Hour (Break)</h5>
                                      <p>Grab food at Amul/Nescafe and refresh.</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="timeline-class-card">
                                    <div className="timeline-card-header">
                                      <h4 className="timeline-subject">{matchClass.subject}</h4>
                                    </div>
                                    <div className="timeline-card-meta">
                                      {matchClass.teacher && matchClass.teacher !== '-' && (
                                        <div className="timeline-meta-item">
                                          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                          </svg>
                                          <span>{matchClass.teacher}</span>
                                        </div>
                                      )}
                                      {matchClass.room && matchClass.room !== '-' && (
                                        <div className="timeline-meta-item room-tag">
                                          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none">
                                            <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                                            <circle cx="12" cy="10" r="3" />
                                          </svg>
                                          <span>{matchClass.room}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              ) : (
                                <div className="timeline-empty-card">
                                  <span className="empty-dash">-</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="weekly-timetable-table">
                    <thead>
                      <tr>
                        <th className="sticky-corner-cell">Day</th>
                        {PERIODS.filter(p => !p.isBreak).map((period) => (
                          <th key={period.id}>
                            <div className="th-period-label">{period.label}</div>
                            <div className="th-time-label">{period.startLabel} - {period.endLabel}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((day) => {
                        const dayCls = timetable ? timetable[day] || [] : [];
                        const isToday = dayOfWeek === day;
                        return (
                          <tr key={day} className={isToday ? 'today-row' : ''}>
                            <td className="day-name-cell">
                              <strong>{day}</strong>
                              {isToday && <span className="today-badge">TODAY</span>}
                            </td>
                            {PERIODS.filter(p => !p.isBreak).map((period) => {
                              const matchClass = dayCls.find(c => c.period === period.id);
                              const isCellActive = dayOfWeek === day && activeClass && activeClass.period === period.id;
                              return (
                                <td key={period.id} className={`weekly-class-cell ${matchClass?.subject === 'Free' ? 'free' : ''} ${isCellActive ? 'active-class-cell' : ''}`}>
                                  {matchClass ? (
                                    matchClass.subject === 'Free' ? (
                                      <div className="cell-free-box">
                                        <span className="free-emoji">☕</span>
                                        <span className="free-text">Free Block</span>
                                      </div>
                                    ) : (
                                      <div className="grid-cell-card">
                                        {isCellActive && <span className="live-cell-badge">LIVE</span>}
                                        <div className="cell-subject">{matchClass.subject}</div>
                                        <div className="cell-details-row">
                                          {matchClass.teacher && matchClass.teacher !== '-' && (
                                            <div className="cell-teacher" title="Teacher">
                                              <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" strokeWidth="2.0" fill="none" className="cell-svg-icon">
                                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                                <circle cx="12" cy="7" r="4" />
                                              </svg>
                                              {matchClass.teacher}
                                            </div>
                                          )}
                                          {matchClass.room && matchClass.room !== '-' && (
                                            <div className="cell-room" title="Room">
                                              <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" strokeWidth="2.0" fill="none" className="cell-svg-icon">
                                                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                                                <circle cx="12" cy="10" r="3" />
                                              </svg>
                                              {matchClass.room}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  ) : (
                                    <div className="cell-empty">-</div>
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
            
            <footer className="weekly-modal-footer">
              <span className="break-info-note">☕ Note: Infinity Hour break takes place daily between 12:00 PM and 1:00 PM.</span>
              <button className="btn-close-modal" onClick={() => setShowWeeklyModal(false)}>Close View</button>
            </footer>
          </div>
        </div>
      )}

    </div>
  );
}
