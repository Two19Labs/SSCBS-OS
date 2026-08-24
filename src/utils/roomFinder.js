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
            const newItem = {
              course,
              sem: String(sem),
              sec: String(sec),
              subject: periodEntry.subject || 'In Class',
              teacher: periodEntry.teacher || '',
              rawRoom: periodEntry.room
            };

            if (!occupiedMap.has(roomName)) {
              occupiedMap.set(roomName, {
                ...newItem,
                allOccupancies: [newItem]
              });
            } else {
              const existing = occupiedMap.get(roomName);
              existing.allOccupancies.push(newItem);
            }
          });
        }
      }
    }
  }

  return occupiedMap;
}

/**
 * Normalizes query string and checks if an occupancy object matches the user query.
 */
export function matchClassOccupancy(occupancy, rawQuery) {
  if (!occupancy || !rawQuery) return false;

  const q = rawQuery.trim().toLowerCase();
  if (!q) return false;

  const items = occupancy.allOccupancies || [occupancy];

  return items.some(item => {
    const course = (item.course || '').toLowerCase();
    const sem = String(item.sem || '').toLowerCase();
    const sec = (item.sec || '').toLowerCase();
    const subject = (item.subject || '').toLowerCase();
    const teacher = (item.teacher || '').toLowerCase();

    // Normalized course aliases
    const courseAliases = [];
    if (course.includes('bms')) {
      courseAliases.push('bms');
    }
    if (course.includes('fia') || course.includes('bba')) {
      courseAliases.push('bba', 'fia', 'bba fia', 'bbafia', 'bba(fia)');
    }
    if (course.includes('comp') || course.includes('cs') || course.includes('bsc') || course.includes('b.sc')) {
      courseAliases.push('bsc', 'b.sc', 'cs', 'bsc cs', 'b.sc cs', 'computer science', 'comp sci');
    }
    if (course.includes('operational') || course.includes('or') || course.includes('m.sc') || course.includes('msc')) {
      courseAliases.push('or', 'msc', 'm.sc', 'operational research');
    }

    const secVariants = [sec, `sec ${sec}`, `section ${sec}`];
    const semVariants = [sem, `sem ${sem}`, `semester ${sem}`];

    const combinedVariants = [
      `${course} ${sem}${sec}`,
      `${course} ${sem} ${sec}`,
      `${course} sem ${sem} sec ${sec}`,
      `${course} sem ${sem} (${sec})`,
      `${course} ${sec}`,
      `${sem}${sec}`,
      `${sem} ${sec}`
    ];

    if (course.includes('comp') || course.includes('cs') || course.includes('bsc')) {
      combinedVariants.push(
        `bsc ${sem}${sec}`,
        `bsc ${sem} ${sec}`,
        `b.sc ${sem}${sec}`,
        `bsc cs ${sem}${sec}`,
        `cs ${sem}${sec}`
      );
    }
    if (course.includes('fia') || course.includes('bba')) {
      combinedVariants.push(
        `bba fia ${sem}${sec}`,
        `bba ${sem}${sec}`,
        `fia ${sem}${sec}`,
        `bba fia ${sem} ${sec}`
      );
    }

    if (subject.includes(q) || teacher.includes(q)) return true;
    if (combinedVariants.some(v => v.includes(q))) return true;
    if (courseAliases.some(alias => alias === q || alias.includes(q))) return true;
    if (secVariants.some(sv => sv === q)) return true;
    if (semVariants.some(sm => sm === q)) return true;

    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length > 1) {
      const allTokensMatch = tokens.every(tok => {
        return (
          subject.includes(tok) ||
          teacher.includes(tok) ||
          course.includes(tok) ||
          courseAliases.some(a => a.includes(tok)) ||
          sem === tok ||
          sec.toLowerCase() === tok ||
          secVariants.some(sv => sv === tok) ||
          semVariants.some(sm => sm === tok) ||
          combinedVariants.some(cv => cv.includes(tok))
        );
      });
      if (allTokensMatch) return true;
    }

    return false;
  });
}

/**
 * Finds all daily timeline slots in a room matching a search query.
 */
export function findDailyScheduleMatchesForRoom(timetableData, day, roomName, rawQuery) {
  if (!timetableData || !day || !roomName || !rawQuery) return [];
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  const roomTimeline = getRoomDailyTimeline(timetableData, day, roomName);
  if (!roomTimeline || !roomTimeline.timeline) return [];

  const matchedSlots = [];
  roomTimeline.timeline.forEach(slot => {
    if (!slot.isVacant && slot.occupiedBy) {
      if (matchClassOccupancy(slot.occupiedBy, q)) {
        matchedSlots.push(slot);
      }
    }
  });

  return matchedSlots;
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
 * Get ordinal suffix for a number (e.g. 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th")
 */
export function getOrdinalSuffix(n) {
  const num = Number(n);
  if (isNaN(num) || num <= 0) return '';
  const j = num % 10, k = num % 100;
  if (j === 1 && k !== 11) {
    return num + "st";
  }
  if (j === 2 && k !== 12) {
    return num + "nd";
  }
  if (j === 3 && k !== 13) {
    return num + "rd";
  }
  return num + "th";
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

