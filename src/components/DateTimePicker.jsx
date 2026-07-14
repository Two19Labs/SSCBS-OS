import React, { useState, useEffect, useRef } from 'react';
import './DateTimePicker.css';

export default function DateTimePicker({ value, onChange, label, id }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null); // Date object
  
  // Internal state for calendar navigation
  const [navDate, setNavDate] = useState(new Date());
  
  // Time state (12-hour format)
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState('PM'); // 'AM' or 'PM'
  const [clockMode, setClockMode] = useState('hours'); // 'hours' or 'minutes'
  
  const popoverRef = useRef(null);
  const clockFaceRef = useRef(null);

  // Parse input value (format: YYYY-MM-DDTHH:mm)
  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setSelectedDate(parsed);
        setNavDate(parsed);
        
        let hr = parsed.getHours();
        const min = parsed.getMinutes();
        const ampm = hr >= 12 ? 'PM' : 'AM';
        hr = hr % 12;
        hr = hr ? hr : 12; // 0 should be 12
        
        setSelectedHour(hr);
        setSelectedMinute(min);
        setSelectedPeriod(ampm);
      }
    } else {
      setSelectedDate(null);
    }
  }, [value, isOpen]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOpen = () => setIsOpen(!isOpen);

  // Formatting value for display
  const getDisplayValue = () => {
    if (!selectedDate) return 'Select Date & Time';
    return selectedDate.toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Month navigation
  const prevMonth = () => {
    setNavDate(new Date(navDate.getFullYear(), navDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setNavDate(new Date(navDate.getFullYear(), navDate.getMonth() + 1, 1));
  };

  // Days calculations
  const year = navDate.getFullYear();
  const month = navDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const totalDaysPrev = new Date(year, month, 0).getDate();

  const daysGrid = [];
  // Fill previous month padding days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    daysGrid.push({
      day: totalDaysPrev - i,
      month: month - 1,
      year: month === 0 ? year - 1 : year,
      isCurrentMonth: false
    });
  }
  // Fill current month days
  for (let i = 1; i <= totalDays; i++) {
    daysGrid.push({
      day: i,
      month,
      year,
      isCurrentMonth: true
    });
  }
  // Fill next month padding days
  const remaining = 42 - daysGrid.length; // 6 rows * 7 columns
  for (let i = 1; i <= remaining; i++) {
    daysGrid.push({
      day: i,
      month: month + 1,
      year: month === 11 ? year + 1 : year,
      isCurrentMonth: false
    });
  }

  // Handle day click
  const selectDay = (dayObj) => {
    const updated = new Date(dayObj.year, dayObj.month, dayObj.day);
    updateDateTime(updated, selectedHour, selectedMinute, selectedPeriod);
  };

  // Helper to compile date time and notify parent
  const updateDateTime = (date, hr, min, ampm) => {
    if (!date) {
      date = new Date();
    }
    
    let militaryHour = hr;
    if (ampm === 'PM' && hr !== 12) {
      militaryHour += 12;
    } else if (ampm === 'AM' && hr === 12) {
      militaryHour = 0;
    }

    const newDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), militaryHour, min);
    setSelectedDate(newDate);

    // Format local datetime string for input: YYYY-MM-DDTHH:MM
    const localYear = newDate.getFullYear();
    const localMonth = String(newDate.getMonth() + 1).padStart(2, '0');
    const localDay = String(newDate.getDate()).padStart(2, '0');
    const localHour = String(newDate.getHours()).padStart(2, '0');
    const localMinute = String(newDate.getMinutes()).padStart(2, '0');
    
    onChange(`${localYear}-${localMonth}-${localDay}T${localHour}:${localMinute}`);
  };

  const handlePeriodChange = (ampm) => {
    setSelectedPeriod(ampm);
    updateDateTime(selectedDate, selectedHour, selectedMinute, ampm);
  };

  // Clock calculations & hand positions
  const center = 90;
  const radius = 62;
  
  let currentVal = clockMode === 'hours' ? selectedHour : selectedMinute;
  let angleDegrees = 0;
  if (clockMode === 'hours') {
    angleDegrees = (currentVal * 30 - 90) % 360;
  } else {
    angleDegrees = (currentVal * 6 - 90) % 360;
  }
  const angleRad = angleDegrees * (Math.PI / 180);
  const handX = center + radius * Math.cos(angleRad);
  const handY = center + radius * Math.sin(angleRad);

  const handleClockClickOrDrag = (e) => {
    if (!clockFaceRef.current) return;
    const rect = clockFaceRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    
    if (clientX === undefined || clientY === undefined) return;

    const clickX = clientX - (rect.left + rect.width / 2);
    const clickY = clientY - (rect.top + rect.height / 2);

    let angle = Math.atan2(clickY, clickX);
    let degrees = angle * (180 / Math.PI);
    let normalized = degrees + 90;
    if (normalized < 0) normalized += 360;

    if (clockMode === 'hours') {
      let hour = Math.round(normalized / 30);
      if (hour === 0) hour = 12;
      setSelectedHour(hour);
      updateDateTime(selectedDate, hour, selectedMinute, selectedPeriod);
    } else {
      let minute = Math.round(normalized / 6);
      if (minute === 60) minute = 0;
      setSelectedMinute(minute);
      updateDateTime(selectedDate, selectedHour, minute, selectedPeriod);
    }
  };

  const handleClockMouseDown = (e) => {
    handleClockClickOrDrag(e);
    
    const handleMouseMove = (moveEvent) => {
      handleClockClickOrDrag(moveEvent);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Auto transition to minutes if clicked hour
      if (clockMode === 'hours') {
        setTimeout(() => setClockMode('minutes'), 300);
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleClockTouchStart = (e) => {
    handleClockClickOrDrag(e);
    
    const handleTouchMove = (moveEvent) => {
      handleClockClickOrDrag(moveEvent);
    };
    
    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      if (clockMode === 'hours') {
        setTimeout(() => setClockMode('minutes'), 300);
      }
    };
    
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Generate numbers for hour face
  const hoursPositions = Array.from({ length: 12 }, (_, i) => {
    const hr = i + 1;
    const aDeg = hr * 30 - 90;
    const aRad = aDeg * (Math.PI / 180);
    const x = center + radius * Math.cos(aRad);
    const y = center + radius * Math.sin(aRad);
    return { value: hr, x, y };
  });

  // Generate numbers for minute face (0, 5, 10... 55)
  const minutesPositions = Array.from({ length: 12 }, (_, i) => {
    const min = i * 5;
    const aDeg = i * 30 - 90;
    const aRad = aDeg * (Math.PI / 180);
    const x = center + radius * Math.cos(aRad);
    const y = center + radius * Math.sin(aRad);
    return { value: min === 0 ? '00' : String(min).padStart(2, '0'), numericValue: min, x, y };
  });

  const clearPicker = (e) => {
    e.stopPropagation();
    setSelectedDate(null);
    onChange('');
    setIsOpen(false);
  };

  const handleApply = (e) => {
    e.stopPropagation();
    if (!selectedDate) {
      updateDateTime(new Date(), selectedHour, selectedMinute, selectedPeriod);
    }
    setIsOpen(false);
  };

  const isDaySelected = (dayObj) => {
    if (!selectedDate) return false;
    return selectedDate.getDate() === dayObj.day &&
           selectedDate.getMonth() === dayObj.month &&
           selectedDate.getFullYear() === dayObj.year;
  };

  const isToday = (dayObj) => {
    const today = new Date();
    return today.getDate() === dayObj.day &&
           today.getMonth() === dayObj.month &&
           today.getFullYear() === dayObj.year;
  };

  return (
    <div className="dtpicker-wrapper" ref={popoverRef}>
      <div className="dtpicker-input-container" onClick={toggleOpen}>
        <input
          type="text"
          id={id}
          value={selectedDate ? getDisplayValue() : ''}
          placeholder={label || 'Select Date & Time'}
          readOnly
          className="admin-input-field dtpicker-trigger-input"
        />
        <div className="dtpicker-icons">
          {selectedDate && (
            <button type="button" className="dtpicker-clear-btn" onClick={clearPicker} title="Clear">
              ✕
            </button>
          )}
          <span className="dtpicker-calendar-icon">📅</span>
        </div>
      </div>

      {isOpen && (
        <div className="dtpicker-popover">
          <div className="dtpicker-panes">
            
            {/* Google Calendar Section */}
            <div className="dtpicker-calendar-pane">
              <div className="calendar-nav-header">
                <button type="button" className="calendar-nav-btn" onClick={prevMonth}>‹</button>
                <span className="calendar-month-year">
                  {navDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <button type="button" className="calendar-nav-btn" onClick={nextMonth}>›</button>
              </div>

              <div className="calendar-weekdays">
                <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
              </div>

              <div className="calendar-days-grid">
                {daysGrid.map((d, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`calendar-day-btn ${!d.isCurrentMonth ? 'padding-day' : ''} ${isDaySelected(d) ? 'selected-day' : ''} ${isToday(d) ? 'today-day' : ''}`}
                    onClick={() => selectDay(d)}
                  >
                    {d.day}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="dtpicker-divider"></div>

            {/* Round Clock Section */}
            <div className="dtpicker-clock-pane">
              <div className="clock-time-display">
                <button 
                  type="button" 
                  className={`time-display-num ${clockMode === 'hours' ? 'active' : ''}`} 
                  onClick={() => setClockMode('hours')}
                >
                  {String(selectedHour).padStart(2, '0')}
                </button>
                <span className="time-display-colon">:</span>
                <button 
                  type="button" 
                  className={`time-display-num ${clockMode === 'minutes' ? 'active' : ''}`} 
                  onClick={() => setClockMode('minutes')}
                >
                  {String(selectedMinute).padStart(2, '0')}
                </button>
                
                <div className="clock-ampm-col">
                  <button 
                    type="button" 
                    className={`ampm-btn ${selectedPeriod === 'AM' ? 'active' : ''}`}
                    onClick={() => handlePeriodChange('AM')}
                  >
                    AM
                  </button>
                  <button 
                    type="button" 
                    className={`ampm-btn ${selectedPeriod === 'PM' ? 'active' : ''}`}
                    onClick={() => handlePeriodChange('PM')}
                  >
                    PM
                  </button>
                </div>
              </div>

              <div 
                className="clock-face-outer" 
                ref={clockFaceRef}
                onMouseDown={handleClockMouseDown}
                onTouchStart={handleClockTouchStart}
              >
                <div className="clock-face-center"></div>
                
                {/* SVG for clock pointer hand */}
                <svg className="clock-face-svg" width="180" height="180">
                  <line 
                    x1={center} 
                    y1={center} 
                    x2={handX} 
                    y2={handY} 
                    className="clock-hand-line"
                  />
                  <circle 
                    cx={handX} 
                    cy={handY} 
                    r="12" 
                    className="clock-hand-joint"
                  />
                  <circle 
                    cx={center} 
                    cy={center} 
                    r="4" 
                    className="clock-center-pin"
                  />
                </svg>

                {/* Numbers placement */}
                {clockMode === 'hours' ? (
                  hoursPositions.map((pos) => {
                    const isSelected = selectedHour === pos.value;
                    return (
                      <span
                        key={pos.value}
                        className={`clock-number ${isSelected ? 'selected' : ''}`}
                        style={{
                          left: `${pos.x}px`,
                          top: `${pos.y}px`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        {pos.value}
                      </span>
                    );
                  })
                ) : (
                  minutesPositions.map((pos) => {
                    const isSelected = selectedMinute === pos.numericValue;
                    return (
                      <span
                        key={pos.numericValue}
                        className={`clock-number minute-number ${isSelected ? 'selected' : ''}`}
                        style={{
                          left: `${pos.x}px`,
                          top: `${pos.y}px`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        {pos.value}
                      </span>
                    );
                  })
                )}
              </div>

              <div className="clock-mode-indicator">
                Select {clockMode === 'hours' ? 'Hour' : 'Minute'}
              </div>
            </div>

          </div>

          <div className="dtpicker-footer">
            <button type="button" className="dtpicker-footer-btn clear" onClick={clearPicker}>
              Clear
            </button>
            <button type="button" className="dtpicker-footer-btn ok" onClick={handleApply}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
