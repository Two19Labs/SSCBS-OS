import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTimetable } from '../context/TimetableContext';
import { useAuth } from '../context/AuthContext';
import { PERIODS, DAYS } from '../data/timetables';
import { ImageIcon } from './icons';
import { exportScheduleAsImage } from '../utils/exportUtils';
import { trackTimetableEvent } from '../lib/analytics';
import { getISTTime, computeSectionSchedule, parseTimeToMinutes } from '../utils/timetableSchedule';
import './OtherSectionsModal.css';

export default function OtherSectionsModal({
  isOpen,
  onClose,
  initialCourse,
  initialSemester,
  initialSection,
  onPreviewOnDashboard
}) {
  const { timetable, getTimetable, holidays } = useTimetable();
  const { user } = useAuth();

  const userCourse = user?.user_metadata?.course || 'BMS';
  const userSem = user?.user_metadata?.semester || '1';
  const userSec = user?.user_metadata?.section || 'A';

  // Selection states
  const [selectedCourse, setSelectedCourse] = useState(initialCourse || userCourse);
  const [selectedSemester, setSelectedSemester] = useState(initialSemester || userSem);
  const [selectedSection, setSelectedSection] = useState(initialSection || userSec);

  // Tab & Layout states
  const [viewTab, setViewTab] = useState('realtime'); // 'realtime' | 'weekly'
  const [weeklyLayoutMode, setWeeklyLayoutMode] = useState('grid');
  const [activeWeeklyTab, setActiveWeeklyTab] = useState('Monday');
  const [timelineViewDay, setTimelineViewDay] = useState(null); // 'today' | 'tomorrow'

  // Clock state (live IST ticking)
  const [time, setTime] = useState(getISTTime());

  // Export states
  const scheduleExportRef = useRef(null);
  const fullWeeklyGridRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  // Live IST Clock
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTime(getISTTime()), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Sync initial props when opened
  useEffect(() => {
    if (isOpen) {
      if (initialCourse) setSelectedCourse(initialCourse);
      if (initialSemester) setSelectedSemester(initialSemester);
      if (initialSection) setSelectedSection(initialSection);

      const isMobileScreen = window.innerWidth <= 768;
      setWeeklyLayoutMode(isMobileScreen ? 'list' : 'grid');
    }
  }, [isOpen, initialCourse, initialSemester, initialSection]);

  // ESC key listener to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Dynamic Courses
  const availableCourses = useMemo(() => {
    if (timetable && Object.keys(timetable).length > 0) {
      return Object.keys(timetable);
    }
    return ['BMS', 'BBA FIA', 'Bsc Comp Sci'];
  }, [timetable]);

  // Dynamic Semesters for Selected Course
  const availableSemesters = useMemo(() => {
    if (timetable && timetable[selectedCourse]) {
      const sems = Object.keys(timetable[selectedCourse]);
      if (sems.length > 0) return sems.sort((a, b) => Number(a) - Number(b));
    }
    return ['1', '3', '5', '7'];
  }, [timetable, selectedCourse]);

  // Dynamic Sections for Selected Course & Semester
  const availableSections = useMemo(() => {
    if (timetable && timetable[selectedCourse] && timetable[selectedCourse][selectedSemester]) {
      const secs = Object.keys(timetable[selectedCourse][selectedSemester]);
      if (secs.length > 0) return secs.sort();
    }
    if (selectedCourse === 'BMS') return ['A', 'B', 'C', 'D'];
    if (selectedCourse === 'BBA FIA') return ['A', 'B'];
    return ['A'];
  }, [timetable, selectedCourse, selectedSemester]);

  // Auto-adjust semester when course changes
  const handleCourseChange = (newCourse) => {
    setSelectedCourse(newCourse);
    let newSem = selectedSemester;
    let newSec = selectedSection;

    if (timetable && timetable[newCourse]) {
      const sems = Object.keys(timetable[newCourse]).sort((a, b) => Number(a) - Number(b));
      if (!sems.includes(newSem) && sems.length > 0) {
        newSem = sems[0];
      }
      const secs = timetable[newCourse][newSem] ? Object.keys(timetable[newCourse][newSem]).sort() : ['A'];
      if (!secs.includes(newSec) && secs.length > 0) {
        newSec = secs[0];
      }
    } else {
      if (newCourse === 'Bsc Comp Sci') newSec = 'A';
      else if (newCourse === 'BBA FIA' && (newSec === 'C' || newSec === 'D')) newSec = 'A';
    }

    setSelectedSemester(newSem);
    setSelectedSection(newSec);
    trackTimetableEvent('change_other_section_course', { course: newCourse });
  };

  // Auto-adjust section when semester changes
  const handleSemesterChange = (newSem) => {
    setSelectedSemester(newSem);
    let newSec = selectedSection;
    if (timetable && timetable[selectedCourse] && timetable[selectedCourse][newSem]) {
      const secs = Object.keys(timetable[selectedCourse][newSem]).sort();
      if (!secs.includes(newSec) && secs.length > 0) {
        newSec = secs[0];
      }
    }
    setSelectedSection(newSec);
    trackTimetableEvent('change_other_section_semester', { semester: newSem });
  };

  const handleSectionChange = (newSec) => {
    setSelectedSection(newSec);
    trackTimetableEvent('change_other_section', { section: newSec });
  };

  // Load section timetable
  const sectionTimetable = useMemo(() => {
    return getTimetable(selectedCourse, selectedSemester, selectedSection);
  }, [getTimetable, selectedCourse, selectedSemester, selectedSection]);

  // Compute live schedule metrics
  const scheduleMetrics = useMemo(() => {
    return computeSectionSchedule({
      timetable: sectionTimetable,
      time,
      holidays
    });
  }, [sectionTimetable, time, holidays]);

  const {
    hour,
    currentDayName,
    isWeekend,
    currentMinutes,
    isEveningMode,
    nextCollegeDayName,
    isEveningPreviewActive,
    todayClasses,
    nextDayClasses,
    firstNextDayClass,
    firstNextDayPeriod,
    nextDayRealClassCount,
    todayHoliday,
    tomorrowHoliday,
    nextCollegeHoliday,
    activeClass,
    activePeriod,
    nextClass,
    nextPeriod,
    remainingStr,
    progressPct,
    isRealClass,
    resolveRoom
  } = scheduleMetrics;

  // Sync default active weekly tab
  useEffect(() => {
    const defaultTab = (isEveningPreviewActive || (currentDayName === 'Friday' && isEveningMode)) && DAYS.includes(nextCollegeDayName)
      ? nextCollegeDayName
      : (DAYS.includes(currentDayName) ? currentDayName : 'Monday');
    setActiveWeeklyTab(defaultTab);
  }, [isEveningPreviewActive, currentDayName, isEveningMode, nextCollegeDayName]);

  const effectiveTimelineTarget = timelineViewDay || (isEveningPreviewActive || (currentDayName === 'Friday' && isEveningMode) ? 'tomorrow' : 'today');
  const activeTimelineDayName = effectiveTimelineTarget === 'tomorrow' ? nextCollegeDayName : currentDayName;
  const displayedTimelineClasses = sectionTimetable ? (sectionTimetable[activeTimelineDayName] || []) : [];

  // Export timetable handler
  const handleExportSchedule = async () => {
    const targetEl = fullWeeklyGridRef.current || scheduleExportRef.current;
    if (!targetEl) return;
    setIsExporting(true);
    setExportMessage(null);
    trackTimetableEvent('export_attempt', { course: selectedCourse, semester: selectedSemester, section: selectedSection });
    try {
      await exportScheduleAsImage({
        element: targetEl,
        title: `${selectedCourse} Sem ${selectedSemester} Sec ${selectedSection}`,
        fileName: `SSCBS_${selectedCourse}_Sem${selectedSemester}_Sec${selectedSection}_Timetable`
      });
      trackTimetableEvent('export_success', { course: selectedCourse, semester: selectedSemester, section: selectedSection });
      setExportMessage('PNG Downloaded! 🎉');
      setTimeout(() => setExportMessage(null), 3500);
    } catch (err) {
      console.error('Export error:', err);
      trackTimetableEvent('export_failure', { error: err.message });
      setExportMessage('Export failed.');
      setTimeout(() => setExportMessage(null), 3500);
    } finally {
      setIsExporting(false);
    }
  };

  const isUserOwnSection = selectedCourse === userCourse && selectedSemester === userSem && selectedSection === userSec;

  if (!isOpen) return null;

  // Render Real-Time Class Status Card
  const renderLiveStatusCard = () => {
    if (!sectionTimetable) {
      return (
        <div className="other-live-card">
          <span className="micro-label dim">TIMETABLE UNAVAILABLE</span>
          <div className="other-live-subject">Not published yet</div>
          <div className="other-live-meta">
            The official timetable for {selectedCourse} · Sem {selectedSemester} · Section {selectedSection} has not been published yet.
          </div>
        </div>
      );
    }

    if (todayHoliday && !isEveningPreviewActive) {
      return (
        <div className="other-live-card holiday-border">
          <span className="micro-label maroon">● {todayHoliday.type ? todayHoliday.type.toUpperCase() : 'HOLIDAY'}</span>
          <div className="other-live-subject">{todayHoliday.title}</div>
          <div className="other-live-meta">{todayHoliday.message || 'No classes scheduled for today.'}</div>
        </div>
      );
    }

    if (isWeekend && !(currentDayName === 'Sunday' && isEveningMode)) {
      return (
        <div className="other-live-card">
          <span className="micro-label dim">WEEKEND</span>
          <div className="other-live-subject">No classes today</div>
          <div className="other-live-meta">Weekend break. Lectures resume on Monday.</div>
        </div>
      );
    }

    if (isRealClass) {
      const roomStr = resolveRoom(activeClass.room);
      return (
        <div className="other-live-card">
          <div className="other-live-topline">
            <div className="badges-wrap">
              <span className="micro-label success">● IN CLASS</span>
              {(activeClass.isPractical || /\b\(P\)\b/i.test(activeClass.subject) || /\bPractical\b/i.test(activeClass.subject)) && (
                <span className="badge-practical">🧪 Practical</span>
              )}
              {(activeClass.isUnsupervised || activeClass.teacher === 'Unsupervised' || /\bunsupervised\b/i.test(activeClass.subject || '')) && (
                <span className="badge-unsupervised">👤 Unsupervised</span>
              )}
            </div>
            <span className="other-live-countdown">{remainingStr}</span>
          </div>

          <div className="other-live-subject">{activeClass.subject}</div>

          <div className="other-live-meta">
            {[
              activePeriod ? `Period ${activePeriod.id} (${activePeriod.startLabel} - ${activePeriod.endLabel})` : null,
              activeClass.teacher && activeClass.teacher !== '-' ? activeClass.teacher : null,
              roomStr ? (roomStr.toLowerCase().startsWith('room') ? roomStr : `Room ${roomStr}`) : null
            ].filter(Boolean).join(' · ')}
          </div>

          <div className="other-live-progress-wrap">
            <div className="other-live-progress-ticks">
              <span className="live-progress-tick" style={{ left: '25%' }}></span>
              <span className="live-progress-tick" style={{ left: '50%' }}></span>
              <span className="live-progress-tick" style={{ left: '75%' }}></span>
            </div>
            <div className="other-live-progress-fill" style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}>
              <div className="other-live-progress-pin"></div>
            </div>
          </div>

          {nextClass && nextPeriod && (
            <div className="other-live-next-row">
              <span className="other-live-next-label">
                Next — {nextClass.subject}
                {resolveRoom(nextClass.room) ? ` · ${resolveRoom(nextClass.room)}` : ''}
              </span>
              <span className="other-live-next-time">{nextPeriod.startLabel}</span>
            </div>
          )}
        </div>
      );
    }

    if (activeClass && activeClass.isBreak) {
      return (
        <div className="other-live-card">
          <div className="other-live-topline">
            <span className="micro-label maroon">🍽️ INFINITY HOUR</span>
            <span className="other-live-countdown">{remainingStr}</span>
          </div>
          <div className="other-live-subject">Infinity Hour (Break)</div>
          <div className="other-live-meta">12:00 PM – 1:00 PM · College-wide lunch & project period</div>
          {nextClass && nextPeriod && (
            <div className="other-live-next-row">
              <span className="other-live-next-label">Next lecture: {nextClass.subject}</span>
              <span className="other-live-next-time">{nextPeriod.startLabel}</span>
            </div>
          )}
        </div>
      );
    }

    if (activeClass && activeClass.subject === 'Free') {
      return (
        <div className="other-live-card">
          <div className="other-live-topline">
            <span className="micro-label dim">☕ FREE PERIOD</span>
            <span className="other-live-countdown">{remainingStr}</span>
          </div>
          <div className="other-live-subject">Free Period</div>
          <div className="other-live-meta">No lecture scheduled for this period.</div>
          {nextClass && nextPeriod && (
            <div className="other-live-next-row">
              <span className="other-live-next-label">Next lecture: {nextClass.subject}</span>
              <span className="other-live-next-time">{nextPeriod.startLabel}</span>
            </div>
          )}
        </div>
      );
    }

    if (nextClass && nextPeriod) {
      return (
        <div className="other-live-card">
          <div className="other-live-topline">
            <span className="micro-label dim">UP NEXT</span>
            <span className="other-live-countdown">{nextPeriod.startLabel}</span>
          </div>
          <div className="other-live-subject">{nextClass.isBreak ? 'Break' : nextClass.subject}</div>
          <div className="other-live-meta">
            {[!nextClass.isBreak && nextClass.teacher, !nextClass.isBreak && resolveRoom(nextClass.room)]
              .filter(Boolean)
              .join(' · ') || 'Starts soon'}
          </div>
        </div>
      );
    }

    if (currentDayName === 'Friday' && isEveningMode) {
      return (
        <div className="other-live-card">
          <span className="micro-label dim">DONE FOR THE WEEK</span>
          <div className="other-live-subject">Weekend ahead</div>
          <div className="other-live-meta">Classes completed for the week.</div>
        </div>
      );
    }

    if (isEveningPreviewActive) {
      if (tomorrowHoliday || nextCollegeHoliday) {
        const holidayObj = tomorrowHoliday || nextCollegeHoliday;
        return (
          <div className="other-live-card holiday-border">
            <span className="micro-label maroon">● {holidayObj.type ? holidayObj.type.toUpperCase() : 'HOLIDAY'} · {nextCollegeDayName.toUpperCase()}</span>
            <div className="other-live-subject">{holidayObj.title}</div>
            <div className="other-live-meta">{holidayObj.message || `No classes scheduled for ${nextCollegeDayName}.`}</div>
          </div>
        );
      }

      if (firstNextDayClass && firstNextDayPeriod) {
        const roomStr = resolveRoom(firstNextDayClass.room);
        return (
          <div className="other-live-card">
            <div className="other-live-topline">
              <div className="badges-wrap">
                <span className="micro-label success">● TOMORROW'S SCHEDULE · {nextCollegeDayName.toUpperCase()}</span>
                {(firstNextDayClass.isPractical || /\b\(P\)\b/i.test(firstNextDayClass.subject) || /\bPractical\b/i.test(firstNextDayClass.subject)) && (
                  <span className="badge-practical">🧪 Practical</span>
                )}
                {(firstNextDayClass.isUnsupervised || firstNextDayClass.teacher === 'Unsupervised' || /\bunsupervised\b/i.test(firstNextDayClass.subject || '')) && (
                  <span className="badge-unsupervised">👤 Unsupervised</span>
                )}
              </div>
              <span className="other-live-countdown">Starts {firstNextDayPeriod.startLabel}</span>
            </div>
            <div className="other-live-subject">{firstNextDayClass.subject}</div>
            <div className="other-live-meta">
              {[
                `Period ${firstNextDayPeriod.id} (${firstNextDayPeriod.startLabel})`,
                firstNextDayClass.teacher && firstNextDayClass.teacher !== '-' ? firstNextDayClass.teacher : null,
                roomStr ? (roomStr.toLowerCase().startsWith('room') ? roomStr : `Room ${roomStr}`) : null,
                `${nextDayRealClassCount} class${nextDayRealClassCount === 1 ? '' : 'es'} scheduled`
              ].filter(Boolean).join(' · ')}
            </div>
          </div>
        );
      }

      return (
        <div className="other-live-card">
          <span className="micro-label dim">TOMORROW · {nextCollegeDayName.toUpperCase()}</span>
          <div className="other-live-subject">No classes scheduled</div>
          <div className="other-live-meta">No scheduled lectures for {nextCollegeDayName}.</div>
        </div>
      );
    }

    return (
      <div className="other-live-card">
        <span className="micro-label dim">DONE FOR TODAY</span>
        <div className="other-live-subject">Classes completed</div>
        <div className="other-live-meta">All lectures for today have concluded.</div>
      </div>
    );
  };

  return (
    <div className="other-modal-overlay" onClick={onClose}>
      <div className="other-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <header className="other-modal-header">
          <div className="other-header-titles">
            <div className="other-header-badges">
              <span className="other-header-chip">TIMETABLE EXPLORER</span>
              {isUserOwnSection && (
                <span className="other-own-badge">YOUR ENROLLED SECTION</span>
              )}
            </div>
            <h3>View Other Sections</h3>
            <p>Browse real-time status & weekly timetables for any course, semester, or section.</p>
          </div>
          <button className="other-close-btn" onClick={onClose} title="Close">×</button>
        </header>

        {/* Dynamic Filters Bar */}
        <section className="other-filter-bar">
          {/* Course Selector */}
          <div className="filter-group">
            <label className="filter-label">Course</label>
            <div className="filter-segmented">
              {availableCourses.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`filter-btn ${selectedCourse === c ? 'active' : ''}`}
                  onClick={() => handleCourseChange(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Semester Selector */}
          <div className="filter-group">
            <label className="filter-label">Semester</label>
            <div className="filter-segmented">
              {availableSemesters.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`filter-btn ${selectedSemester === s ? 'active' : ''}`}
                  onClick={() => handleSemesterChange(s)}
                >
                  Sem {s}
                </button>
              ))}
            </div>
          </div>

          {/* Section Selector */}
          <div className="filter-group">
            <label className="filter-label">Section</label>
            <div className="filter-segmented">
              {availableSections.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className={`filter-btn ${selectedSection === sec ? 'active' : ''}`}
                  onClick={() => handleSectionChange(sec)}
                >
                  Sec {sec}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* View Mode Switcher */}
        <div className="other-view-tabs-row">
          <div className="other-tabs-segmented">
            <button
              type="button"
              className={`other-tab-btn ${viewTab === 'realtime' ? 'active' : ''}`}
              onClick={() => {
                setViewTab('realtime');
                trackTimetableEvent('switch_other_sections_tab', { tab: 'realtime' });
              }}
            >
              <span>⚡ Real-Time Schedule</span>
            </button>
            <button
              type="button"
              className={`other-tab-btn ${viewTab === 'weekly' ? 'active' : ''}`}
              onClick={() => {
                setViewTab('weekly');
                trackTimetableEvent('switch_other_sections_tab', { tab: 'weekly' });
              }}
            >
              <span>📅 Full Week Timetable</span>
            </button>
          </div>

          {viewTab === 'weekly' && (
            <div className="weekly-subactions">
              <div className="weekly-layout-toggle-group">
                <button 
                  className={`btn-layout-toggle ${weeklyLayoutMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setWeeklyLayoutMode('grid')}
                  title="Grid View"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none">
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
                  <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" strokeWidth="2.5" fill="none">
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

              {exportMessage && <span className="export-toast-notice">{exportMessage}</span>}
              <button
                className="btn-export-schedule-img"
                onClick={handleExportSchedule}
                disabled={isExporting}
                title="Export schedule as PNG"
              >
                <ImageIcon size={13} />
                <span>{isExporting ? 'Exporting...' : 'Export PNG'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Body Content */}
        <div className="other-modal-body">
          {viewTab === 'realtime' ? (
            <div className="other-realtime-container animate-fade-in">
              {/* Real-time Status Card */}
              {renderLiveStatusCard()}

              {/* Day Schedule Timeline Trail */}
              {sectionTimetable && (
                <div className="other-timeline-section">
                  <div className="other-timeline-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                        {activeTimelineDayName === currentDayName ? "Today's Schedule" : `${activeTimelineDayName}'s Schedule`}
                      </h4>
                      {activeTimelineDayName !== currentDayName && (
                        <span className="micro-label dim" style={{ padding: '2px 6px', fontSize: '0.65rem' }}>PREVIEW</span>
                      )}
                    </div>
                    {(isEveningMode || isWeekend) && (
                      <div className="timeline-day-toggles">
                        <button
                          type="button"
                          className={`home-tt-btn-xs ${effectiveTimelineTarget === 'tomorrow' ? 'active' : ''}`}
                          onClick={() => setTimelineViewDay('tomorrow')}
                        >
                          {currentDayName === 'Friday' || currentDayName === 'Saturday' || currentDayName === 'Sunday'
                            ? 'Monday'
                            : `Tomorrow (${nextCollegeDayName})`}
                        </button>
                        <button
                          type="button"
                          className={`home-tt-btn-xs ${effectiveTimelineTarget === 'today' ? 'active' : ''}`}
                          onClick={() => setTimelineViewDay('today')}
                        >
                          Today ({currentDayName})
                        </button>
                      </div>
                    )}
                  </div>

                  {displayedTimelineClasses.length === 0 ? (
                    <div className="other-timeline-empty">
                      No lectures scheduled for {activeTimelineDayName}.
                    </div>
                  ) : (
                    <div className="other-timeline-trail">
                      {displayedTimelineClasses.map((cls) => {
                        const periodInfo = PERIODS.find(p => p.id === cls.period || (cls.isBreak && p.id === 0));
                        if (!periodInfo) return null;

                        const startMin = parseTimeToMinutes(periodInfo.start);
                        const endMin = parseTimeToMinutes(periodInfo.end);

                        const isViewingToday = activeTimelineDayName === currentDayName;
                        const isPast = isViewingToday && currentMinutes >= endMin;
                        const isActive = isViewingToday && (currentMinutes >= startMin && currentMinutes < endMin);
                        const isUpcoming = !isViewingToday || currentMinutes < startMin;

                        return (
                          <div
                            key={cls.period}
                            className={`timeline-slot-card ${isActive ? 'active' : ''} ${isPast ? 'past' : ''} ${isUpcoming ? 'upcoming' : ''}`}
                          >
                            <div className="timeline-slot-time">
                              <span>{periodInfo.startLabel}</span>
                            </div>
                            <div className="timeline-slot-content">
                              <div className="timeline-slot-topline">
                                <span className="timeline-slot-period">
                                  {cls.isBreak ? 'Break' : periodInfo.label}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {isActive && <span className="timeline-slot-status active">LIVE</span>}
                                  {isPast && <span className="timeline-slot-status past">DONE</span>}
                                  {(cls.isPractical || /\b\(P\)\b/i.test(cls.subject) || /\bPractical\b/i.test(cls.subject)) && (
                                    <span className="badge-practical-sm">P</span>
                                  )}
                                  {(cls.isUnsupervised || cls.teacher === 'Unsupervised' || /\bunsupervised\b/i.test(cls.subject || '')) && (
                                    <span className="badge-unsupervised-sm">U</span>
                                  )}
                                </div>
                              </div>
                              <div className="timeline-slot-subject">
                                {cls.isBreak ? 'Infinity Hour (Break)' : (cls.subject || 'Free')}
                              </div>
                              {!cls.isBreak && cls.subject !== 'Free' && (
                                <div className="timeline-slot-meta">
                                  {cls.teacher && cls.teacher !== '-' && <span>{cls.teacher}</span>}
                                  {resolveRoom(cls.room) && resolveRoom(cls.room) !== '-' && (
                                    <span className="timeline-slot-room">{resolveRoom(cls.room)}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="other-weekly-container animate-fade-in" ref={scheduleExportRef}>
              {weeklyLayoutMode === 'list' ? (
                <>
                  <div className="weekly-list-view">
                    {/* Day tabs */}
                    <div className="weekly-tabs-container">
                      {DAYS.map((day) => {
                        const isTabActive = activeWeeklyTab === day;
                        const isToday = currentDayName === day;
                        return (
                          <button
                            key={day}
                            type="button"
                            className={`weekly-day-tab ${isTabActive ? 'active' : ''} ${isToday ? 'is-today' : ''}`}
                            onClick={() => setActiveWeeklyTab(day)}
                          >
                            <span className="tab-day-name">{day.substring(0, 3)}</span>
                            <span className="tab-day-full">{day}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Chronological list of periods for selected day */}
                    <div className="weekly-list-timeline">
                      {(() => {
                        const dayClasses = sectionTimetable ? sectionTimetable[activeWeeklyTab] || [] : [];
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
                                      <p>12:00 PM – 1:00 PM break</p>
                                    </div>
                                  </div>
                                ) : matchClass ? (
                                  matchClass.subject === 'Free' ? (
                                    <div className="timeline-free-card">
                                      <span className="free-card-emoji">☕</span>
                                      <div>
                                        <h5>Free Block</h5>
                                        <p>No class scheduled</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="timeline-class-card">
                                      <div className="timeline-card-topline">
                                        <h4>{matchClass.subject}</h4>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                                            <span>{matchClass.teacher}</span>
                                          </div>
                                        )}
                                        {resolveRoom(matchClass.room) && resolveRoom(matchClass.room) !== '-' && (
                                          <div className="timeline-meta-item room-tag">
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

                  {/* Hidden export target for full 5-day grid table when user is in list mode */}
                  <div className="table-responsive" ref={fullWeeklyGridRef} style={{ position: 'absolute', left: '-9999px', top: 0, opacity: 0.01, pointerEvents: 'none', width: '1350px' }}>
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
                          const dayCls = sectionTimetable ? sectionTimetable[day] || [] : [];
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
                                return (
                                  <td key={period.id} className={`weekly-class-cell ${matchClass?.subject === 'Free' ? 'free' : ''}`}>
                                    {matchClass ? (
                                      matchClass.subject === 'Free' ? (
                                        <div className="cell-free-box">
                                          <span className="free-emoji">☕</span>
                                          <span className="free-text">Free Block</span>
                                        </div>
                                      ) : (
                                        <div className="grid-cell-card">
                                          <div className="cell-subject">{matchClass.subject}</div>
                                          <div className="cell-details-row">
                                            {matchClass.teacher && matchClass.teacher !== '-' && (
                                              <div className="cell-teacher">{matchClass.teacher}</div>
                                            )}
                                            {resolveRoom(matchClass.room) && resolveRoom(matchClass.room) !== '-' && (
                                              <div className="cell-room">{resolveRoom(matchClass.room)}</div>
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
                </>
              ) : (
                <div className="table-responsive" ref={fullWeeklyGridRef}>
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
                        const dayCls = sectionTimetable ? sectionTimetable[day] || [] : [];
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
          )}
        </div>

        {/* Modal Footer */}
        <footer className="other-modal-footer">
          <div className="other-footer-left">
            <span className="other-footer-note">
              ● Official timetable for {selectedCourse} · Sem {selectedSemester} · Sec {selectedSection}
            </span>
          </div>
          <div className="other-footer-actions">
            {onPreviewOnDashboard && (
              <button
                type="button"
                className="btn-preview-dashboard"
                onClick={() => {
                  trackTimetableEvent('pin_section_to_dashboard', {
                    course: selectedCourse,
                    semester: selectedSemester,
                    section: selectedSection
                  });
                  onPreviewOnDashboard({
                    course: selectedCourse,
                    semester: selectedSemester,
                    section: selectedSection
                  });
                  onClose();
                }}
                title="Follow this section on your home screen during this session"
              >
                Preview on Dashboard ↗
              </button>
            )}
            <button type="button" className="btn-close-modal" onClick={onClose}>
              Close View
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
