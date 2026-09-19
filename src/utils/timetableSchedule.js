import { PERIODS, DAYS } from '../data/timetables';

export function getISTTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 5.5);
}

export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

export const ROOM_DISPLAY_MAP = {
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

export const resolveRoom = (room, timetable) => {
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

export const NEXT_COLLEGE_DAY = {
  'Monday': 'Tuesday',
  'Tuesday': 'Wednesday',
  'Wednesday': 'Thursday',
  'Thursday': 'Friday',
  'Friday': 'Monday',
  'Saturday': 'Monday',
  'Sunday': 'Monday'
};

export const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Computes all real-time schedule metrics for any given section timetable at a given IST time.
 */
export function computeSectionSchedule({
  timetable,
  time,
  holidays = [],
  isSimulated = false,
  simulatedDay = 'Monday'
}) {
  const hour = time.getHours();
  const realTodayDay = WEEK_DAYS[time.getDay()] || 'Sunday';
  const currentDayName = isSimulated ? simulatedDay : realTodayDay;
  const isWeekend = currentDayName === 'Sunday' || currentDayName === 'Saturday';
  const currentMinutes = hour * 60 + time.getMinutes();

  const isEveningMode = hour >= 18;
  const nextCollegeDayName = NEXT_COLLEGE_DAY[currentDayName] || 'Monday';
  const isEveningPreviewActive = isEveningMode && (!isWeekend || currentDayName === 'Sunday');

  const todayClasses = timetable ? timetable[currentDayName] || [] : [];
  const nextDayClasses = timetable ? timetable[nextCollegeDayName] || [] : [];

  // Find next college day's first lecture (non-break, non-free)
  let firstNextDayClass = null;
  let firstNextDayPeriod = null;
  for (const cls of nextDayClasses) {
    if (cls.isBreak || cls.subject === 'Free' || !cls.subject) continue;
    const p = PERIODS.find(x => x.id === cls.period);
    if (p) {
      if (!firstNextDayClass || p.id < (firstNextDayPeriod?.id || 999)) {
        firstNextDayClass = cls;
        firstNextDayPeriod = p;
      }
    }
  }

  const nextDayRealClassCount = nextDayClasses.filter(c => !c.isBreak && c.subject !== 'Free' && c.subject).length;

  // Check holidays
  const todayStr = time.getFullYear() + '-' + String(time.getMonth() + 1).padStart(2, '0') + '-' + String(time.getDate()).padStart(2, '0');
  const todayHoliday = holidays?.find(h => h.date === todayStr);

  const tomorrowDateObj = new Date(time);
  tomorrowDateObj.setDate(tomorrowDateObj.getDate() + 1);
  const tomorrowStr = tomorrowDateObj.getFullYear() + '-' + String(tomorrowDateObj.getMonth() + 1).padStart(2, '0') + '-' + String(tomorrowDateObj.getDate()).padStart(2, '0');
  const tomorrowHoliday = holidays?.find(h => h.date === tomorrowStr);

  const nextCollegeDateObj = new Date(time);
  if (currentDayName === 'Friday') {
    nextCollegeDateObj.setDate(nextCollegeDateObj.getDate() + 3);
  } else if (currentDayName === 'Saturday') {
    nextCollegeDateObj.setDate(nextCollegeDateObj.getDate() + 2);
  } else {
    nextCollegeDateObj.setDate(nextCollegeDateObj.getDate() + 1);
  }
  const nextCollegeDateStr = nextCollegeDateObj.getFullYear() + '-' + String(nextCollegeDateObj.getMonth() + 1).padStart(2, '0') + '-' + String(nextCollegeDateObj.getDate()).padStart(2, '0');
  const nextCollegeHoliday = holidays?.find(h => h.date === nextCollegeDateStr);

  // Active and next class computation
  let activeClass = null;
  let activePeriod = null;
  let nextClass = null;
  let nextPeriod = null;

  if (timetable && !isWeekend && !todayHoliday) {
    if (currentMinutes >= 720 && currentMinutes < 780) {
      activeClass = { period: 0, isBreak: true, subject: 'Infinity Hour (Break)', teacher: '-', room: '-' };
      activePeriod = PERIODS.find(p => p.id === 0);
    }
    todayClasses.forEach((cls) => {
      const p = PERIODS.find((x) => x.id === cls.period);
      if (!p) return;
      const startMin = parseTimeToMinutes(p.start);
      const endMin = parseTimeToMinutes(p.end);
      if (!activeClass && currentMinutes >= startMin && currentMinutes < endMin) {
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

  const getRemainingTime = () => {
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

  const getProgressPercentage = () => {
    if (!activePeriod) return 0;
    const start = parseTimeToMinutes(activePeriod.start) * 60;
    const end = parseTimeToMinutes(activePeriod.end) * 60;
    const nowSec = hour * 3600 + time.getMinutes() * 60 + time.getSeconds();
    return Math.max(0, Math.min(100, ((nowSec - start) / (end - start)) * 100));
  };

  const isRealClass = Boolean(activeClass && !activeClass.isBreak && activeClass.subject !== 'Free');

  return {
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
    remainingStr: getRemainingTime(),
    progressPct: getProgressPercentage(),
    isRealClass,
    resolveRoom: (r) => resolveRoom(r, timetable)
  };
}
