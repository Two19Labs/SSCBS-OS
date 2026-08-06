import React, { useState, useEffect, useMemo } from 'react';
import { useTimetable } from '../context/TimetableContext';
import { useAuth } from '../context/AuthContext';
import { PERIODS, DAYS } from '../data/timetables';
import { getRoomStatuses, extractAllRoomsFromTimetable } from '../utils/roomFinder';
import { DoorIcon, SearchIcon, BackIcon, RefreshIcon } from './icons';
import './EmptyRoomFinderPage.css';

export function EmptyRoomFinderPage({ onBack }) {
  const { timetable } = useTimetable();
  const { user } = useAuth();

  // Mode: 'live' or 'slot'
  const [mode, setMode] = useState('live');

  // Selected Day & Period for 'slot' mode or live override
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedPeriodId, setSelectedPeriodId] = useState(1);

  // Filters
  const [floorFilter, setFloorFilter] = useState('ALL'); // 'ALL' | 2 | 3 | 4 | 5 | 6 | 7
  const [statusFilter, setStatusFilter] = useState('VACANT'); // 'ALL' | 'VACANT' | 'OCCUPIED'
  const [searchQuery, setSearchQuery] = useState('');

  // Live Time state
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Determine current day & period from live clock
  const liveDay = useMemo(() => {
    const dayIndex = currentTime.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[dayIndex] || 'Monday';
  }, [currentTime]);

  const livePeriod = useMemo(() => {
    const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    
    // Check which period covers nowMinutes
    for (const p of PERIODS) {
      const [sH, sM] = p.start.split(':').map(Number);
      const [eH, eM] = p.end.split(':').map(Number);
      const startMin = sH * 60 + sM;
      const endMin = eH * 60 + eM;
      if (nowMinutes >= startMin && nowMinutes < endMin) {
        return p;
      }
    }
    // Default fallback to Period 1 if outside regular college hours
    return PERIODS[0]; // Period 1
  }, [currentTime]);

  // Set active day & period based on mode
  const activeDay = mode === 'live' ? (DAYS.includes(liveDay) ? liveDay : 'Monday') : selectedDay;
  const activePeriodId = mode === 'live' ? livePeriod.id : selectedPeriodId;
  const activePeriod = PERIODS.find(p => p.id === activePeriodId) || PERIODS[0];

  // Calculate room statuses
  const roomStatuses = useMemo(() => {
    if (!timetable) return [];
    return getRoomStatuses(timetable, activeDay, activePeriodId);
  }, [timetable, activeDay, activePeriodId]);

  // Filter rooms
  const filteredRooms = useMemo(() => {
    return roomStatuses.filter(item => {
      // Floor filter
      if (floorFilter !== 'ALL' && item.floor !== Number(floorFilter)) {
        return false;
      }
      // Status filter
      if (statusFilter === 'VACANT' && !item.isVacant) return false;
      if (statusFilter === 'OCCUPIED' && item.isVacant) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const roomMatch = item.room.toLowerCase().includes(q);
        const subjMatch = item.occupiedBy?.subject?.toLowerCase().includes(q);
        const teacherMatch = item.occupiedBy?.teacher?.toLowerCase().includes(q);
        return roomMatch || subjMatch || teacherMatch;
      }

      return true;
    });
  }, [roomStatuses, floorFilter, statusFilter, searchQuery]);

  // Stats
  const vacantCount = roomStatuses.filter(r => r.isVacant).length;
  const occupiedCount = roomStatuses.length - vacantCount;

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
            <span className="micro-label success">TESTING</span>
          </div>
          <p className="empty-room-subtitle">Spot vacant classrooms & labs dynamically extracted from college schedules</p>
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

        {/* Slot Selectors */}
        <div className="empty-room-slot-selectors">
          <div className="selector-group">
            <label>Day</label>
            <select
              value={selectedDay}
              onChange={(e) => {
                setSelectedDay(e.target.value);
                if (mode === 'live') setMode('slot');
              }}
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
              onChange={(e) => {
                setSelectedPeriodId(Number(e.target.value));
                if (mode === 'live') setMode('slot');
              }}
            >
              {PERIODS.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.startLabel} - {p.endLabel})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Live Active Banner */}
      <div className="empty-room-active-banner">
        <div className="banner-left">
          <span className="banner-day">{activeDay}</span>
          <span className="banner-divider">•</span>
          <span className="banner-period">{activePeriod.label}</span>
          <span className="banner-time">({activePeriod.startLabel} – {activePeriod.endLabel})</span>
        </div>

        <div className="banner-right">
          <span className="stat-pill vacant">🟢 {vacantCount} Free</span>
          <span className="stat-pill occupied">🔴 {occupiedCount} Occupied</span>
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
            className={`filter-pill ${statusFilter === 'VACANT' ? 'active' : ''}`}
            onClick={() => setStatusFilter('VACANT')}
          >
            Vacant Only ({vacantCount})
          </button>
          <button
            className={`filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All Rooms ({roomStatuses.length})
          </button>
          <button
            className={`filter-pill ${statusFilter === 'OCCUPIED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('OCCUPIED')}
          >
            Occupied ({occupiedCount})
          </button>
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
          filteredRooms.map(item => (
            <div
              key={item.room}
              className={`room-card ${item.isVacant ? 'vacant' : 'occupied'}`}
            >
              <div className="room-card-header">
                <div className="room-title-box">
                  <span className="room-name">{item.room}</span>
                  <span className="room-floor-tag">{item.floor > 0 ? `${item.floor}th Floor` : 'Campus'}</span>
                </div>

                <span className={`room-status-badge ${item.isVacant ? 'vacant' : 'occupied'}`}>
                  {item.isVacant ? 'VACANT' : 'IN CLASS'}
                </span>
              </div>

              <div className="room-card-body">
                {item.isVacant ? (
                  <div className="vacancy-info">
                    <div className="vacancy-main-status">
                      <span className="vacancy-icon">🟢</span>
                      <span className="vacancy-text">
                        {item.isFreeRestOfDay
                          ? 'Free for the rest of the day'
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
            </div>
          ))
        ) : (
          <div className="empty-rooms-placeholder">
            <DoorIcon size={36} />
            <h3>No rooms match your filter</h3>
            <p>Try switching to another floor, clearing your search query, or checking a different period.</p>
          </div>
        )}
      </div>
    </div>
  );
}
