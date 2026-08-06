import React, { useState, useEffect, useMemo } from 'react';
import { useTimetable } from '../context/TimetableContext';
import { useAuth } from '../context/AuthContext';
import { PERIODS, DAYS } from '../data/timetables';
import { getRoomStatuses, extractAllRoomsFromTimetable, getRoomDailyTimeline } from '../utils/roomFinder';
import { DoorIcon, SearchIcon, BackIcon, RefreshIcon, CalendarIcon } from './icons';
import './EmptyRoomFinderPage.css';

export function EmptyRoomFinderPage({ onBack }) {
  const { timetable, holidays } = useTimetable();
  const { user } = useAuth();

  // Mode: 'live' or 'slot'
  const [mode, setMode] = useState('live');

  // Selected Day & Period for 'slot' mode or live override
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedPeriodId, setSelectedPeriodId] = useState(1);

  // Filters
  const [floorFilter, setFloorFilter] = useState('ALL'); // 'ALL' | 2 | 3 | 4 | 5 | 6 | 7
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'VACANT' | 'OCCUPIED'
  const [searchQuery, setSearchQuery] = useState('');

  // Selected room modal for complete daily timeline
  const [selectedRoomForTimeline, setSelectedRoomForTimeline] = useState(null);

  // Live IST Time state - updates every second
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format live IST clock
  const istTimeString = useMemo(() => {
    return currentTime.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).toUpperCase();
  }, [currentTime]);

  // YYYY-MM-DD string for today's holiday lookup
  const todayStr = useMemo(() => {
    const y = currentTime.getFullYear();
    const m = String(currentTime.getMonth() + 1).padStart(2, '0');
    const d = String(currentTime.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [currentTime]);

  // Check if today is an Admin-configured Holiday or Fest
  const activeHoliday = useMemo(() => {
    if (!holidays || !Array.isArray(holidays)) return null;
    return holidays.find(h => h.date === todayStr);
  }, [holidays, todayStr]);

  // Determine current day & period from live clock
  const liveDay = useMemo(() => {
    const dayIndex = currentTime.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[dayIndex] || 'Monday';
  }, [currentTime]);

  const livePeriod = useMemo(() => {
    const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    
    for (const p of PERIODS) {
      const [sH, sM] = p.start.split(':').map(Number);
      const [eH, eM] = p.end.split(':').map(Number);
      const startMin = sH * 60 + sM;
      const endMin = eH * 60 + eM;
      if (nowMinutes >= startMin && nowMinutes < endMin) {
        return p;
      }
    }
    return null; // Return null outside class hours
  }, [currentTime]);

  // Check if college is closed (e.g. after 7:00 PM, before 9:00 AM, or on weekends)
  const isCollegeClosedNow = useMemo(() => {
    const dayIndex = currentTime.getDay();
    if (dayIndex === 0 || dayIndex === 6) return true; // Weekend

    const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const collegeStartMinutes = 9 * 60;  // 9:00 AM
    const collegeEndMinutes = 19 * 60;   // 7:00 PM

    return nowMinutes < collegeStartMinutes || nowMinutes >= collegeEndMinutes || livePeriod === null;
  }, [currentTime, livePeriod]);

  // Set active day & period based on mode
  const activeDay = mode === 'live' ? (DAYS.includes(liveDay) ? liveDay : 'Monday') : selectedDay;
  const activePeriodId = mode === 'live' ? (livePeriod ? livePeriod.id : 1) : selectedPeriodId;
  const activePeriod = PERIODS.find(p => p.id === activePeriodId) || PERIODS[0];

  // Calculate room statuses
  const roomStatuses = useMemo(() => {
    if (!timetable) return [];
    return getRoomStatuses(timetable, activeDay, activePeriodId);
  }, [timetable, activeDay, activePeriodId]);

  // Filter rooms
  const filteredRooms = useMemo(() => {
    return roomStatuses.filter(item => {
      if (floorFilter !== 'ALL' && item.floor !== Number(floorFilter)) {
        return false;
      }

      if (mode === 'live' && (isCollegeClosedNow || activeHoliday)) {
        // Bypasses vacant/occupied split during off-hours & holidays
      } else {
        if (statusFilter === 'VACANT' && !item.isVacant) return false;
        if (statusFilter === 'OCCUPIED' && item.isVacant) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const roomMatch = item.room.toLowerCase().includes(q);
        const subjMatch = item.occupiedBy?.subject?.toLowerCase().includes(q);
        const teacherMatch = item.occupiedBy?.teacher?.toLowerCase().includes(q);
        return roomMatch || subjMatch || teacherMatch;
      }

      return true;
    });
  }, [roomStatuses, floorFilter, statusFilter, searchQuery, mode, isCollegeClosedNow, activeHoliday]);


  // Stats
  const vacantCount = roomStatuses.filter(r => r.isVacant).length;
  const occupiedCount = roomStatuses.length - vacantCount;

  // Daily timeline data for modal
  const roomTimelineData = useMemo(() => {
    if (!selectedRoomForTimeline || !timetable) return null;
    return getRoomDailyTimeline(timetable, activeDay, selectedRoomForTimeline);
  }, [selectedRoomForTimeline, timetable, activeDay]);


  return (
    <div className="empty-room-page">
      {/* Top Header */}
      <div className="empty-room-header">
        <button className="empty-room-back-btn" onClick={onBack} aria-label="Go back">
          <BackIcon size={18} />
          <span>Back</span>
        </button>

        <div className="empty-room-title-section">
          <div className="empty-room-title-row">
            <span className="empty-room-header-icon"><DoorIcon size={22} /></span>
            <h2>Empty Room Finder</h2>
            <span className="micro-label success">LIVE DATA</span>
          </div>
          <p className="empty-room-subtitle">Spot vacant classrooms & labs powered by official college timetables</p>
        </div>
      </div>

      {/* Mode & Time Controls */}
      <div className="empty-room-controls-card">
        <div className="empty-room-mode-toggle">
          <button
            className={`mode-btn ${mode === 'live' ? 'active' : ''}`}
            onClick={() => setMode('live')}
          >
            <span className="live-dot">●</span>
            Live Now
          </button>

          <button
            className={`mode-btn ${mode === 'slot' ? 'active' : ''}`}
            onClick={() => setMode('slot')}
          >
            Select Slot
          </button>
        </div>

        {/* Real-time IST Clock */}
        <div className="ist-clock-badge">
          <span className="ist-clock-icon">🕒</span>
          <span className="ist-clock-label">IST</span>
          <span className="ist-clock-time">{istTimeString}</span>
        </div>

        {/* Slot Selectors - ONLY shown when mode === 'slot' */}
        {mode === 'slot' && (
          <div className="empty-room-slot-selectors">
            <div className="selector-group">
              <label>Day</label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              >
                {DAYS.map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>

            <div className="selector-group">
              <label>Period</label>
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(Number(e.target.value))}
              >
                {PERIODS.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.startLabel} - {p.endLabel})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Live Active Banner */}
      <div className={`empty-room-active-banner ${mode === 'live' && activeHoliday ? 'holiday' : mode === 'live' && isCollegeClosedNow ? 'closed' : ''}`}>
        <div className="banner-left">
          {mode === 'live' && activeHoliday ? (
            <>
              <span className="banner-day">🎉 HOLIDAY: {activeHoliday.title.toUpperCase()}</span>
              <span className="banner-divider">•</span>
              <span className="banner-time">Regular classes suspended today</span>
            </>
          ) : mode === 'live' && isCollegeClosedNow ? (
            <>
              <span className="banner-day">🔒 COLLEGE CLOSED FOR THE DAY</span>
              <span className="banner-divider">•</span>
              <span className="banner-time">Re-opens tomorrow at 9:00 AM IST</span>
            </>
          ) : (
            <>
              <span className="banner-day">{activeDay}</span>
              <span className="banner-divider">•</span>
              <span className="banner-period">{activePeriod.label}</span>
              <span className="banner-time">({activePeriod.startLabel} – {activePeriod.endLabel})</span>
            </>
          )}
        </div>

        <div className="banner-right">
          {mode === 'live' && activeHoliday ? (
            <span className="stat-pill holiday">🟡 Holiday / Fest</span>
          ) : mode === 'live' && isCollegeClosedNow ? (
            <span className="stat-pill closed">🔒 College Closed</span>
          ) : (
            <>
              <span className="stat-pill vacant">🟢 {vacantCount} Free</span>
              <span className="stat-pill occupied">🔴 {occupiedCount} Occupied</span>
            </>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="empty-room-filter-bar">
        {/* Search */}
        <div className="room-search-box">
          <SearchIcon size={16} />
          <input
            type="text"
            placeholder="Search room (e.g. 503, 703, Lab 426)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>×</button>
          )}
        </div>

        {/* Status Pills */}
        <div className="filter-pills-row">
          <button
            className={`filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All Rooms ({roomStatuses.length})
          </button>

          {mode === 'live' && activeHoliday ? (
            <button className="filter-pill active">
              Holiday ({roomStatuses.length})
            </button>
          ) : mode === 'live' && isCollegeClosedNow ? (
            <button className="filter-pill active">
              Closed ({roomStatuses.length})
            </button>
          ) : (
            <>
              <button
                className={`filter-pill ${statusFilter === 'VACANT' ? 'active' : ''}`}
                onClick={() => setStatusFilter('VACANT')}
              >
                Vacant ({vacantCount})
              </button>
              <button
                className={`filter-pill ${statusFilter === 'OCCUPIED' ? 'active' : ''}`}
                onClick={() => setStatusFilter('OCCUPIED')}
              >
                Occupied ({occupiedCount})
              </button>
            </>
          )}
        </div>

        {/* Floor Pills */}
        <div className="floor-pills-row">
          <span className="floor-label">Floor:</span>
          {['ALL', '2', '3', '4', '5', '6', '7'].map(fl => (
            <button
              key={fl}
              className={`floor-pill ${floorFilter === fl ? 'active' : ''}`}
              onClick={() => setFloorFilter(fl)}
            >
              {fl === 'ALL' ? 'All' : `${fl}F`}
            </button>
          ))}
        </div>
      </div>

      {/* Room Grid */}
      <div className="room-grid">
        {filteredRooms.length > 0 ? (
          filteredRooms.map(item => {
            // Determine card status badge & text for Live mode (Holiday / Closed / Normal)
            const isLiveClosed = mode === 'live' && isCollegeClosedNow;
            const isLiveHoliday = mode === 'live' && activeHoliday;

            return (
              <div
                key={item.room}
                className={`room-card ${isLiveHoliday ? 'holiday' : isLiveClosed ? 'closed' : item.isVacant ? 'vacant' : 'occupied'}`}
                onClick={() => setSelectedRoomForTimeline(item.room)}
              >
                <div className="room-card-header">
                  <div className="room-title-box">
                    <span className="room-name">{item.room}</span>
                    <span className="room-floor-tag">{item.floor > 0 ? `${item.floor}th Floor` : 'Campus'}</span>
                  </div>

                  <span className={`room-status-badge ${isLiveHoliday ? 'holiday' : isLiveClosed ? 'closed' : item.isVacant ? 'vacant' : 'occupied'}`}>
                    {isLiveHoliday ? 'HOLIDAY' : isLiveClosed ? 'CLOSED' : item.isVacant ? 'VACANT' : 'IN CLASS'}
                  </span>
                </div>

                <div className="room-card-body">
                  {isLiveHoliday ? (
                    <div className="vacancy-info">
                      <div className="vacancy-main-status holiday">
                        <span className="vacancy-icon">🟡</span>
                        <span className="vacancy-text">
                          Classes cancelled today ({activeHoliday.title})
                        </span>
                      </div>
                      <div className="vacancy-subtext">
                        Open for self-study / events • Tap to view daily schedule
                      </div>
                    </div>
                  ) : isLiveClosed ? (
                    <div className="vacancy-info">
                      <div className="vacancy-main-status closed">
                        <span className="vacancy-icon">🔒</span>
                        <span className="vacancy-text">
                          College is closed, it'll open 9am
                        </span>
                      </div>
                      <div className="vacancy-subtext">
                        Tap room card to view full daily timeline schedule
                      </div>
                    </div>
                  ) : item.isVacant ? (
                    <div className="vacancy-info">
                      <div className="vacancy-main-status">
                        <span className="vacancy-icon">🟢</span>
                        <span className="vacancy-text">
                          {item.isFreeRestOfDay
                            ? 'Free for rest of the day'
                            : `Free until ${item.freeUntilPeriodLabel}`}
                        </span>
                      </div>

                      {item.consecutiveFreePeriods > 1 && (
                        <div className="vacancy-subtext">
                          Available for {item.consecutiveFreePeriods} consecutive periods
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="occupancy-info">
                      <div className="class-subject">{item.occupiedBy.subject}</div>
                      <div className="class-meta">
                        <span className="class-sec">{item.occupiedBy.course} Sem {item.occupiedBy.sem} ({item.occupiedBy.sec})</span>
                        {item.occupiedBy.teacher && (
                          <span className="class-teacher">• {item.occupiedBy.teacher}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="room-card-footer">
                  <span className="view-timeline-btn">
                    <CalendarIcon size={14} /> View Daily Timeline & Schedule →
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-rooms-placeholder">
            <DoorIcon size={36} />
            <h3>No rooms match your filter</h3>
            <p>Try switching to another floor, clearing your search query, or checking a different period.</p>
          </div>
        )}
      </div>

      {/* Daily Timeline Modal */}
      {selectedRoomForTimeline && roomTimelineData && (
        <div className="timeline-modal-overlay" onClick={() => setSelectedRoomForTimeline(null)}>
          <div className="timeline-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="timeline-modal-header">
              <div className="timeline-modal-title">
                <DoorIcon size={22} />
                <div>
                  <h3>{roomTimelineData.room} — Daily Schedule</h3>
                  <p>{activeDay} • {roomTimelineData.floor > 0 ? `${roomTimelineData.floor}th Floor` : 'Campus'}</p>
                </div>
              </div>

              <button
                className="timeline-modal-close"
                onClick={() => setSelectedRoomForTimeline(null)}
              >
                ×
              </button>
            </div>

            {/* Summary Stats */}
            <div className="timeline-summary-banner">
              <div className="summary-left">
                <span className="summary-badge vacant">🟢 Free for {roomTimelineData.vacantCount} periods</span>
                <span className="summary-badge occupied">🔴 Busy for {roomTimelineData.occupiedCount} periods</span>
              </div>
            </div>

            {/* When free summary box */}
            {roomTimelineData.vacantCount > 0 && (
              <div className="free-periods-summary">
                <span className="summary-heading">✨ Free Today During:</span>
                <div className="free-tags-list">
                  {roomTimelineData.vacantPeriodLabels.map((lbl, idx) => (
                    <span key={idx} className="free-tag-pill">{lbl}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline Rows */}
            <div className="timeline-rows-container">
              {roomTimelineData.timeline.map((slot) => (
                <div
                  key={slot.periodId}
                  className={`timeline-row ${slot.isVacant ? 'vacant' : 'occupied'} ${slot.periodId === activePeriodId ? 'active-now' : ''}`}
                >
                  <div className="slot-time-col">
                    <span className="slot-period-name">{slot.periodLabel}</span>
                    <span className="slot-time-range">{slot.timeRange}</span>
                    {slot.periodId === activePeriodId && (
                      <span className="now-indicator-tag">NOW</span>
                    )}
                  </div>

                  <div className="slot-status-col">
                    {slot.isVacant ? (
                      <div className="slot-vacant-badge">
                        <span>🟢 VACANT / FREE</span>
                      </div>
                    ) : (
                      <div className="slot-occupied-details">
                        <span className="slot-occupied-badge">🔴 IN CLASS</span>
                        <div className="slot-class-title">{slot.occupiedBy.subject}</div>
                        <div className="slot-class-sub">
                          {slot.occupiedBy.course} Sem {slot.occupiedBy.sem} ({slot.occupiedBy.sec})
                          {slot.occupiedBy.teacher && ` • ${slot.occupiedBy.teacher}`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="timeline-modal-footer">
              <button
                className="timeline-close-btn"
                onClick={() => setSelectedRoomForTimeline(null)}
              >
                Close Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
