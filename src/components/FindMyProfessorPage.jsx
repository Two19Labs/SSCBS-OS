import React, { useState, useEffect, useRef } from 'react';
import { useTimetable } from '../context/TimetableContext';
import { useAuth } from '../context/AuthContext';
import { PERIODS, DAYS } from '../data/timetables';
import { isAdminEmail, isTimeWarpEnabled } from '../lib/admin';
import { exportScheduleAsImage } from '../utils/exportUtils';
import { ImageIcon } from './icons';
import './FindMyProfessorPage.css';

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

// Patterns matching subjects, electives, or labels mistakenly placed in teacher fields
const NON_TEACHER_PATTERNS = [
  /^hindi\s*[a-d]?$/i,
  /^hindi\s.*/i,
  /^(aecc|vac|sec|ge|evs|sports|physical ed|value addition)$/i,
  /^(free|unsupervised|break|infinity hour|merged|-|\)|\(|guest|ee|ee1|ee2|pg lab|ma l|ma lab|room.*)$/i,
  /^ee[1-2]?$/i,
  /^social ent/i,
  /^\W*$/
];

const isNonTeacher = (name) => {
  if (!name) return true;
  const clean = name.trim();
  return NON_TEACHER_PATTERNS.some(pattern => pattern.test(clean));
};

const FACULTY_DISPLAY_MAP = {
  'aa': 'Dr. Anamika Agarwal',
  'ag': 'Anamika Gupta',
  'anamika gupta': 'Anamika Gupta',
  'ayg': 'Ayushi Gupta',
  'ayushi gupta': 'Ayushi Gupta',
  'dd': 'Dr. Deepali Dhaka',
  'deepali': 'Dr. Deepali Dhaka',
  'am': 'Dr. Anuja Mathur',
  'anuja mathur': 'Dr. Anuja Mathur',
  'ta': 'Dr. Tarannum Ahmad',
  'mv': 'Dr. Mona Verma',
  'mona verma': 'Dr. Mona Verma',
  'sj': 'Dr. Saumya Jain',
  'saumya jain': 'Dr. Saumya Jain',
  'skg': 'Dr. Satish Kumar Garg',
  'sk': 'Mr. Praveen SK',
  'ps': 'Mr. Praveen SK',
  'praveen': 'Mr. Praveen SK',
  'kr': 'Kavita Rastogi',
  'krs': 'Dr. Kavita Rastogi',
  'os': 'Dr. Onkar Singh',
  'ng': 'Dr. Nidhi Kesari',
  'nb': 'Dr. Neha Sharma',
  'neha': 'Dr. Neha Sharma',
  'st': 'Sonika Thakral',
  'sonika thakral': 'Sonika Thakral',
  'sushmita': 'Dr. Sushmita',
  'ma': 'Dr. Mehak Aggarwal',
  'mn': 'Mogana Neelkandan',
  'mogana neelkandan': 'Mogana Neelkandan',
  'ns': 'Nidhi Seth',
  'nidhi seth': 'Nidhi Seth',
  'pg': 'Pushkar Gole',
  'pushkar gole': 'Pushkar Gole',
  'sg': 'Shikha Gupta',
  'shikha gupta': 'Shikha Gupta',
  'azmi': 'Dr. Azmi Ahmad',
  'av': 'Abhimanyu Verma',
  'pa': 'Priyanka',
  'priyanka': 'Priyanka',
  'komal': 'Komal Sharma',
  'garima': 'Dr. Garima Tripathi',
  'sog': 'Dr. Soumya Guliyan',
  'soumya': 'Dr. Soumya Guliyan',
  'vinayak': 'Vinayak Gautam',
  'nisha': 'Ms. Nisha Rajput',
  'vipin': 'Mr. Vipin Patel',
  'ishan': 'Ishan Jain',
  'ankit': 'Ankit',
  'seema': 'Dr. Seema',
  'mt': 'Dr. Madhu Totla',
  'sv': 'Shikha Verma',
  'nks': 'Dr. Nidhi Kesari',
  'mr': 'Mr. Raj Kumar',
  'tm': 'Mr. Tushar Marwaha',
  'paridhi': 'Paridhi',
  'shipra': 'Ms. Shipra Varshney',
  'guncha': 'Dr. Guncha',
  'sp': 'Dr. Shalini Prakash',
  'kb': 'Dr. Kumar Bijoy',
  'nk': 'Dr. Nidhi Kesari',
  'rk': 'Dr. Raj Kumar',
  'rrs': 'Dr. Rishi Rajan Sahay',
  'sanchi': 'Ms. Sanchi Kalra',
  'ayesha': 'Ms. Ayesha S. Ansari',
  'monu': 'Dr. Monu',
  'ritika': 'Ritika',
  'bhavya': 'Bhavya',
  'kajol': 'Kajol',
  'twinkle': 'Twinkle',
  'vineet': 'Vineet',
  'ankita': 'Ankita',
  'rohan': 'Mr. Rohan Gulati',
  'tatkarsh': 'Mr. Tatkarsh',
  'monika': 'Ms. Monika',
  'vp': 'Mr. Vipin Patel',
  'nr': 'Ms. Nisha Rajput',
  'gs': 'Gautam Sharma',
  'rg': 'Mr. Rohan Gulati',
  'sg': 'Dr. Saumya Jain'
};

// Clean display names (remove group suffixes, (P), (Tute), room numbers, and expand raw initials)
const cleanDisplayName = (name) => {
  if (!name) return '';
  let cleaned = name
    .replace(/^[:\s\-]+|[:\s\-]+$/g, '')
    .replace(/g\d+:\s*/gi, '')
    .replace(/p\d+:\s*/gi, '')
    .replace(/\b([gp]\d+)\b/gi, '')
    .replace(/\(((?:[GP]1\s*[\+\/]\s*[GP]2)|[GP]\d+|G\?|P|Practical|Tute|Tutorial|Merged[^\)]*|\d{3}(?:\/\d{3})*|Room[^\)]*|Hin[^\)]*|Python|SEC[^\)]*|VAC[^\)]*|GE[^\)]*|AECC[^\)]*|Th)\)/gi, '')
    .replace(/merged\s+with\s+[^\)]*/gi, '')
    .replace(/\b(P|Practical|Tute|Tutorial|Lab|L)\b/gi, '')
    .replace(/\b[2-7]\d{2}\b/g, '')
    .replace(/^[():\s\/-]+|[():\s\/-]+$/g, '')
    .replace(/[\s-]+/g, ' ')
    .trim();

  const lower = cleaned.toLowerCase();
  if (FACULTY_DISPLAY_MAP[lower]) {
    return FACULTY_DISPLAY_MAP[lower];
  }

  const firstWordKey = lower.split(' ')[0];
  if (FACULTY_DISPLAY_MAP[firstWordKey]) {
    return FACULTY_DISPLAY_MAP[firstWordKey];
  }

  return cleaned;
};

// Normalize teacher name by removing titles, group markers, and converting to lowercase
const normalizeName = (name) => {
  if (!name) return '';
  return cleanDisplayName(name)
    .toLowerCase()
    .replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, '')
    .replace(/[\s.-]+/g, ' ')
    .trim();
};

// Splits a teacher cell into individual names and filters out non-faculty entries
const splitTeachers = (teacherStr) => {
  if (!teacherStr || typeof teacherStr !== 'string') return [];
  return teacherStr
    .split(/\/|\band\b|,/gi)
    .map(t => cleanDisplayName(t))
    .filter(t => {
      if (!t || t === '-' || t.length < 2) return false;
      if (isNonTeacher(t)) return false;
      return true;
    });
};

// Parse time string to minutes since midnight
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Disambiguate multi-group / multi-teacher classes for a specific professor
const disambiguateClassForTeacher = (c, profName) => {
  const normSelected = normalizeName(profName);
  if (!c || !c.teacher) return null;

  // Split teacher field by '/' or ',' or 'and'
  const rawTeacherSegments = c.teacher.split(/\/|\band\b|,/gi).map(s => s.trim()).filter(Boolean);
  
  // Find segment corresponding to this professor
  let matchingSegment = rawTeacherSegments.find(segment => {
    const cleanSeg = cleanDisplayName(segment);
    return normalizeName(cleanSeg) === normSelected;
  });

  if (!matchingSegment) return null;

  // Extract group tag if present in the teacher segment, e.g., (G1), (G2), (P1), (P2), G1, G2, etc.
  const groupMatch = matchingSegment.match(/\b([GP][1-9])\b/i) || matchingSegment.match(/\((?:Group\s*)?([GP][1-9])\)/i);
  const groupTag = groupMatch ? groupMatch[1].toUpperCase() : null;

  let finalSubject = c.subject || '';
  let rawRoomStr = (c.room || '').trim();
  let finalRoom = ROOM_DISPLAY_MAP[rawRoomStr] || rawRoomStr || '-';

  if (groupTag) {
    // 1. Disambiguate Subject
    if (c.subject) {
      const subParts = c.subject.split(/\s*(?:\||\/)\s*/);
      const matchingSub = subParts.find(part => {
        const pUpper = part.toUpperCase();
        return pUpper.includes(`${groupTag}:`) || 
               pUpper.includes(`${groupTag} -`) || 
               pUpper.includes(`(${groupTag})`) || 
               pUpper.startsWith(`${groupTag} `) ||
               pUpper.endsWith(` (${groupTag})`);
      });

      if (matchingSub) {
        let cleanSub = matchingSub.replace(new RegExp(`^${groupTag}\\s*[:\\-]\\s*`, 'i'), '').trim();
        finalSubject = cleanSub.toLowerCase().includes(`(${groupTag.toLowerCase()})`) ? cleanSub : `${cleanSub} (${groupTag})`;
      } else {
        if (!finalSubject.toUpperCase().includes(`(${groupTag})`)) {
          finalSubject = `${finalSubject} (${groupTag})`;
        }
      }
    }

    // 2. Disambiguate Room
    if (c.room) {
      const roomParts = c.room.split(/\s*(?:\||\/)\s*/);
      const matchingRoomPart = roomParts.find(part => {
        const rUpper = part.toUpperCase();
        return rUpper.includes(`${groupTag}:`) || 
               rUpper.includes(`${groupTag} -`) || 
               rUpper.includes(`(${groupTag})`) || 
               rUpper.includes(`ROOM ${groupTag}`);
      });

      if (matchingRoomPart) {
        let cleanR = matchingRoomPart.replace(new RegExp(`(?:Room\\s*)?${groupTag}\\s*[:\\-]\\s*`, 'i'), '').trim();
        if (/^\d{3}$/.test(cleanR)) {
          cleanR = `Room ${cleanR}`;
        }
        finalRoom = ROOM_DISPLAY_MAP[cleanR.trim()] || cleanR;
      } else if (roomParts.length > 1) {
        const groupIndex = parseInt(groupTag.substring(1)) - 1;
        if (groupIndex >= 0 && groupIndex < roomParts.length) {
          let cleanR = roomParts[groupIndex].trim();
          if (/^\d{3}$/.test(cleanR)) {
            cleanR = `Room ${cleanR}`;
          }
          finalRoom = ROOM_DISPLAY_MAP[cleanR] || cleanR;
        }
      }
    }
  }

  if (typeof finalRoom === 'string') {
    finalRoom = finalRoom.replace(/^Room\s+Room\s+/i, 'Room ');
  }

  return {
    subject: finalSubject,
    room: finalRoom && finalRoom !== '-' ? finalRoom : 'TBA',
    group: groupTag
  };
};

export default function FindMyProfessorPage({ onBack }) {
  const { timetable: timetablesData, holidays } = useTimetable();
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

  // Schedule Export Refs & States
  const scheduleExportRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null);

  const handleExportImage = async () => {
    if (!scheduleExportRef.current || !selectedProf) return;
    setIsExporting(true);
    setExportMessage(null);
    try {
      await exportScheduleAsImage({
        element: scheduleExportRef.current,
        title: selectedProf,
        subtitle: `Faculty Timetable (${viewMode === 'weekly' ? 'Full Weekly Schedule Grid' : 'Daily Timeline'})`,
        fileName: `SSCBS_Prof_${selectedProf}_Schedule`,
        badgeText: 'Faculty Schedule',
        theme: 'dark'
      });
      setExportMessage('Exported as Image! 🎉');
      setTimeout(() => setExportMessage(null), 3500);
    } catch (err) {
      console.error('Export schedule error:', err);
      setExportMessage('Export failed. Try again.');
      setTimeout(() => setExportMessage(null), 3500);
    } finally {
      setIsExporting(false);
    }
  };

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
    if (!timetablesData || typeof timetablesData !== 'object') return;

    for (const course in timetablesData) {
      if (course === '_meta') continue;
      const cData = timetablesData[course];
      if (!cData || typeof cData !== 'object') continue;

      for (const sem in cData) {
        const sData = cData[sem];
        if (!sData || typeof sData !== 'object') continue;

        for (const sec in sData) {
          const secData = sData[sec];
          if (!secData || typeof secData !== 'object') continue;

          for (const day in secData) {
            const classes = secData[day];
            if (!Array.isArray(classes)) continue;

            classes.forEach(c => {
              if (!c || !c.teacher) return;
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
  }, [timetablesData]);

  // Filtered list of professors for sidebar
  const filteredProfs = professorsList.filter(p => 
    p.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Extract selected professor schedule
  const getProfessorSchedule = (profName) => {
    if (!profName || !timetablesData || typeof timetablesData !== 'object') return [];
    const schedules = [];

    for (const course in timetablesData) {
      if (course === '_meta') continue;
      const cData = timetablesData[course];
      if (!cData || typeof cData !== 'object') continue;

      for (const sem in cData) {
        const sData = cData[sem];
        if (!sData || typeof sData !== 'object') continue;

        for (const sec in sData) {
          const secData = sData[sec];
          if (!secData || typeof secData !== 'object') continue;

          for (const day in secData) {
            const classes = secData[day];
            if (!Array.isArray(classes)) continue;

            classes.forEach(c => {
              if (!c || !c.teacher) return;
              const disambiguated = disambiguateClassForTeacher(c, profName);
              if (disambiguated) {
                schedules.push({
                  course,
                  semester: sem,
                  section: sec,
                  day,
                  period: c.period,
                  subject: disambiguated.subject,
                  room: disambiguated.room,
                  group: disambiguated.group,
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

  // Check if today (or simulated date) is a holiday
  const todayStr = time.getFullYear() + '-' + String(time.getMonth() + 1).padStart(2, '0') + '-' + String(time.getDate()).padStart(2, '0');
  const todayHoliday = holidays?.find(h => h.date === todayStr);

  // Time metrics
  const dayOfWeek = isSimulated ? simulatedDay : DAYS[time.getDay() - 1] || 'Sunday';
  const isWeekend = dayOfWeek === 'Sunday' || dayOfWeek === 'Saturday';
  const currentMinutes = time.getHours() * 60 + time.getMinutes();

  // Compute live tracking status
  const getLiveStatus = () => {
    if (todayHoliday) {
      return {
        status: 'holiday',
        holidayType: todayHoliday.type || 'Holiday',
        title: todayHoliday.title,
        message: todayHoliday.message || 'No lectures scheduled today due to holiday/fest.'
      };
    }

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
    if (isWeekend || todayHoliday) return null;
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
          {isSimulated && (
            <span className="live-pill-small">Simulated</span>
          )}
          <span className="header-clock-digits">{clockHours}:{clockMin}:{clockSec} {clockAmPm}</span>
        </div>
      </div>

      {/* Disclaimer Banner */}
      <div className="prof-disclaimer-banner">
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>
          <strong>Note:</strong> Timetables reflect the latest schedule sent by the college via email. This is NOT real-time tracking — classes and room allocations are subject to change or cancellation at the discretion of professors. Some professors may appear multiple times in the list due to different naming conventions; please check both their full names and initials.
        </span>
      </div>

      {/* Main Spacious Dual Column Layout */}
      <div className="prof-page-layout">
        
        {/* Left Column: Sidebar List of Faculty */}
        <aside className={`prof-page-sidebar ${mobileActiveTab === 'list' ? 'show-mobile-sidebar' : 'hide-mobile-sidebar'}`}>
          <div className="sidebar-search-box">
            <h4>SSCBS Faculty List</h4>
            <p className="sidebar-description">Filter and select a professor to track</p>
            <p className="sidebar-naming-note">
              * Note: Some professors may appear multiple times in the list due to different naming conventions; please check both their full names and initials.
            </p>
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
                          <span className="badge-live-teaching">Ongoing Class</span>
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
                    ) : currentStatus.status === 'holiday' ? (
                      <div className="alert-box-status weekend" style={{ borderColor: 'rgba(217, 119, 6, 0.3)', backgroundColor: 'rgba(251, 191, 36, 0.08)' }}>
                        <span className="badge-generic break" style={{ background: '#d97706', color: '#ffffff' }}>
                          {currentStatus.holidayType}
                        </span>
                        <h3 style={{ color: '#92400e', marginTop: '6px' }}>{currentStatus.title}</h3>
                        <p>{currentStatus.message}</p>
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
                  {!isWeekend && !todayHoliday && nextClass ? (
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
                <div className="view-tabs-left">
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {exportMessage && <span className="export-toast-notice">{exportMessage}</span>}
                  <button 
                    className="btn-export-schedule-img"
                    onClick={handleExportImage}
                    disabled={isExporting}
                    title="Export un-clipped schedule as high resolution PNG image"
                  >
                    <ImageIcon size={16} />
                    <span>{isExporting ? 'Generating Image...' : 'Export Image'}</span>
                  </button>
                </div>
              </div>

              {/* Render Schedule views */}
              <div className="page-view-content-wrapper" ref={scheduleExportRef}>
                
                {viewMode === 'today' ? (
                  <div className="spacious-timeline-wrapper">
                    {todayHoliday ? (
                      <div className="timeline-empty-card" style={{ padding: '24px', textAlign: 'center' }}>
                        <span className="badge-generic break" style={{ background: '#d97706', color: '#ffffff', marginBottom: '8px', display: 'inline-block' }}>
                          {todayHoliday.type || 'Holiday'}
                        </span>
                        <h4 style={{ margin: '8px 0 4px', fontSize: '1.1rem', fontWeight: 700 }}>{todayHoliday.title}</h4>
                        <p style={{ margin: 0, color: 'var(--text-muted)' }}>{todayHoliday.message || 'No lectures scheduled today due to the holiday/fest.'}</p>
                      </div>
                    ) : isWeekend ? (
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
