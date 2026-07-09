import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTimetable, PERIODS, DAYS } from '../data/timetables';
import './ClassSchedulesCard.css';

export default function ClassSchedulesCard({ onOpenProfile }) {
  const { user } = useAuth();
  
  // Profile settings
  const course = user?.user_metadata?.course;
  const semester = user?.user_metadata?.semester;
  const section = user?.user_metadata?.section;
  
  const hasConfiguredProfile = course && semester && section;

  // Real-time & Debug states
  const [time, setTime] = useState(getISTTime());
  const [isSimulated, setIsSimulated] = useState(false);
  const [simulatedDay, setSimulatedDay] = useState('Monday');
  const [simulatedTimeStr, setSimulatedTimeStr] = useState('10:15'); // 10:15 AM
  
  // Weekly modal toggle
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);

  // Collapsible debugger state
  const [showDebugger, setShowDebugger] = useState(false);

  // Helper: Get exact date/time in Indian Standard Time (IST = UTC+5.5)
  function getISTTime() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 5.5));
  }

  // Update real-time clock every 10 seconds
  useEffect(() => {
    if (isSimulated) return;
    
    const interval = setInterval(() => {
      setTime(getISTTime());
    }, 10000);

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

  // Calculate remaining minutes for current class
  const getRemainingMinutes = () => {
    if (!activePeriodInfo) return 0;
    const endMin = parseTimeToMinutes(activePeriodInfo.end);
    return endMin - currentMinutes;
  };

  const remainingMinutes = getRemainingMinutes();
  const progressPercent = activePeriodInfo ? Math.round(((60 - remainingMinutes) / 60) * 100) : 0;

  const handleToggleSimulated = (e) => {
    setIsSimulated(e.target.checked);
  };

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
                <p className="subtitle">{course} Sem {semester} Section {section} • {dayOfWeek}</p>
              </div>
              <div className="tracker-time-display">
                <span className="clock-digits">
                  {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                </span>
                <span className="clock-sec">
                  {isWeekend ? 'Weekend' : `Period Slots Active`}
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
              ) : activeClass && activeClass.subject !== 'Free / Study Slot' && !activeClass.isBreak ? (
                <div className="status-hero ongoing">
                  <div className="hero-details">
                    <span className="badge-status live">Ongoing Now</span>
                    <h3>{activeClass.subject}</h3>
                    <p className="teacher-name">Instructed by: <strong>{activeClass.teacher}</strong></p>
                    <p className="room-label">Room: <span className="highlight-tag">{activeClass.room}</span></p>
                  </div>
                  <div className="hero-progress">
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <div className="progress-details">
                      <span>{activePeriodInfo.startLabel} - {activePeriodInfo.endLabel}</span>
                      <span className="time-remaining">{remainingMinutes} mins left</span>
                    </div>
                  </div>
                </div>
              ) : activeClass && activeClass.isBreak ? (
                <div className="status-hero break">
                  <div className="hero-details">
                    <span className="badge-status break-badge">Infinity Hour</span>
                    <h3>Lunch / Mid-day Break</h3>
                    <p>Relax and regroup. No unsupervised course lectures active during this block.</p>
                  </div>
                  <div className="hero-progress">
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill break" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <div className="progress-details">
                      <span>12:00 PM - 1:00 PM</span>
                      <span>{remainingMinutes} mins left</span>
                    </div>
                  </div>
                </div>
              ) : activeClass && activeClass.subject === 'Free / Study Slot' ? (
                <div className="status-hero free-slot">
                  <div className="hero-details">
                    <span className="badge-status free">Study Hour</span>
                    <h3>Self Study / Free Slot</h3>
                    <p>Use this block for coursework revision, library resources, or project collaborations.</p>
                  </div>
                  <div className="hero-progress">
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill free" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                    <div className="progress-details">
                      <span>{activePeriodInfo.startLabel} - {activePeriodInfo.endLabel}</span>
                      <span>{remainingMinutes} mins left</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="status-hero inactive">
                  <div className="hero-details">
                    <span className="badge-status offline">Classes Completed</span>
                    <h3>Academic Slots Inactive</h3>
                    <p>All scheduled sessions for today have concluded. Have a great evening!</p>
                  </div>
                </div>
              )}

              {/* Next Class Panel */}
              <div className="tracker-next-class-panel">
                <h4>Next Scheduled Block</h4>
                {nextClass ? (
                  <div className="next-class-card">
                    <div className="next-class-icon">
                      <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="next-class-info">
                      <p className="next-sub">{nextClass.subject}</p>
                      <p className="next-details">
                        {nextClass.room && `Room ${nextClass.room} • `} 
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
                  📅 View Weekly Timetable
                </button>
              </div>
            </div>

            {/* Daily Timeline Tracker */}
            {!isWeekend && (
              <div className="daily-timeline-section">
                <h3>Today's Timeline</h3>
                <div className="timeline-grid">
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
                          <h5 className="slot-subject">{cls.isBreak ? "Break" : cls.subject}</h5>
                          {!cls.isBreak && cls.subject !== 'Free / Study Slot' && (
                            <p className="slot-meta">{cls.room} • {cls.teacher}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
          </div>

          {/* Time Warp Testing Debugger */}
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
        </>
      )}

      {/* 3. Weekly Timetable Modal Dialog */}
      {showWeeklyModal && hasConfiguredProfile && (
        <div className="weekly-modal-overlay" onClick={() => setShowWeeklyModal(false)}>
          <div className="weekly-modal-card" onClick={(e) => e.stopPropagation()}>
            <header className="weekly-modal-header">
              <div>
                <h3>Full Weekly Timetable</h3>
                <p>{course} Sem {semester} Section {section}</p>
              </div>
              <button className="close-btn" onClick={() => setShowWeeklyModal(false)}>×</button>
            </header>
            
            <div className="weekly-modal-body">
              <div className="table-responsive">
                <table className="weekly-timetable-table">
                  <thead>
                    <tr>
                      <th>Day</th>
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
                      return (
                        <tr key={day}>
                          <td className="day-name-cell"><strong>{day}</strong></td>
                          {PERIODS.filter(p => !p.isBreak).map((period) => {
                            const matchClass = dayCls.find(c => c.period === period.id);
                            return (
                              <td key={period.id} className={`weekly-class-cell ${matchClass?.subject === 'Free / Study Slot' ? 'free' : ''}`}>
                                {matchClass ? (
                                  matchClass.subject === 'Free / Study Slot' ? (
                                    <div className="cell-free">Study Hour</div>
                                  ) : (
                                    <>
                                      <div className="cell-subject">{matchClass.subject}</div>
                                      <div className="cell-teacher">{matchClass.teacher}</div>
                                      <div className="cell-room">{matchClass.room}</div>
                                    </>
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
