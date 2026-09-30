import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTimetable } from '../context/TimetableContext';
import { PERIODS, DAYS } from '../data/timetables';
import { resolveRoom, getISTTime, parseTimeToMinutes } from '../utils/timetableSchedule';
import { exportScheduleAsImage } from '../utils/exportUtils';
import { trackTimetableEvent } from '../lib/analytics';
import OtherSectionsModal from './OtherSectionsModal';
import './TimetablePage.css';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DAY_LABELS = {
  Monday: 'MON',
  Tuesday: 'TUE',
  Wednesday: 'WED',
  Thursday: 'THU',
  Friday: 'FRI',
};

export function TimetablePage({ onNavigate, onOpenDrawer }) {
  const { user } = useAuth();
  const { getTimetable } = useTimetable();

  const userCourse = user?.user_metadata?.course || 'BMS';
  const userSem = user?.user_metadata?.semester || '1';
  const userSection = user?.user_metadata?.section || 'A';

  const [activeCourse, setActiveCourse] = useState(userCourse);
  const [activeSem, setActiveSem] = useState(userSem);
  const [activeSection, setActiveSection] = useState(userSection);

  // Sync with user metadata updates
  useEffect(() => {
    if (user?.user_metadata) {
      setActiveCourse(user.user_metadata.course || 'BMS');
      setActiveSem(user.user_metadata.semester || '1');
      setActiveSection(user.user_metadata.section || 'A');
    }
  }, [user]);

  const [currentTime, setCurrentTime] = useState(getISTTime());
  const [isOtherSectionsOpen, setIsOtherSectionsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  const timetableRef = useRef(null);

  // Clock tick every 30s
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(getISTTime()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Determine today's weekday
  const currentDayIndex = currentTime.getDay(); // 0 = Sun, 1 = Mon ...
  const defaultDay = currentDayIndex >= 1 && currentDayIndex <= 5 ? WEEKDAYS[currentDayIndex - 1] : 'Monday';
  const [selectedDay, setSelectedDay] = useState(defaultDay);

  const rawTimetable = getTimetable(activeCourse, activeSem, activeSection);
  const daySchedule = rawTimetable ? rawTimetable[selectedDay] || [] : [];

  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const isSelectedDayToday = (currentDayIndex >= 1 && currentDayIndex <= 5 && WEEKDAYS[currentDayIndex - 1] === selectedDay);

  const handleExport = async () => {
    if (!timetableRef.current || isExporting) return;
    setIsExporting(true);
    setExportMessage(null);
    trackTimetableEvent('export_attempt', { course: activeCourse, semester: activeSem, section: activeSection });
    try {
      await exportScheduleAsImage({
        element: timetableRef.current,
        title: `${activeCourse} Sem ${activeSem} Sec ${activeSection} Timetable`,
        fileName: `SSCBS_${activeCourse}_Sem${activeSem}_Sec${activeSection}_${selectedDay}`,
      });
      setExportMessage('Downloaded!');
      setTimeout(() => setExportMessage(null), 3000);
      trackTimetableEvent('export_success', { course: activeCourse, semester: activeSem, section: activeSection });
    } catch (e) {
      console.error(e);
      setExportMessage('Failed');
      setTimeout(() => setExportMessage(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  // Group classes by period
  const periodMap = {};
  daySchedule.forEach((item) => {
    if (!periodMap[item.period]) {
      periodMap[item.period] = [];
    }
    periodMap[item.period].push(item);
  });

  return (
    <div className="timetable-page-container">
      {/* ── Subheader Bar ── */}
      <div className="timetable-subbar">
        <button
          className="timetable-section-pill"
          onClick={() => setIsOtherSectionsOpen(true)}
          aria-label="Change Section"
        >
          <span>{activeCourse} · Sem {activeSem} · Section {activeSection}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        <button
          className="timetable-export-btn"
          onClick={handleExport}
          disabled={isExporting}
          aria-label="Export Timetable"
          title="Download schedule image"
        >
          {exportMessage ? (
            <span style={{ fontSize: '11px', fontWeight: 800 }}>{exportMessage}</span>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </button>
      </div>

      {/* ── Day Selector (5 Days Only, No Numeric Dates) ── */}
      <div className="timetable-days-row">
        {WEEKDAYS.map((day) => {
          const isActive = day === selectedDay;
          return (
            <button
              key={day}
              className={`timetable-day-tab ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedDay(day)}
            >
              <span className="timetable-day-label">{DAY_LABELS[day]}</span>
            </button>
          );
        })}
      </div>

      {/* ── Schedule Timeline ── */}
      <div ref={timetableRef} className="timetable-period-list">
        {PERIODS.map((period) => {
          const periodClasses = periodMap[period.id] || [];
          const startMin = parseTimeToMinutes(period.startTime);
          const endMin = parseTimeToMinutes(period.endTime);

          const isCurrent = isSelectedDayToday && currentMinutes >= startMin && currentMinutes < endMin;
          const isPast = isSelectedDayToday && currentMinutes >= endMin;

          // Remaining time for current period
          const remainingMin = isCurrent ? endMin - currentMinutes : 0;
          const progressPercent = isCurrent ? Math.min(100, Math.max(0, ((currentMinutes - startMin) / (endMin - startMin)) * 100)) : 0;

          // Free period
          const isFree = periodClasses.length === 0 || periodClasses.every((c) => c.isBreak || c.subject === 'Free' || !c.subject);
          const isBreak = periodClasses.some((c) => c.isBreak || c.subject === 'Infinity Hour');

          return (
            <div key={period.id} className={`timetable-row ${isPast ? 'is-past' : ''}`}>
              <div className={`timetable-time-col ${isCurrent ? 'is-current' : ''}`}>
                <span>{period.startTime}</span>
              </div>

              <div className="timetable-content-col">
                {isBreak ? (
                  <div className="timetable-card-dashed">
                    <span className="break-title">Infinity Hour</span>
                    <span className="break-sub">Break · 1h</span>
                  </div>
                ) : isFree ? (
                  <div className="timetable-card-dashed">
                    <span className="free-title">Free period</span>
                    {isPast && <span className="free-done-tag">DONE</span>}
                  </div>
                ) : isCurrent ? (
                  <div className="timetable-card-current">
                    <div className="current-header">
                      <span className="current-now-tag">● NOW</span>
                      <span className="current-countdown">{remainingMin}m left</span>
                    </div>

                    {periodClasses.length > 1 ? (
                      <div className="split-group-wrap">
                        <span className="split-title">Group split</span>
                        {periodClasses.map((cls, idx) => (
                          <div key={idx} className="split-line">
                            <b>{cls.group || `G${idx + 1}`}</b> · {cls.subject} · {cls.teacher} · {resolveRoom(cls.room, rawTimetable)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <span className="current-subject">{periodClasses[0].subject}</span>
                        <span className="current-details">
                          {periodClasses[0].teacher} · {resolveRoom(periodClasses[0].room, rawTimetable)}
                        </span>
                      </>
                    )}

                    <div className="current-progress-track">
                      <div className="current-progress-fill" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                ) : (
                  <div className="timetable-card-standard">
                    {periodClasses.length > 1 ? (
                      <div className="split-group-wrap">
                        <span className="split-title">Group split</span>
                        {periodClasses.map((cls, idx) => (
                          <div key={idx} className="split-line">
                            <b>{cls.group || `G${idx + 1}`}</b> · {cls.subject} · {cls.teacher} · {resolveRoom(cls.room, rawTimetable)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        <div className="standard-header">
                          <span className="standard-subject">{periodClasses[0].subject}</span>
                          {periodClasses[0].isDouble && <span className="double-tag">×2</span>}
                        </div>
                        <span className="standard-details">
                          {periodClasses[0].teacher} · {resolveRoom(periodClasses[0].room, rawTimetable)}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Other Sections Modal ── */}
      {isOtherSectionsOpen && (
        <OtherSectionsModal
          isOpen={isOtherSectionsOpen}
          onClose={() => setIsOtherSectionsOpen(false)}
        />
      )}
    </div>
  );
}

export default TimetablePage;
