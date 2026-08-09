import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useTimetable } from '../context/TimetableContext';
import { PERIODS, DAYS } from '../data/timetables';
import NoticeBoard from './NoticeBoard';
import NotificationCenter from './NotificationCenter';
import { SearchIcon, PercentIcon, CalculatorIcon, FileIcon, TrophyIcon, DoorIcon, HeartIcon, UsersIcon, UserIcon } from './icons';
import { isAdminEmail, canAccessTeamFinder, canAccessEmptyRoom, canAccessFacultyDatabase, isTimeWarpEnabled } from '../lib/admin';

import './HomeDashboard.css';

function getISTTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 5.5);
}

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const ROOM_DISPLAY_MAP = {
  'Hin A / Hin C / Hin D': 'Room 607 / Room 644 / Room 648',
  'room 607 / room 644 / Room 648': 'Room 607 / Room 644 / Room 648',
  'Hin A': 'Room 607',
  'Hindi A': 'Room 607',
  'Hin B': 'Room 607',
  'Hindi B': 'Room 607',
  'Hin C': 'Room 644',
  'Hindi C': 'Room 644',
  'Hin D': 'Room 648',
  'Hindi D': 'Room 648'
};

export default function HomeDashboard({ onNavigate, onOpenProfile }) {
  const { user } = useAuth();
  const { featureFlags } = useConfig();
  const isAdmin = isAdminEmail(user?.email);
  const canTimeWarp = isAdmin && isTimeWarpEnabled();

  const { getTimetable, holidays } = useTimetable();

  // Time & Simulation states
  const [time, setTime] = useState(getISTTime());
  const [isSimulated, setIsSimulated] = useState(false);
  const [simulatedDay, setSimulatedDay] = useState('Monday');
  const [simulatedTimeStr, setSimulatedTimeStr] = useState('10:15');

  // Timetable UI states
  const [showTimeline, setShowTimeline] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [weeklyLayoutMode, setWeeklyLayoutMode] = useState('grid');
  const [activeWeeklyTab, setActiveWeeklyTab] = useState('Monday');
  const [showDebugger, setShowDebugger] = useState(false);

  // Profile setup
  const course = user?.user_metadata?.course;
  const semester = user?.user_metadata?.semester;
  const section = user?.user_metadata?.section;
  const hasProfile = Boolean(course && semester && section);

  // Ticking Clock
  useEffect(() => {
    if (isSimulated) return;
    const interval = setInterval(() => setTime(getISTTime()), 1000);
    return () => clearInterval(interval);
  }, [isSimulated]);

  // Simulation handler
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

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Student';
  const firstName = displayName.split(' ')[0];

  const hour = time.getHours();
  const greeting = (hour >= 5 && hour < 12)
    ? 'Good morning'
    : (hour >= 12 && hour < 17)
    ? 'Good afternoon'
    : 'Good evening';

  const realTodayDay = DAYS[time.getDay() - 1] || 'Sunday';
  const currentDayName = isSimulated ? simulatedDay : realTodayDay;
  const isWeekend = currentDayName === 'Sunday' || currentDayName === 'Saturday';
  const currentMinutes = hour * 60 + time.getMinutes();

  const timetable = hasProfile ? getTimetable(course, semester, section) : null;
  const todayClasses = timetable ? timetable[currentDayName] || [] : [];

  // Check holiday
  const todayStr = time.getFullYear() + '-' + String(time.getMonth() + 1).padStart(2, '0') + '-' + String(time.getDate()).padStart(2, '0');
  const todayHoliday = holidays?.find(h => h.date === todayStr);

  // Room Resolver
  const resolveRoom = (room) => {
    if (!room) return '';
    const cleanR = room.trim();
    if (ROOM_DISPLAY_MAP[cleanR]) return ROOM_DISPLAY_MAP[cleanR];

    if (cleanR === 'P' || cleanR === 'p') {
      if (timetable) {
        const roomCounts = {};
        for (const d of DAYS) {
          const classes = timetable[d] || [];
          for (const cls of classes) {
            if (cls.room && cls.room !== 'P' && cls.room !== 'p' && cls.room !== '-' && !cls.isBreak) {
              const displayR = ROOM_DISPLAY_MAP[cls.room.trim()] || cls.room;
              roomCounts[displayR] = (roomCounts[displayR] || 0) + 1;
            }
          }
        }
        const sorted = Object.entries(roomCounts).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) return sorted[0][0];
      }
      return '';
    }
    return cleanR;
  };

  // Find active and next class
  let activeClass = null;
  let activePeriod = null;
  let nextClass = null;
  let nextPeriod = null;

  if (timetable && !isWeekend && !todayHoliday) {
    if (currentMinutes >= 720 && currentMinutes < 780) {
      activeClass = { period: 0, isBreak: true, subject: 'Infinity Hour (Break)', teacher: '-', room: '-' };
      activePeriod = PERIODS.find(p => p.id === 0);
    } else {
      todayClasses.forEach((cls) => {
        const p = PERIODS.find((x) => x.id === cls.period);
        if (!p) return;
        const startMin = parseTimeToMinutes(p.start);
        const endMin = parseTimeToMinutes(p.end);
        if (currentMinutes >= startMin && currentMinutes < endMin) {
          activeClass = cls;
          activePeriod = p;
        }
        if (startMin > currentMinutes) {
          const nextStart = parseTimeToMinutes(PERIODS.find(x => x.id === (nextClass?.period || 0))?.start || '23:59');
          if (!nextClass || startMin < nextStart) {
            nextClass = cls;
            nextPeriod = p;
          }
        }
      });
    }
  }

  const remaining = () => {
    if (!activePeriod) return '';
    const endSec = parseTimeToMinutes(activePeriod.end) * 60;
    const nowSec = hour * 3600 + time.getMinutes() * 60 + time.getSeconds();
    const diff = Math.max(0, endSec - nowSec);
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    if (h > 0) return `${h}h ${m}m left`;
    if (m > 0) return `${m}m ${s}s left`;
    return `${s}s left`;
  };

  const progress = () => {
    if (!activePeriod) return 0;
    const start = parseTimeToMinutes(activePeriod.start) * 60;
    const end = parseTimeToMinutes(activePeriod.end) * 60;
    const nowSec = hour * 3600 + time.getMinutes() * 60 + time.getSeconds();
    return Math.max(0, Math.min(100, ((nowSec - start) / (end - start)) * 100));
  };

  const isRealClass = activeClass && !activeClass.isBreak && activeClass.subject !== 'Free';

  // Responsive modal layout toggle sync
  useEffect(() => {
    if (showWeeklyModal) {
      const isMobileScreen = window.innerWidth <= 768;
      setWeeklyLayoutMode(isMobileScreen ? 'list' : 'grid');
      setActiveWeeklyTab(DAYS.includes(currentDayName) ? currentDayName : 'Monday');
    }
  }, [showWeeklyModal]);

  const renderLiveCard = () => {
    if (!hasProfile) {
      return (
        <div className="home-live-card">
          <span className="micro-label dim">SETUP REQUIRED</span>
          <div className="live-subject">Set up your class schedule</div>
          <div className="live-meta">Configure your course, semester, and section to view your live timetable & schedules.</div>
          <button className="btn-ink" style={{ marginTop: 12 }} onClick={onOpenProfile}>
            Set up profile
          </button>
        </div>
      );
    }

    const renderLiveDisclaimer = () => (
      <div className="live-card-disclaimer">
        <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>Uses latest official timetable. Subject to professor changes/cancellations.</span>
      </div>
    );

    const renderActionButtons = () => (
      <div className="home-tt-actions-row">
        <button
          className={`home-tt-btn ${showTimeline ? 'active' : ''}`}
          onClick={() => setShowTimeline(!showTimeline)}
        >
          {showTimeline ? "Hide Today's Schedule ▲" : "View Today's Schedule ▼"}
        </button>
        <button
          className="home-tt-btn primary"
          onClick={() => setShowWeeklyModal(true)}
        >
          Full Week Timetable 📅
        </button>
      </div>
    );

    if (todayHoliday) {
      return (
        <div className="home-live-card" style={{ borderLeft: '4px solid var(--maroon)' }}>
          <span className="micro-label maroon">● {todayHoliday.type.toUpperCase()}</span>
          <div className="live-subject">{todayHoliday.title}</div>
          <div className="live-meta">{todayHoliday.message || 'No classes scheduled for today.'}</div>
          {renderActionButtons()}
        </div>
      );
    }

    if (isWeekend) {
      return (
        <div className="home-live-card">
          <span className="micro-label dim">WEEKEND</span>
          <div className="live-subject">No classes today</div>
          <div className="live-meta">Relax, catch up on projects, and enjoy your weekend!</div>
          {renderActionButtons()}
          {renderLiveDisclaimer()}
        </div>
      );
    }

    if (isRealClass) {
      const roomStr = resolveRoom(activeClass.room);
      return (
        <div className="home-live-card">
          <div className="live-topline">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span className="micro-label success">● IN CLASS</span>
              {(activeClass.isPractical || /\b\(P\)\b/i.test(activeClass.subject) || /\bPractical\b/i.test(activeClass.subject)) && (
                <span className="badge-practical">🧪 Practical</span>
              )}
              {(activeClass.isUnsupervised || activeClass.teacher === 'Unsupervised' || /\bunsupervised\b/i.test(activeClass.subject || '')) && (
                <span className="badge-unsupervised">👤 Unsupervised</span>
              )}
            </div>
            <span className="live-countdown">{remaining()}</span>
          </div>
          <div className="live-subject">{activeClass.subject}</div>
          <div className="live-meta">
            {[
              activeClass.teacher && activeClass.teacher !== '-' ? activeClass.teacher : null,
              roomStr ? (roomStr.toLowerCase().startsWith('room') ? roomStr : `Room ${roomStr}`) : null,
              activePeriod ? `till ${activePeriod.endLabel}` : null
            ].filter(Boolean).join(' · ')}
          </div>
          <div className="live-progress">
            <div className="live-progress-fill" style={{ width: `${progress()}%` }}></div>
          </div>
          {nextClass && nextPeriod && (
            <div className="live-next-row">
              <span className="live-next-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Next — {nextClass.isBreak ? 'Break' : nextClass.subject}
                {resolveRoom(nextClass.room) && !nextClass.isBreak ? ` · ${resolveRoom(nextClass.room)}` : ''}
                {(!nextClass.isBreak && (nextClass.isPractical || /\b\(P\)\b/i.test(nextClass.subject) || /\bPractical\b/i.test(nextClass.subject))) && (
                  <span className="badge-practical-sm">Practical</span>
                )}
                {(!nextClass.isBreak && (nextClass.isUnsupervised || nextClass.teacher === 'Unsupervised' || /\bunsupervised\b/i.test(nextClass.subject || ''))) && (
                  <span className="badge-unsupervised-sm">Unsupervised</span>
                )}
              </span>
              <span className="live-next-time">{nextPeriod.startLabel}</span>
            </div>
          )}
          {renderActionButtons()}
          {renderLiveDisclaimer()}
        </div>
      );
    }

    if (activeClass && activeClass.isBreak) {
      return (
        <div className="home-live-card">
          <div className="live-topline">
            <span className="micro-label gold">● INFINITY HOUR</span>
            <span className="live-countdown">{remaining()}</span>
          </div>
          <div className="live-subject">Break</div>
          <div className="live-meta">Go to Nescafe or Amul and chill! :)</div>
          <div className="live-progress">
            <div className="live-progress-fill" style={{ width: `${progress()}%` }}></div>
          </div>
          {nextClass && nextPeriod && (
            <div className="live-next-row">
              <span className="live-next-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Next — {nextClass.subject}
                {resolveRoom(nextClass.room) ? ` · ${resolveRoom(nextClass.room)}` : ''}
                {(nextClass.isPractical || /\b\(P\)\b/i.test(nextClass.subject) || /\bPractical\b/i.test(nextClass.subject)) && (
                  <span className="badge-practical-sm">Practical</span>
                )}
                {(nextClass.isUnsupervised || nextClass.teacher === 'Unsupervised' || /\bunsupervised\b/i.test(nextClass.subject || '')) && (
                  <span className="badge-unsupervised-sm">Unsupervised</span>
                )}
              </span>
              <span className="live-next-time">{nextPeriod.startLabel}</span>
            </div>
          )}
          {renderActionButtons()}
          {renderLiveDisclaimer()}
        </div>
      );
    }

    if (activeClass && activeClass.subject === 'Free') {
      return (
        <div className="home-live-card">
          <div className="live-topline">
            <span className="micro-label dim">FREE PERIOD</span>
            <span className="live-countdown">{remaining()}</span>
          </div>
          <div className="live-subject">Free block</div>
          <div className="live-meta">No lecture right now — good time for coursework.</div>
          <div className="live-progress">
            <div className="live-progress-fill" style={{ width: `${progress()}%` }}></div>
          </div>
          {nextClass && nextPeriod && (
            <div className="live-next-row">
              <span className="live-next-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Next — {nextClass.subject}
                {resolveRoom(nextClass.room) ? ` · ${resolveRoom(nextClass.room)}` : ''}
                {(nextClass.isPractical || /\b\(P\)\b/i.test(nextClass.subject) || /\bPractical\b/i.test(nextClass.subject)) && (
                  <span className="badge-practical-sm">Practical</span>
                )}
                {(nextClass.isUnsupervised || nextClass.teacher === 'Unsupervised' || /\bunsupervised\b/i.test(nextClass.subject || '')) && (
                  <span className="badge-unsupervised-sm">Unsupervised</span>
                )}
              </span>
              <span className="live-next-time">{nextPeriod.startLabel}</span>
            </div>
          )}
          {renderActionButtons()}
          {renderLiveDisclaimer()}
        </div>
      );
    }

    if (nextClass && nextPeriod) {
      return (
        <div className="home-live-card">
          <div className="live-topline">
            <span className="micro-label dim">UP NEXT</span>
            <span className="live-countdown">{nextPeriod.startLabel}</span>
          </div>
          <div className="live-subject">{nextClass.isBreak ? 'Break' : nextClass.subject}</div>
          <div className="live-meta">
            {[!nextClass.isBreak && nextClass.teacher, !nextClass.isBreak && resolveRoom(nextClass.room)]
              .filter(Boolean)
              .join(' · ') || 'Starts soon'}
          </div>
          {renderActionButtons()}
          {renderLiveDisclaimer()}
        </div>
      );
    }

    return (
      <div className="home-live-card">
        <span className="micro-label dim">DONE FOR TODAY</span>
        <div className="live-subject">Classes completed</div>
        <div className="live-meta">All scheduled sessions for today have concluded. Have a great evening!</div>
        {renderActionButtons()}
        {renderLiveDisclaimer()}
      </div>
    );
  };

  const hasTeamFinderAccess = featureFlags['team-finder'] || canAccessTeamFinder(user?.email);
  const hasEmptyRoomAccess = featureFlags['empty-room'] || canAccessEmptyRoom(user?.email);
  const hasFacultyDbAccess = canAccessFacultyDatabase(user?.email);

  const tools = [
    { id: 'society-tracker', micro: 'SOON', microClass: 'dim', title: 'Society Recruitment Tracker', desc: 'Keep track of info & form deadlines for societies', Icon: UsersIcon, locked: true },
    ...(hasTeamFinderAccess ? [{ id: 'team-finder', micro: 'NEW', microClass: 'success', title: 'Team Finder & Compete Hub', desc: 'Find teammates & post comp openings', Icon: TrophyIcon, locked: false }] : []),
    { id: 'pyqs', micro: 'SOON', microClass: 'dim', title: 'PYQs & Resources', desc: 'Papers, syllabus, notes', Icon: FileIcon, locked: !featureFlags['pyqs'] && !isAdmin },
    { id: 'waiver', micro: 'SOON', microClass: 'dim', title: 'Waiver Tool', desc: 'Clear attendance smartly', Icon: PercentIcon, locked: !featureFlags['waiver'] && !isAdmin },
    { id: 'gpa', micro: 'DU', microClass: 'maroon', title: 'GPA Calculator', desc: 'SGPA & CGPA, official schemas', Icon: CalculatorIcon, locked: !featureFlags['gpa'] && !isAdmin },
    { id: 'confessions-matchmaker', micro: 'SOON', microClass: 'dim', title: 'Campus Confessions & Matchmaker', desc: "We're still thinking on this, DM to let us know you'd like this :)", Icon: HeartIcon, locked: true },
    { id: 'find-prof', micro: 'SEARCH', microClass: 'success', title: 'Find My Professor', desc: "Who's teaching where, right now", Icon: SearchIcon, locked: !featureFlags['find-prof'] && !isAdmin },
    { id: 'empty-room', micro: 'LIVE', microClass: 'success', title: 'Empty Room Finder', desc: 'Spot vacant classrooms in real-time or well in advance', Icon: DoorIcon, locked: false },
  ];

  return (
    <div className="home-dashboard">
      <div className="home-main-col">
        {/* Greeting & Header */}
        <div className="home-greeting-row">
          <div>
            <h1 className="home-greeting">{greeting}, {firstName}</h1>
            <div className="micro-label dim home-class-label">
              {hasProfile
                ? `${course} · SEM ${semester} · SECTION ${section}`.toUpperCase()
                : 'PROFILE NOT CONFIGURED'}
            </div>
          </div>
          <div className="home-greeting-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="ist-pill">
              IST {String(hour % 12 || 12).padStart(2, '0')}:{String(time.getMinutes()).padStart(2, '0')}:{String(time.getSeconds()).padStart(2, '0')} {hour >= 12 ? 'PM' : 'AM'}
            </span>
            <div className="desktop-only-notif">
              <NotificationCenter onNavigate={onNavigate} />
            </div>
          </div>
        </div>

        {/* Live Class Card */}
        {renderLiveCard()}

        {/* Original Daily Timeline Tracker */}
        {hasProfile && showTimeline && !isWeekend && !todayHoliday && (
          <div className="daily-timeline-section animate-fade-in" style={{ marginBottom: '24px' }}>
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
                      </div>
                      <div className="timeline-slot-content">
                        <div className="timeline-subject-header" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <h5 className="slot-subject" title={cls.isBreak ? "Break" : cls.subject}>
                            {cls.isBreak ? "Break" : cls.subject}
                          </h5>
                          {!cls.isBreak && (cls.isPractical || /\b\(P\)\b/i.test(cls.subject) || /\bPractical\b/i.test(cls.subject)) && (
                            <span className="badge-practical-xs">Practical</span>
                          )}
                          {!cls.isBreak && (cls.isUnsupervised || cls.teacher === 'Unsupervised' || /\bunsupervised\b/i.test(cls.subject || '')) && (
                            <span className="badge-unsupervised-xs">Unsupervised</span>
                          )}
                        </div>
                        {!cls.isBreak && cls.subject !== 'Free' && resolveRoom(cls.room) ? (
                          <p className="slot-meta" title={`${resolveRoom(cls.room)} • ${cls.teacher}`}>{resolveRoom(cls.room)} • {cls.teacher}</p>
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

        {/* Time Warp Testing Debugger for Admins */}
        {canTimeWarp && (
          <div className="debugger-collapsible" style={{ marginBottom: '20px' }}>
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
                      onChange={(e) => setIsSimulated(e.target.checked)}
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

        {/* Tools Section */}
        <div className="home-tools-section">
          <div className="home-section-head">
            <span className="home-section-title">Tools</span>
          </div>
          <div className="home-tools-grid">
            {tools.map(({ id, title, desc, Icon, locked }) => (
              <button
                key={id}
                className={`home-tool-card ${locked ? 'locked' : ''}`}
                onClick={() => !locked && onNavigate(id)}
                disabled={locked}
              >
                <span className="tool-title">{title}</span>
                <span className="tool-desc">{desc}</span>
                {!locked && <span className="tool-launch">Launch →</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Campus Buzz / Notice Board Column */}
      <div className="home-buzz-col">
        <NoticeBoard onNavigate={onNavigate} />
      </div>

      {/* Original Full Weekly Timetable Modal Dialog */}
      {showWeeklyModal && hasProfile && (
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
                      const isToday = currentDayName === day;
                      return (
                        <button
                          key={day}
                          className={`weekly-day-tab ${isTabActive ? 'active' : ''} ${isToday ? 'is-today' : ''}`}
                          onClick={() => setActiveWeeklyTab(day)}
                        >
                          <span className="tab-day-name">{day.substring(0, 3)}</span>
                          <span className="tab-day-full">{day}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* List of periods for selected day */}
                  <div className="weekly-list-timeline">
                    {(() => {
                      const dayClasses = timetable ? timetable[activeWeeklyTab] || [] : [];
                      return PERIODS.map((period) => {
                        const isBreakPeriod = period.isBreak;
                        const matchClass = dayClasses.find(c => c.period === period.id || (isBreakPeriod && c.isBreak));
                        const isSlotActive = activeWeeklyTab === currentDayName && activeClass && activeClass.period === period.id;
                        
                        return (
                          <div 
                            key={period.id} 
                            className={`list-timeline-item ${isSlotActive ? 'active-timeline-item' : ''}`}
                          >
                            <div className="timeline-time-col">
                              <span className="timeline-period-label">{period.isBreak ? 'Break' : period.label}</span>
                              <span className="timeline-time-label">{period.startLabel} - {period.endLabel}</span>
                              {isSlotActive && <span className="timeline-live-badge">LIVE NOW</span>}
                            </div>
                            
                            <div className="timeline-card-col">
                              {isBreakPeriod ? (
                                <div className="timeline-break-card">
                                  <span className="break-card-emoji">🍽️</span>
                                  <div>
                                    <h5>Infinity Hour (Break)</h5>
                                    <p>Nescafe, Amul, or Lawn chill period</p>
                                  </div>
                                </div>
                              ) : matchClass ? (
                                matchClass.subject === 'Free' ? (
                                  <div className="timeline-free-card">
                                    <span className="free-card-emoji">☕</span>
                                    <div>
                                      <h5>Free Block</h5>
                                      <p>No lecture scheduled</p>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="timeline-class-card">
                                    <div className="card-top-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
                                      <h4 className="timeline-subject" style={{ margin: 0 }}>{matchClass.subject}</h4>
                                      <div className="badges-group" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {(matchClass.isPractical || /\b\(P\)\b/i.test(matchClass.subject) || /\bPractical\b/i.test(matchClass.subject)) && (
                                          <span className="badge-practical-sm">Practical</span>
                                        )}
                                        {(matchClass.isUnsupervised || matchClass.teacher === 'Unsupervised' || /\bunsupervised\b/i.test(matchClass.subject || '')) && (
                                          <span className="badge-unsupervised-sm">Unsupervised</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="timeline-card-meta">
                                      {matchClass.teacher && matchClass.teacher !== '-' && (
                                        <div className="timeline-meta-item">
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                                          </svg>
                                          <span>{matchClass.teacher}</span>
                                        </div>
                                      )}
                                      {resolveRoom(matchClass.room) && resolveRoom(matchClass.room) !== '-' && (
                                        <div className="timeline-meta-item room-tag">
                                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                                          </svg>
                                          <span>{resolveRoom(matchClass.room)}</span>
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
                        {PERIODS.map((period) => (
                          <th key={period.id} className={period.isBreak ? 'th-break-col' : ''}>
                            <div className="th-period-label">{period.isBreak ? 'Break' : period.label}</div>
                            <div className="th-time-label">{period.startLabel} - {period.endLabel}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map((day) => {
                        const dayCls = timetable ? timetable[day] || [] : [];
                        const isToday = currentDayName === day;
                        return (
                          <tr key={day} className={isToday ? 'today-row' : ''}>
                            <td className="day-name-cell">
                              <strong>{day}</strong>
                              {isToday && <span className="today-badge">TODAY</span>}
                            </td>
                            {PERIODS.map((period) => {
                              if (period.isBreak) {
                                return (
                                  <td key={period.id} className="weekly-class-cell break-grid-cell">
                                    <div className="cell-free-box break-box">
                                      <span className="free-emoji">🍽️</span>
                                      <span className="free-text">Infinity Hour</span>
                                    </div>
                                  </td>
                                );
                              }
                              const matchClass = dayCls.find(c => c.period === period.id);
                              const isCellActive = currentDayName === day && activeClass && activeClass.period === period.id;
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
                                        <div className="grid-cell-badges" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                          {isCellActive && <span className="live-cell-badge">LIVE</span>}
                                          {(matchClass.isPractical || /\b\(P\)\b/i.test(matchClass.subject) || /\bPractical\b/i.test(matchClass.subject)) && (
                                            <span className="grid-practical-badge" title="Practical Class">P</span>
                                          )}
                                          {(matchClass.isUnsupervised || matchClass.teacher === 'Unsupervised' || /\bunsupervised\b/i.test(matchClass.subject || '')) && (
                                            <span className="grid-unsupervised-badge" title="Unsupervised Class">U</span>
                                          )}
                                        </div>
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
                                          {resolveRoom(matchClass.room) && resolveRoom(matchClass.room) !== '-' && (
                                            <div className="cell-room" title="Room">
                                              <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" strokeWidth="2.0" fill="none" className="cell-svg-icon">
                                                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                                                <circle cx="12" cy="10" r="3" />
                                              </svg>
                                              {resolveRoom(matchClass.room)}
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
              <span className="break-info-note">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2" fill="none" style={{ flexShrink: 0, verticalAlign: 'middle', marginRight: '5px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                Uses latest college email schedule (NOT real-time tracking; subject to professor changes/cancellation). Infinity Hour break: 12:00 PM – 1:00 PM.
              </span>
              <button className="btn-close-modal" onClick={() => setShowWeeklyModal(false)}>Close View</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
