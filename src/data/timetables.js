import timetablesData from './timetables.json';

const PERIODS = [
  { id: 1, label: "Period I", start: "09:00", end: "10:00", startLabel: "9:00 AM", endLabel: "10:00 AM" },
  { id: 2, label: "Period II", start: "10:00", end: "11:00", startLabel: "10:00 AM", endLabel: "11:00 AM" },
  { id: 3, label: "Period III", start: "11:00", end: "12:00", startLabel: "11:00 AM", endLabel: "12:00 PM" },
  { id: 0, label: "Infinity Hour", start: "12:00", end: "13:00", startLabel: "12:00 PM", endLabel: "1:00 PM", isBreak: true },
  { id: 4, label: "Period IV", start: "13:00", end: "14:00", startLabel: "1:00 PM", endLabel: "2:00 PM" },
  { id: 5, label: "Period V", start: "14:00", end: "15:00", startLabel: "2:00 PM", endLabel: "3:00 PM" },
  { id: 6, label: "Period VI", start: "15:00", end: "16:00", startLabel: "3:00 PM", endLabel: "4:00 PM" },
  { id: 7, label: "Period VII", start: "16:00", end: "17:00", startLabel: "4:00 PM", endLabel: "5:00 PM" }
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

export function getTimetable(course, semester, section) {
  // Exact lookup only — never substitute another course/semester's timetable.
  const sData = timetablesData[course]?.[semester];
  if (!sData) return null;
  const sectionKeys = Object.keys(sData);
  return sData[section] || (sectionKeys.length === 1 ? sData[sectionKeys[0]] : null);
}

export { PERIODS, DAYS };
