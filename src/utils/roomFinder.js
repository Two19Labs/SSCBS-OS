import { PERIODS } from '../data/timetables';

/**
 * Extract clean, normalized room names from a raw room string
 */
export function extractRoomsFromText(roomStr) {
  if (!roomStr || roomStr === '-' || roomStr.trim() === '') return [];

  const text = roomStr.trim();

  // Alias checks for Hindi GE/VAC groups
  if (text.includes('Hin A') || text.includes('Hindi A') || text.includes('Hin B') || text.includes('Hindi B')) {
    return ['Room 607'];
  }
  if (text.includes('Hin C') || text.includes('Hindi C')) {
    return ['Room 644'];
  }
  if (text.includes('Hin D') || text.includes('Hindi D')) {
    return ['Room 648'];
  }

  const rooms = new Set();

  // Match 3-digit room numbers (e.g. 203, 503, 703, 426)
  const numMatches = text.match(/\b\d{3}\b/g);
  if (numMatches) {
    numMatches.forEach(num => {
      rooms.add(`Room ${num}`);
    });
  }

  // Match Lab numbers e.g. "Lab 426", "Lab 460"
  const labMatches = text.match(/Lab\s*(\d{3})/gi);
  if (labMatches) {
    labMatches.forEach(lab => {
      const numMatch = lab.match(/\d{3}/);
      if (numMatch) {
        rooms.add(`Room ${numMatch[0]}`);
      }
    });
  }

  return Array.from(rooms);
}


/**
 * Extract all unique active rooms directly from timetables data.
 */
export function extractAllRoomsFromTimetable(timetableData) {
  if (!timetableData || typeof timetableData !== 'object') return [];

  const masterRoomSet = new Set();

  for (const course in timetableData) {
    const cData = timetableData[course];
    if (!cData || typeof cData !== 'object') continue;

    for (const sem in cData) {
      const sData = cData[sem];
      if (!sData || typeof sData !== 'object') continue;

      for (const sec in sData) {
        const days = sData[sec];
        if (!days || typeof days !== 'object') continue;

        for (const day in days) {
          const periods = days[day];
          if (Array.isArray(periods)) {
            periods.forEach(p => {
              if (p && p.room) {
                const extracted = extractRoomsFromText(p.room);
                extracted.forEach(r => masterRoomSet.add(r));
              }
            });
          }
        }
      }
    }
  }

  // Sort rooms numerically by floor/room number
  return Array.from(masterRoomSet).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
    return numA - numB;
  });
}

/**
 * Get map of occupied rooms and their current class info for a given day and period.
 */
export function getOccupiedRoomsMap(timetableData, day, periodId) {
  const occupiedMap = new Map();

  if (!timetableData || !day || periodId === undefined || periodId === null) {
    return occupiedMap;
  }

  for (const course in timetableData) {
    const cData = timetableData[course];
    if (!cData) continue;

    for (const sem in cData) {
      const sData = cData[sem];
      if (!sData) continue;

      for (const sec in sData) {
        const schedule = sData[sec];
        if (!schedule || !schedule[day]) continue;

        const periods = schedule[day];
        const periodEntry = periods.find(p => p.period === periodId);

        if (periodEntry && periodEntry.room && periodEntry.subject !== 'Free' && !periodEntry.isBreak) {
          const extractedRooms = extractRoomsFromText(periodEntry.room);
          extractedRooms.forEach(roomName => {
            occupiedMap.set(roomName, {
              course,
              sem,
              sec,
              subject: periodEntry.subject || 'In Class',
              teacher: periodEntry.teacher || '',
              rawRoom: periodEntry.room
            });
          });
        }
      }
    }
  }

  return occupiedMap;
}

/**
 * Derives status for ALL extracted rooms at a specific day and target period.
 */
export function getRoomStatuses(timetableData, day, targetPeriodId) {
  const allRooms = extractAllRoomsFromTimetable(timetableData);
  const occupiedMap = getOccupiedRoomsMap(timetableData, day, targetPeriodId);

  const periodOrder = [1, 2, 3, 0, 4, 5, 6, 7];
  const targetIdx = periodOrder.indexOf(targetPeriodId);

  return allRooms.map(room => {
    const occupancy = occupiedMap.get(room);

    if (occupancy) {
      return {
        room,
        floor: getFloorFromRoom(room),
        isVacant: false,
        occupiedBy: occupancy,
      };
    } else {
      let consecutiveFreePeriods = 1;
      let freeUntilPeriodLabel = null;

      if (targetIdx !== -1) {
        for (let i = targetIdx + 1; i < periodOrder.length; i++) {
          const nextPeriodId = periodOrder[i];
          const nextOccupiedMap = getOccupiedRoomsMap(timetableData, day, nextPeriodId);
          if (nextOccupiedMap.has(room)) {
            const nextP = PERIODS.find(p => p.id === nextPeriodId);
            freeUntilPeriodLabel = nextP ? nextP.startLabel : null;
            break;
          } else {
            consecutiveFreePeriods++;
          }
        }
      }

      return {
        room,
        floor: getFloorFromRoom(room),
        isVacant: true,
        consecutiveFreePeriods,
        freeUntilPeriodLabel,
        isFreeRestOfDay: !freeUntilPeriodLabel
      };
    }
  });
}

/**
 * Extract floor number from room string (e.g. "Room 503" -> 5, "Lab 426" -> 4)
 */
export function getFloorFromRoom(roomStr) {
  const match = roomStr.match(/\d{3}/);
  if (match) {
    const firstDigit = match[0].charAt(0);
    return parseInt(firstDigit, 10);
  }
  return 0;
}

/**
 * Get complete daily timeline for a specific room on a given day.
 */
export function getRoomDailyTimeline(timetableData, day, roomName) {
  const periodOrder = [1, 2, 3, 0, 4, 5, 6, 7];
  
  const timeline = periodOrder.map(periodId => {
    const periodInfo = PERIODS.find(p => p.id === periodId);
    const occupiedMap = getOccupiedRoomsMap(timetableData, day, periodId);
    const occupancy = occupiedMap.get(roomName);

    return {
      periodId,
      periodLabel: periodInfo ? periodInfo.label : `Period ${periodId}`,
      timeRange: periodInfo ? `${periodInfo.startLabel} – ${periodInfo.endLabel}` : '',
      isBreak: periodInfo ? !!periodInfo.isBreak : false,
      isVacant: !occupancy,
      occupiedBy: occupancy || null
    };
  });

  const vacantPeriods = timeline.filter(t => t.isVacant);
  const occupiedPeriods = timeline.filter(t => !t.isVacant);

  return {
    room: roomName,
    floor: getFloorFromRoom(roomName),
    day,
    timeline,
    vacantCount: vacantPeriods.length,
    occupiedCount: occupiedPeriods.length,
    vacantPeriodLabels: vacantPeriods.map(t => `${t.periodLabel} (${t.timeRange})`),
  };
}

